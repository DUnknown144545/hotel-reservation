// server.js - Main backend server (FIXED AND FINAL CODE)
const express = require('express');
// We require mysql2, and configure it for promise support, necessary for async/await
const mysql = require('mysql2'); 
const cors = require('cors');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// MySQL Connection Setup
const dbConfig = {
    host: 'localhost',
    user: 'root', // Change to your MySQL username
    password: '', // Change to your MySQL password
    database: 'hotel_db'
};

// Create the connection using mysql2/promise for async/await support
const db = mysql.createPool(dbConfig);

db.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed:', err.stack);
        return;
    }
    console.log('Connected to MySQL database as id ' + connection.threadId);
    connection.release(); // Release connection back to pool
});

// Middleware
app.use(cors());
// Increased limit for image_data (base64)
app.use(bodyParser.json({ limit: '50mb' })); 

// =================================================================
// 1. ALL API ENDPOINTS (MUST COME BEFORE STATIC FILES)
// =================================================================

// ===== AUTHENTICATION ENDPOINTS =====

// Register new user
app.post('/api/register', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        const [results] = await db.promise().query('SELECT * FROM users WHERE username = ?', [username]);

        if (results.length > 0) {
            return res.status(400).json({ success: false, message: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
        await db.promise().query(query, [username, hashedPassword, role]);
        
        res.json({ success: true, message: 'Registration successful' });
    } catch (err) {
        console.error('Registration failed:', err);
        return res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

// Login user
app.post('/api/login', async (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        const query = 'SELECT * FROM users WHERE username = ?';
        const [results] = await db.promise().query(query, [username]);

        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        const user = results[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        if (user.role !== role) {
            return res.status(401).json({ success: false, message: `You are logged in as a ${user.role}, please select the correct role` });
        }

        res.json({
            success: true,
            message: 'Login successful',
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ===== DASHBOARD ENDPOINT =====

app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const totalRoomsQuery = 'SELECT COUNT(*) as total_rooms FROM rooms';
        // Note: For occupied rooms, a room's status should be updated by a booking/check-in/out trigger.
        // We use the room status for simplicity here.
        const occupiedRoomsQuery = 'SELECT COUNT(*) as occupied_rooms FROM rooms WHERE status = "Occupied"';
        const currentGuestsQuery = 'SELECT COUNT(DISTINCT user_id) as current_guests FROM bookings WHERE status = "Checked In"';
        const monthlyRevenueQuery = 'SELECT SUM(amount) as monthly_revenue FROM payments WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';

        // Use array destructuring for promise-based query results
        const [[totalRooms]] = await db.promise().query(totalRoomsQuery);
        const [[occupiedRooms]] = await db.promise().query(occupiedRoomsQuery);
        const [[currentGuests]] = await db.promise().query(currentGuestsQuery);
        const [[monthlyRevenue]] = await db.promise().query(monthlyRevenueQuery);

        res.json({
            success: true,
            stats: {
                total_rooms: totalRooms.total_rooms,
                occupied_rooms: occupiedRooms.occupied_rooms,
                current_guests: currentGuests.current_guests,
                monthly_revenue: monthlyRevenue.monthly_revenue || 0
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, message: 'Database error fetching stats' });
    }
});

// ===== ROOM ENDPOINTS (CRUD) =====

// Get all rooms
app.get('/api/rooms', async (req, res) => {
    try {
        const [results] = await db.promise().query('SELECT * FROM rooms ORDER BY room_number ASC');
        res.json({ success: true, rooms: results });
    } catch (err) {
        console.error('Error loading rooms:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Get available rooms by type
app.get('/api/rooms/available/:roomType', async (req, res) => {
    const { roomType } = req.params;
    try {
        const query = 'SELECT room_number FROM rooms WHERE room_type = ? AND status = "Available"';
        const [results] = await db.promise().query(query, [roomType]);
        res.json({ success: true, rooms: results });
    } catch (err) {
        console.error('Error loading available rooms:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
    }
});


// Create new room
app.post('/api/rooms', async (req, res) => {
    const { room_number, room_type, price, status, capacity, floor_number, size_sqm, description, amenities, image_data } = req.body;
    const query = `INSERT INTO rooms (room_number, room_type, price, status, capacity, floor_number, size_sqm, description, amenities, image_data) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    try {
        const [result] = await db.promise().query(query, [room_number, room_type, price, status, capacity, floor_number, size_sqm, description, amenities, image_data]);
        res.json({ success: true, message: 'Room added successfully', roomId: result.insertId });
    } catch (err) {
        console.error('Room creation failed:', err);
        return res.status(500).json({ success: false, message: 'Room creation failed' });
    }
});

// Update room
app.put('/api/rooms/:id', async (req, res) => {
    const { id } = req.params;
    const { room_number, room_type, price, status, capacity, floor_number, size_sqm, description, amenities, image_data } = req.body;

    const query = `UPDATE rooms SET room_number = ?, room_type = ?, price = ?, status = ?, capacity = ?, 
                   floor_number = ?, size_sqm = ?, description = ?, amenities = ?, image_data = ?
                   WHERE id = ?`;
                   
    try {
        const [result] = await db.promise().query(query, [room_number, room_type, price, status, capacity, floor_number, size_sqm, description, amenities, image_data, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Room not found' });
        }
        res.json({ success: true, message: 'Room updated successfully' });
    } catch (err) {
        console.error('Room update failed:', err);
        return res.status(500).json({ success: false, message: 'Room update failed' });
    }
});

// Delete room
app.delete('/api/rooms/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.promise().query('DELETE FROM rooms WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Room not found' });
        }
        res.json({ success: true, message: 'Room deleted successfully' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Deletion failed' });
    }
});

// ===== BOOKING ENDPOINTS (CRUD) =====

// Get all bookings
app.get('/api/bookings', async (req, res) => {
    try {
        const [results] = await db.promise().query('SELECT * FROM bookings ORDER BY checkin_date DESC');
        res.json({ success: true, bookings: results });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Get bookings by user (Existing Code)
app.get('/api/bookings/user/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [results] = await db.promise().query('SELECT * FROM bookings WHERE user_id = ? ORDER BY checkin_date DESC', [userId]);
        res.json({ success: true, bookings: results });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Create new booking
app.post('/api/bookings', async (req, res) => {
    const { user_id, guest_name, room_number, room_type, checkin_date, checkout_date, phone, status } = req.body;
    const query = `INSERT INTO bookings (user_id, guest_name, room_number, room_type, checkin_date, checkout_date, phone, status) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    try {
        const [result] = await db.promise().query(query, [user_id, guest_name, room_number, room_type, checkin_date, checkout_date, phone, status || 'Pending']);
        res.json({ success: true, message: 'Booking created', bookingId: result.insertId });
    } catch (err) {
        console.error('Booking creation failed:', err);
        return res.status(500).json({ success: false, message: 'Booking creation failed' });
    }
});

// Update booking
app.put('/api/bookings/:id', async (req, res) => {
    const { id } = req.params;
    const { guest_name, room_number, room_type, checkin_date, checkout_date, phone, status } = req.body;

    const query = `UPDATE bookings SET guest_name = ?, room_number = ?, room_type = ?, checkin_date = ?, 
                   checkout_date = ?, phone = ?, status = ? WHERE id = ?`;

    try {
        const [result] = await db.promise().query(query, [guest_name, room_number, room_type, checkin_date, checkout_date, phone, status, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        res.json({ success: true, message: 'Booking updated' });
    } catch (err) {
        console.error('Booking update failed:', err);
        return res.status(500).json({ success: false, message: 'Update failed' });
    }
});

// Delete booking
app.delete('/api/bookings/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.promise().query('DELETE FROM bookings WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        res.json({ success: true, message: 'Booking deleted successfully' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Deletion failed' });
    }
});

// ===== GUEST ENDPOINTS =====

// Get all current guests
app.get('/api/guests', async (req, res) => {
    const query = `SELECT * FROM bookings WHERE status = 'Checked In' ORDER BY checkout_date ASC`;
    try {
        const [results] = await db.promise().query(query);
        res.json({ success: true, guests: results });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
    }
});

// ===== PAYMENT ENDPOINTS =====

// Get all payments
app.get('/api/payments', async (req, res) => {
    try {
        const [results] = await db.promise().query('SELECT * FROM payments ORDER BY payment_date DESC');
        res.json({ success: true, payments: results });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Create payment
app.post('/api/payments', async (req, res) => {
    const { booking_id, room_type, amount, payment_method, status } = req.body;
    const query = `INSERT INTO payments (booking_id, room_type, amount, payment_method, status) 
                   VALUES (?, ?, ?, ?, ?)`;
    try {
        const [result] = await db.promise().query(query, [booking_id, room_type, amount, payment_method, status || 'Paid']);
        res.json({ success: true, message: 'Payment recorded', paymentId: result.insertId });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Payment creation failed' });
    }
});

// ===== ROOM AVAILABILITY ENDPOINT =====

// Get room availability
app.get('/api/rooms/availability', async (req, res) => {
    const query = `
      SELECT room_type, COUNT(*) as total_rooms,
      SUM(CASE WHEN rooms.status = 'Occupied' THEN 1 ELSE 0 END) as booked,
      COUNT(*) - SUM(CASE WHEN rooms.status = 'Occupied' THEN 1 ELSE 0 END) as available
      FROM rooms
      GROUP BY room_type
    `;
    try {
        const [results] = await db.promise().query(query);
        res.json({ success: true, availability: results });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Database error' });
    }
});


app.get('/api/users', async (req, res) => {
    try {
        // Query all users, excluding the password hash
        const query = 'SELECT id, username, role, status, created_at FROM users ORDER BY id ASC';
        const [results] = await db.promise().query(query);
        res.json({ success: true, users: results });
    } catch (err) {
        console.error('Error fetching users:', err);
        return res.status(500).json({ success: false, message: 'Database error fetching users' });
    }
});

// 2. Update user status (Accept/Pending/Decline)
app.put('/api/users/status/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status value
    if (!['Pending', 'Accepted', 'Declined'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    // Prevent Admin from changing their own role/status here for security
    try {
        const checkQuery = 'SELECT role FROM users WHERE id = ?';
        const [userCheck] = await db.promise().query(checkQuery, [id]);

        if (userCheck.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (userCheck[0].role === 'Admin') {
            return res.status(403).json({ success: false, message: 'Cannot modify status of Admin account via this endpoint' });
        }

        const updateQuery = 'UPDATE users SET status = ? WHERE id = ?';
        const [result] = await db.promise().query(updateQuery, [status, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'User not found or status already set' });
        }
        res.json({ success: true, message: `User status set to ${status}` });

    } catch (err) {
        console.error('Error updating user status:', err);
        return res.status(500).json({ success: false, message: 'Database error updating status' });
    }
});

// =================================================================
// 2. STATIC FILE MIDDLEWARE (MUST COME LAST)
// =================================================================
app.use(express.static(path.join(__dirname, '..', 'frontend')));



// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
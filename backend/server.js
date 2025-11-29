// server.js - combined, ready-to-run (fixed)
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = 3000;

// MySQL Connection Setup
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'hotel_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const db = mysql.createPool(dbConfig);

// Test database connection
db.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err.stack);
    return;
  }
  console.log('Connected to MySQL database');
  connection.release();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Simple request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

// Simple middleware to require receptionist role for sensitive endpoints.
// Reads user id from header 'x-user-id'. If header missing or user not receptionist => 403.
// NOTE: this is lightweight — in production use proper auth (JWT/session).
async function requireReceptionist(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Missing x-user-id header' });
    }
    const [rows] = await db.promise().query('SELECT role, status FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!rows || rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    const user = rows[0];
    if (user.role !== 'Receptionist') {
      return res.status(403).json({ success: false, message: 'Forbidden: receptionist role required' });
    }
    if (user.status !== 'Accepted') {
      return res.status(403).json({ success: false, message: `User status is ${user.status}` });
    }
    // attach user info to request for later use if needed
    req.authUser = { id: Number(userId), role: user.role };
    next();
  } catch (err) {
    console.error('requireReceptionist error:', err);
    return res.status(500).json({ success: false, message: 'Server error validating user' });
  }
}

// =================================================================
// AUTHENTICATION ENDPOINTS
// =================================================================

app.post('/api/register', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  try {
    const [results] = await db.promise().query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (results.length > 0) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO users (username, password, role, status, created_at) VALUES (?, ?, ?, ?, NOW())';
    await db.promise().query(query, [username, hashedPassword, role, 'Pending']);

    res.json({ success: true, message: 'Registration successful' });
  } catch (err) {
    console.error('Registration failed:', err);
    return res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  try {
    const [results] = await db.promise().query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
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

    if (user.status !== 'Accepted') {
      return res.status(403).json({
        success: false,
        message: `Your account status is ${user.status}. You cannot log in until it is Accepted.`
      });
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

// =================================================================
// USER MANAGEMENT ENDPOINTS
// =================================================================

app.get('/api/users', async (req, res) => {
  try {
    const query = 'SELECT id, username, role, status, created_at FROM users ORDER BY id ASC';
    const [results] = await db.promise().query(query);
    res.json({ success: true, users: results });
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ success: false, message: 'Database error fetching users' });
  }
});

app.put('/api/users/status/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['Pending', 'Accepted', 'Declined'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status value' });
  }

  try {
    const [userCheck] = await db.promise().query('SELECT role FROM users WHERE id = ? LIMIT 1', [id]);
    if (userCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (userCheck[0].role === 'Admin') {
      return res.status(403).json({ success: false, message: 'Cannot modify status of Admin account' });
    }

    const [result] = await db.promise().query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: `User status set to ${status}` });
  } catch (err) {
    console.error('Error updating user status:', err);
    return res.status(500).json({ success: false, message: 'Database error updating status' });
  }
});

// =================================================================
// ROOM ENDPOINTS
// =================================================================

app.get('/api/rooms', async (req, res) => {
  try {
    // return useful fields for the frontend, alias image_url -> image_data
    const [results] = await db.promise().query(
      `SELECT id, room_number, room_type, price, image_url AS image_data, amenities, description, status, capacity, floor_number, size_sqm
       FROM rooms
       ORDER BY room_number ASC`
    );
    res.json({ success: true, rooms: results });
  } catch (err) {
    console.error('Error loading rooms:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.get('/api/rooms/available/:roomType', async (req, res) => {
  const { roomType } = req.params;
  const { checkin, checkout } = req.query;

  try {
    // If dates are not provided, fall back to "currently available" only
    if (!checkin || !checkout) {
      const [results] = await db.promise().query(
        `SELECT id, room_number, room_type, price, image_url AS image_data, amenities, description
         FROM rooms
         WHERE room_type = ? AND status = 'Available'
         ORDER BY room_number ASC`,
        [roomType]
      );
      return res.json({ success: true, rooms: results });
    }

    // Exclude rooms that have overlapping bookings in the requested range
    const query = `
      SELECT r.id, r.room_number, r.room_type, r.price, r.image_url AS image_data, r.amenities, r.description
      FROM rooms r
      WHERE r.room_type = ?
        AND r.status IN ('Available', 'Reserved', 'Occupied')
        AND r.room_number NOT IN (
          SELECT b.room_number
          FROM bookings b
          WHERE b.room_number IS NOT NULL
            AND b.status != 'Cancelled'
            AND NOT (b.checkout_date <= ? OR b.checkin_date >= ?)
        )
      ORDER BY r.room_number ASC
    `;
    const [results] = await db.promise().query(query, [roomType, checkin, checkout]);
    res.json({ success: true, rooms: results });
  } catch (err) {
    console.error('Error loading available rooms:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// =================================================================
// BOOKING ENDPOINTS - WORKFLOW
// =================================================================

// Get all bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const [results] = await db.promise().query('SELECT * FROM bookings ORDER BY created_at DESC');
    res.json({ success: true, bookings: results });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get bookings by user
app.get('/api/bookings/user/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [results] = await db.promise().query('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    res.json({ success: true, bookings: results });
  } catch (err) {
    console.error('Error fetching user bookings:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get online booking requests (pending receptionist approval)
app.get('/api/bookings/online/pending', async (req, res) => {
  try {
    const query = `SELECT b.*, u.username
                   FROM bookings b
                   LEFT JOIN users u ON b.user_id = u.id
                   WHERE b.booking_type = 'online' AND b.receptionist_status = 'pending'
                   ORDER BY b.created_at DESC`;
    const [results] = await db.promise().query(query);
    res.json({ success: true, bookings: results });
  } catch (err) {
    console.error('Error fetching pending online bookings:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Get accepted online bookings
app.get('/api/bookings/online/accepted', async (req, res) => {
  try {
    const query = `SELECT b.*, u.username
                   FROM bookings b
                   LEFT JOIN users u ON b.user_id = u.id
                   WHERE b.booking_type = 'online' AND b.receptionist_status = 'accepted'
                   ORDER BY b.created_at DESC`;
    const [results] = await db.promise().query(query);
    res.json({ success: true, bookings: results });
  } catch (err) {
    console.error('Error fetching accepted online bookings:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.get('/api/bookings/payment-uploads', async (req, res) => {
  try {
    const query = `
      SELECT 
        b.*,
        r.price,
        GREATEST(DATEDIFF(b.checkout_date, b.checkin_date), 1) AS nights,
        (r.price * GREATEST(DATEDIFF(b.checkout_date, b.checkin_date), 1)) AS expected_amount,
        b.created_at AS payment_upload_date
      FROM bookings b
      LEFT JOIN rooms r ON b.room_number = r.room_number
      WHERE b.booking_type = 'online'
        AND b.payment_uploaded = 1
        AND b.payment_verified = 0
      ORDER BY b.created_at DESC
    `;
    const [results] = await db.promise().query(query);
    res.json({ success: true, bookings: results });
  } catch (err) {
    console.error('Error fetching payment uploads:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Create online booking (from guest)
app.post('/api/bookings/online', async (req, res) => {
  const { user_id, guest_name, room_type, checkin_date, checkout_date, phone } = req.body;
  if (!user_id || !guest_name || !room_type || !checkin_date || !checkout_date) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const query = `INSERT INTO bookings
                 (user_id, guest_name, room_type, checkin_date, checkout_date, phone,
                  booking_type, receptionist_status, payment_status, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'online', 'pending', 'Unpaid', 'Pending', NOW())`;

  try {
    const [result] = await db.promise().query(query, [user_id, guest_name, room_type, checkin_date, checkout_date, phone]);
    res.json({ success: true, message: 'Booking request submitted', bookingId: result.insertId });
  } catch (err) {
    console.error('Booking creation failed:', err);
    return res.status(500).json({ success: false, message: 'Booking creation failed' });
  }
});

// Note: removed the broken forwarding/alias that attempted app._router.handle(...).
// Keep a clear error/help message for clients that call POST /api/bookings
app.post('/api/bookings', async (req, res) => {
  return res.status(400).json({
    success: false,
    message: 'Use /api/bookings/online for guest requests, or /api/bookings/manual for receptionist-created bookings (include payment_image).'
  });
});

// Create manual booking (from receptionist with payment proof)
app.post('/api/bookings/manual', requireReceptionist, async (req, res) => {
  const { user_id, guest_name, room_number, room_type, checkin_date, checkout_date, phone, payment_image } = req.body;

  if (!user_id || !guest_name || !room_number || !room_type || !checkin_date || !checkout_date) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  // validate dates
  const checkin = new Date(checkin_date);
  const checkout = new Date(checkout_date);
  if (isNaN(checkin.getTime()) || isNaN(checkout.getTime()) || checkout <= checkin) {
    return res.status(400).json({ success: false, message: 'Invalid check-in/check-out dates' });
  }

  let conn;
  try {
    conn = await db.promise().getConnection();
    await conn.beginTransaction();

    // 1) check overlapping bookings for same room
    const [overlapRows] = await conn.query(
      `SELECT COUNT(1) AS cnt
       FROM bookings
       WHERE room_number = ?
         AND status != 'Cancelled'
         AND NOT (checkout_date <= ? OR checkin_date >= ?)`,
      [room_number, checkin_date, checkout_date]
    );

    if (overlapRows && overlapRows[0] && overlapRows[0].cnt > 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: `Room ${room_number} is already booked for selected dates` });
    }

    // 2) get room price
    const [roomRows] = await conn.query('SELECT price FROM rooms WHERE room_number = ? LIMIT 1', [room_number]);
    const price = (roomRows && roomRows.length && Number(roomRows[0].price)) ? Number(roomRows[0].price) : 0;

    // 3) compute nights and total amount
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const nights = Math.max(1, Math.ceil((checkout.getTime() - checkin.getTime()) / MS_PER_DAY));
    const totalAmount = nights * price;

    // 4) insert booking
    const bookingQuery = `INSERT INTO bookings
                          (user_id, guest_name, room_number, room_type, checkin_date, checkout_date, phone,
                           booking_type, receptionist_status, payment_status, status, created_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', 'accepted', 'Paid', 'Pending', NOW())`;
    const [bookingResult] = await conn.query(bookingQuery, [user_id, guest_name, room_number, room_type, checkin_date, checkout_date, phone]);
    const bookingId = bookingResult.insertId;

    // 5) insert payment record with computed amount
    const paymentQuery = `INSERT INTO payments
                          (booking_id, room_type, amount, payment_method, status, image_data, payment_date)
                          VALUES (?, ?, ?, 'Manual', 'Paid', ?, NOW())`;
    await conn.query(paymentQuery, [bookingId, room_type, totalAmount, payment_image || null]);

    await conn.commit();
    res.json({ success: true, message: 'Manual booking created with payment', bookingId, totalAmount, nights });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Manual booking failed:', err);
    return res.status(500).json({ success: false, message: 'Booking creation failed' });
  } finally {
    if (conn) conn.release();
  }
});

// Receptionist accept/decline online booking (with overlap check when accepting)
app.put('/api/bookings/online/:id/receptionist-action', requireReceptionist, async (req, res) => {
  const { id } = req.params;
  const { action, room_number, gcash_number } = req.body;

  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action' });
  }

  let conn;
  try {
    conn = await db.promise().getConnection();
    await conn.beginTransaction();

    // fetch booking dates
    const [bookingRows] = await conn.query('SELECT checkin_date, checkout_date FROM bookings WHERE id = ? LIMIT 1', [id]);
    if (!bookingRows || bookingRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const booking = bookingRows[0];

    if (action === 'accept') {
      if (!room_number || !gcash_number) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'room_number and gcash_number required to accept' });
      }

      // check overlap for the proposed room_number
      const [overlapRows] = await conn.query(
        `SELECT COUNT(1) AS cnt
         FROM bookings
         WHERE room_number = ?
           AND status != 'Cancelled'
           AND id != ?
           AND NOT (checkout_date <= ? OR checkin_date >= ?)`,
        [room_number, id, booking.checkin_date, booking.checkout_date]
      );

      if (overlapRows && overlapRows[0] && overlapRows[0].cnt > 0) {
        await conn.rollback();
        return res.status(409).json({ success: false, message: `Room ${room_number} is not available for the booking dates` });
      }

      await conn.query(
        `UPDATE bookings
         SET receptionist_status = 'accepted',
             room_number = ?,
             gcash_number = ?
         WHERE id = ?`,
        [room_number, gcash_number, id]
      );

      await conn.commit();
      return res.json({ success: true, message: 'Booking accepted. Guest can now proceed with payment.' });
    } else {
      // decline
      await conn.query(`UPDATE bookings SET receptionist_status = 'declined', status = 'Cancelled' WHERE id = ?`, [id]);
      await conn.commit();
      return res.json({ success: true, message: 'Booking declined' });
    }
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Receptionist online-action failed:', err);
    return res.status(500).json({ success: false, message: 'Action failed' });
  } finally {
    if (conn) conn.release();
  }
});

// Generic receptionist actions for bookings: checkin, checkout, cancel
// Place this BEFORE the JSON 404 app.use('/api', ...) middleware
app.put('/api/bookings/:id/receptionist-action', requireReceptionist, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  if (!['checkin', 'checkout', 'cancel'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action' });
  }

  let conn;
  try {
    conn = await db.promise().getConnection();
    await conn.beginTransaction();

    // Lock the booking row for update to avoid race conditions
    const [bookingRows] = await conn.query(
      'SELECT id, room_number, status, payment_status FROM bookings WHERE id = ? LIMIT 1 FOR UPDATE',
      [id]
    );
    if (!bookingRows || bookingRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const booking = bookingRows[0];

    // Helper for updating room state if room_number available
    const setRoomState = async (roomNum, newState) => {
      if (!roomNum) return;
      await conn.query('UPDATE rooms SET status = ? WHERE room_number = ?', [newState, roomNum]);
    };

    if (action === 'checkin') {
      // Ensure payment verified
      if (booking.payment_status !== 'Paid') {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Cannot check-in. Payment not verified.' });
      }
      if (booking.status && booking.status.toLowerCase().includes('checked in')) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Guest already checked in' });
      }

      await conn.query('UPDATE bookings SET status = ?, receptionist_status = ? WHERE id = ?', ['Checked In', 'checked-in', id]);
      await setRoomState(booking.room_number, 'Occupied');

      await conn.commit();
      return res.json({ success: true, message: 'Guest checked in successfully' });
    }

    if (action === 'checkout') {
      if (!booking.status || !booking.status.toLowerCase().includes('checked in')) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Cannot check-out. Guest is not checked in.' });
      }

      await conn.query('UPDATE bookings SET status = ?, receptionist_status = ? WHERE id = ?', ['Checked Out', 'checked-out', id]);
      await setRoomState(booking.room_number, 'Available');

      await conn.commit();
      return res.json({ success: true, message: 'Guest checked out successfully' });
    }

    if (action === 'cancel') {
      // Cancel the booking and free the room if assigned
      await conn.query('UPDATE bookings SET status = ?, receptionist_status = ? WHERE id = ?', ['Cancelled', 'cancelled', id]);
      await setRoomState(booking.room_number, 'Available');

      await conn.commit();
      return res.json({ success: true, message: 'Booking cancelled' });
    }

    // fallback (shouldn't get here)
    await conn.rollback();
    return res.status(400).json({ success: false, message: 'Unhandled action' });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Receptionist generic action failed:', err);
    return res.status(500).json({ success: false, message: 'Action failed' });
  } finally {
    if (conn) conn.release();
  }
});

// Guest uploads payment proof
app.put('/api/bookings/:id/upload-payment', async (req, res) => {
  const { id } = req.params;
  const { payment_image } = req.body;
  if (!payment_image) {
    return res.status(400).json({ success: false, message: 'Payment image required' });
  }

  try {
    const query = `UPDATE bookings
                   SET payment_image = ?, payment_uploaded = 1, payment_verified = 0
                   WHERE id = ?`;
    await db.promise().query(query, [payment_image, id]);
    res.json({ success: true, message: 'Payment proof uploaded successfully' });
  } catch (err) {
    console.error('Payment upload failed:', err);
    return res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// Receptionist verify payment
app.put('/api/bookings/:id/verify-payment', requireReceptionist, async (req, res) => {
  const { id } = req.params;
  const { approved, amount } = req.body;

  let conn;
  try {
    conn = await db.promise().getConnection();
    await conn.beginTransaction();

    if (approved) {
      // Update booking
      await conn.query(`UPDATE bookings
                        SET payment_status = 'Paid',
                            payment_verified = 1
                        WHERE id = ?`, [id]);

      // Get booking details
      const [bookingRows] = await conn.query('SELECT room_type FROM bookings WHERE id = ? LIMIT 1', [id]);
      const roomType = bookingRows && bookingRows.length ? bookingRows[0].room_type : null;

      // Record payment
      await conn.query(`INSERT INTO payments
                        (booking_id, room_type, amount, payment_method, status, payment_date)
                        VALUES (?, ?, ?, 'GCash', 'Paid', NOW())`,
                        [id, roomType || null, amount || 0]);
    } else {
      // Reject payment: clear upload & flags
      await conn.query(`UPDATE bookings
                        SET payment_verified = 0,
                            payment_uploaded = 0,
                            payment_image = NULL,
                            payment_status = 'Unpaid'
                        WHERE id = ?`, [id]);
    }

    await conn.commit();
    res.json({ success: true, message: approved ? 'Payment approved' : 'Payment rejected' });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Payment verification failed:', err);
    return res.status(500).json({ success: false, message: 'Verification failed' });
  } finally {
    if (conn) conn.release();
  }
});

// Check-in / Check-out (strict payment rule)
app.put('/api/check/:id', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  if (!['checkin', 'checkout'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action' });
  }

  let conn;
  try {
    conn = await db.promise().getConnection();
    await conn.beginTransaction();

    const [bookingResults] = await conn.query(
      'SELECT id, room_number, status, payment_status FROM bookings WHERE id = ? LIMIT 1 FOR UPDATE',
      [id]
    );
    if (bookingResults.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = bookingResults[0];

    // Both checkin and checkout require payment_status = 'Paid'
    if (booking.payment_status !== 'Paid') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Action requires payment to be Paid' });
    }

    if (action === 'checkin') {
      if (booking.status && booking.status.toLowerCase().includes('checked in')) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Guest already checked in' });
      }

      await conn.query('UPDATE bookings SET status = ?, receptionist_status = ? WHERE id = ?', ['Checked In', 'checked-in', id]);
      if (booking.room_number) {
        await conn.query('UPDATE rooms SET status = ? WHERE room_number = ?', ['Occupied', booking.room_number]);
      }

      await conn.commit();
      return res.json({ success: true, message: 'Guest checked in successfully' });
    }

    if (action === 'checkout') {
      if (!booking.status || !booking.status.toLowerCase().includes('checked in')) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Cannot check-out. Guest is not checked in.' });
      }

      await conn.query('UPDATE bookings SET status = ?, receptionist_status = ? WHERE id = ?', ['Checked Out', 'checked-out', id]);
      if (booking.room_number) {
        await conn.query('UPDATE rooms SET status = ? WHERE room_number = ?', ['Available', booking.room_number]);
      }

      await conn.commit();
      return res.json({ success: true, message: 'Guest checked out successfully' });
    }

    // fallback
    await conn.rollback();
    return res.status(400).json({ success: false, message: 'Unhandled action' });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Check action failed:', err);
    return res.status(500).json({ success: false, message: 'Action failed' });
  } finally {
    if (conn) conn.release();
  }
});

// =================================================================
// PAYMENT ENDPOINTS
// =================================================================

app.get('/api/payments', async (req, res) => {
  try {
    const query = `SELECT p.*, b.guest_name
                   FROM payments p
                   LEFT JOIN bookings b ON p.booking_id = b.id
                   ORDER BY p.payment_date DESC`;
    const [results] = await db.promise().query(query);
    res.json({ success: true, payments: results });
  } catch (err) {
    console.error('Error fetching payments:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.get('/api/payments/pending-verification', async (req, res) => {
  try {
    const query = `
      SELECT 
        b.id AS booking_id,
        b.guest_name,
        b.room_number,
        b.room_type,
        b.payment_image,
        b.created_at AS upload_date,
        r.price,
        GREATEST(DATEDIFF(b.checkout_date, b.checkin_date), 1) AS nights,
        (r.price * GREATEST(DATEDIFF(b.checkout_date, b.checkin_date), 1)) AS expected_amount
      FROM bookings b
      LEFT JOIN rooms r ON b.room_number = r.room_number
      WHERE b.payment_uploaded = 1
        AND b.payment_verified = 0
        AND b.booking_type = 'online'
      ORDER BY b.created_at DESC
    `;
    const [results] = await db.promise().query(query);
    res.json({ success: true, payments: results });
  } catch (err) {
    console.error('Error fetching payments pending verification:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.get('/api/payments/verified', async (req, res) => {
  try {
    const query = `SELECT p.*, b.guest_name
                   FROM payments p
                   LEFT JOIN bookings b ON p.booking_id = b.id
                   WHERE p.status = 'Paid'
                   ORDER BY p.payment_date DESC`;
    const [results] = await db.promise().query(query);
    res.json({ success: true, payments: results });
  } catch (err) {
    console.error('Error fetching verified payments:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Ratings endpoints (unchanged)
app.post('/api/ratings', async (req, res) => {
  const { booking_id, user_id, rating, comment } = req.body;
  if (!booking_id || !user_id || !rating) {
    return res.status(400).json({ success: false, message: 'booking_id, user_id and rating are required' });
  }
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ success: false, message: 'rating must be an integer between 1 and 5' });
  }

  let conn;
  try {
    conn = await db.promise().getConnection();
    const [bkRows] = await conn.query('SELECT id, user_id, room_number, room_type, status FROM bookings WHERE id = ? LIMIT 1', [booking_id]);
    if (!bkRows || bkRows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const booking = bkRows[0];
    if (Number(booking.user_id) !== Number(user_id)) {
      conn.release();
      return res.status(403).json({ success: false, message: 'You can only rate your own bookings' });
    }
    if (booking.status !== 'Checked Out') {
      conn.release();
      return res.status(400).json({ success: false, message: 'Only completed (Checked Out) bookings can be rated' });
    }

    const [exist] = await conn.query('SELECT id FROM ratings WHERE booking_id = ? LIMIT 1', [booking_id]);
    if (exist && exist.length > 0) {
      conn.release();
      return res.status(409).json({ success: false, message: 'This booking has already been rated' });
    }

    const insertQ = `INSERT INTO ratings (booking_id, user_id, room_number, room_type, rating, comment, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, NOW())`;
    const params = [booking_id, user_id, booking.room_number || null, booking.room_type || null, r, comment || null];
    const [result] = await conn.query(insertQ, params);

    conn.release();
    res.json({ success: true, message: 'Rating submitted', ratingId: result.insertId });
  } catch (err) {
    if (conn) conn.release();
    console.error('Error creating rating:', err);
    return res.status(500).json({ success: false, message: 'Could not submit rating' });
  }
});

app.get('/api/ratings/booking/:bookingId', async (req, res) => {
  const { bookingId } = req.params;
  try {
    const [rows] = await db.promise().query('SELECT id, booking_id, user_id, room_number, room_type, rating, comment, created_at FROM ratings WHERE booking_id = ? LIMIT 1', [bookingId]);
    if (!rows || rows.length === 0) return res.json({ success: true, rating: null });
    return res.json({ success: true, rating: rows[0] });
  } catch (err) {
    console.error('Error fetching rating:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

app.get('/api/ratings/summary', async (req, res) => {
  const { room_type, room_number } = req.query;
  try {
    let where = '';
    const params = [];
    if (room_number) {
      where = 'WHERE room_number = ?';
      params.push(room_number);
    } else if (room_type) {
      where = 'WHERE room_type = ?';
      params.push(room_type);
    }
    const q = `SELECT COUNT(*) AS count, AVG(rating) AS avg_rating FROM ratings ${where}`;
    const [rows] = await db.promise().query(q, params);
    return res.json({ success: true, summary: rows[0] || { count: 0, avg_rating: null } });
  } catch (err) {
    console.error('Error fetching ratings summary:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Dashboard summary metrics
app.get('/api/dashboard/summary', async (req, res) => {
  try {
    // 1) Checkins today: bookings with checkin_date = today and status 'Checked In'
    const [checkinsRows] = await db.promise().query(
      `SELECT COUNT(*) AS checkins_today
       FROM bookings
       WHERE DATE(checkin_date) = CURDATE()
         AND status = 'Checked In'`
    );

    // 2) Available rooms
    const [roomsRows] = await db.promise().query(
      `SELECT COUNT(*) AS available_rooms FROM rooms WHERE status = 'Available'`
    );

    // 3) Pending bookings (either booking status pending or receptionist has not accepted yet)
    const [pendingRows] = await db.promise().query(
      `SELECT COUNT(*) AS pending_bookings
       FROM bookings
       WHERE status = 'Pending' OR receptionist_status = 'pending'`
    );

    // 4) Current guests (bookings currently checked in)
    const [currentRows] = await db.promise().query(
      `SELECT COUNT(*) AS current_guests
       FROM bookings
       WHERE status = 'Checked In'`
    );

    const result = {
      checkins_today: (checkinsRows && checkinsRows[0] && Number(checkinsRows[0].checkins_today)) || 0,
      available_rooms: (roomsRows && roomsRows[0] && Number(roomsRows[0].available_rooms)) || 0,
      pending_bookings: (pendingRows && pendingRows[0] && Number(pendingRows[0].pending_bookings)) || 0,
      current_guests: (currentRows && currentRows[0] && Number(currentRows[0].current_guests)) || 0
    };

    return res.json({ success: true, summary: result });
  } catch (err) {
    console.error('Error fetching dashboard summary:', err);
    return res.status(500).json({ success: false, message: 'Database error fetching dashboard summary' });
  }
});

// Lightweight admin guard (same style as requireReceptionist)
async function requireAdmin(req, res, next) {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ success: false, message: 'Missing x-user-id header' });

    const [rows] = await db.promise().query('SELECT role, status FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!rows || rows.length === 0) return res.status(401).json({ success: false, message: 'User not found' });

    const user = rows[0];
    if (user.role !== 'Admin') return res.status(403).json({ success: false, message: 'Forbidden: admin role required' });
    if (user.status !== 'Accepted') return res.status(403).json({ success: false, message: `User status is ${user.status}` });

    req.authUser = { id: Number(userId), role: user.role };
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    return res.status(500).json({ success: false, message: 'Server error validating admin' });
  }
}

// Dashboard stats used by admin front-end
app.get('/api/dashboard/stats', requireAdmin, async (req, res) => {
  try {
    // first day of current month and first day of next month for range
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // format as YYYY-MM-DD for MySQL
    const fmt = (d) => d.toISOString().slice(0, 10);
    const startStr = fmt(start);
    const endStr = fmt(end);

    const totalRoomsQ = 'SELECT COUNT(*) AS total FROM rooms';
    const occupiedRoomsQ = "SELECT COUNT(*) AS occupied FROM rooms WHERE status = 'Occupied'";
    const currentGuestsQ = "SELECT COUNT(*) AS guests FROM bookings WHERE status = 'Checked In'";
    const monthlyRevenueQ = `
      SELECT COALESCE(SUM(amount), 0) AS revenue
      FROM payments
      WHERE status = 'Paid'
        AND DATE(payment_date) >= ?
        AND DATE(payment_date) < ?
    `;

    // run queries in parallel and extract rows correctly
    const [totalRows] = await db.promise().query(totalRoomsQ);
    const [occupiedRows] = await db.promise().query(occupiedRoomsQ);
    const [guestsRows] = await db.promise().query(currentGuestsQ);
    const [revenueRows] = await db.promise().query(monthlyRevenueQ, [startStr, endStr]);

    const total = (totalRows && totalRows[0] && Number(totalRows[0].total)) || 0;
    const occupied = (occupiedRows && occupiedRows[0] && Number(occupiedRows[0].occupied)) || 0;
    const guests = (guestsRows && guestsRows[0] && Number(guestsRows[0].guests)) || 0;
    const revenue = (revenueRows && revenueRows[0] && Number(revenueRows[0].revenue)) || 0;

    res.json({
      success: true,
      stats: {
        total_rooms: total,
        occupied_rooms: occupied,
        current_guests: guests,
        monthly_revenue: revenue
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    return res.status(500).json({ success: false, message: 'Error fetching dashboard stats' });
  }
});

// Rooms CRUD for Admin

// Create room
app.post('/api/rooms', requireAdmin, async (req, res) => {
  const {
    room_number, room_type, price, status,
    amenities, description, image_data, capacity, floor_number, size_sqm
  } = req.body;

  if (!room_number || !room_type) {
    return res.status(400).json({ success: false, message: 'room_number and room_type are required' });
  }

  try {
    // If your DB has column 'image_url' map image_data -> image_url
    const query = `
      INSERT INTO rooms (room_number, room_type, price, image_url, amenities, description, status, capacity, floor_number, size_sqm, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const [result] = await db.promise().query(query, [
      room_number,
      room_type,
      (price !== undefined && price !== null) ? Number(price) : 0,
      image_data || null,
      amenities || null,
      description || null,
      status || 'Available',
      capacity || null,
      floor_number || null,
      size_sqm || null
    ]);

    res.json({ success: true, message: 'Room created', roomId: result.insertId });
  } catch (err) {
    console.error('Error creating room:', err);
    return res.status(500).json({ success: false, message: 'Error creating room' });
  }
});

// Update room
app.put('/api/rooms/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    room_number, room_type, price, status,
    amenities, description, image_data, capacity, floor_number, size_sqm
  } = req.body;

  try {
    // Build update dynamically for safety
    const fields = [];
    const params = [];

    if (room_number !== undefined) { fields.push('room_number = ?'); params.push(room_number); }
    if (room_type !== undefined) { fields.push('room_type = ?'); params.push(room_type); }
    if (price !== undefined) { fields.push('price = ?'); params.push(Number(price)); }
    if (image_data !== undefined) { fields.push('image_url = ?'); params.push(image_data); }
    if (amenities !== undefined) { fields.push('amenities = ?'); params.push(amenities); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }
    if (capacity !== undefined) { fields.push('capacity = ?'); params.push(capacity); }
    if (floor_number !== undefined) { fields.push('floor_number = ?'); params.push(floor_number); }
    if (size_sqm !== undefined) { fields.push('size_sqm = ?'); params.push(size_sqm); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(id);
    const updateQ = `UPDATE rooms SET ${fields.join(', ')} WHERE id = ?`;
    const [result] = await db.promise().query(updateQ, params);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Room not found' });

    res.json({ success: true, message: 'Room updated' });
  } catch (err) {
    console.error('Error updating room:', err);
    return res.status(500).json({ success: false, message: 'Error updating room' });
  }
});

// Delete room
app.delete('/api/rooms/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.promise().query('DELETE FROM rooms WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Room not found or already deleted' });
    res.json({ success: true, message: 'Room deleted' });
  } catch (err) {
    console.error('Error deleting room:', err);
    return res.status(500).json({ success: false, message: 'Error deleting room' });
  }
});
// Fetch and render average rating (global)
async function loadAverageRating() {
  try {
    // The /api/ratings/summary endpoint accepts optional room_type or room_number.
    // Calling without query returns global summary.
    const res = await apiFetch(`${API_URL}/ratings/summary`);
    if (!res || !res.success) {
      document.getElementById('report-rating').textContent = '- / 5';
      return;
    }

    const summary = res.summary || { count: 0, avg_rating: null };
    const avg = summary.avg_rating ? Number(summary.avg_rating).toFixed(1) : '-';
    document.getElementById('report-rating').textContent = `${avg} / 5`;

    // Optional: render stars (rounded to nearest 0.5)
    const starsContainer = document.getElementById('report-rating-stars');
    starsContainer.innerHTML = '';
    if (summary.avg_rating) {
      const value = Math.round(Number(summary.avg_rating) * 2) / 2; // nearest 0.5
      const fullStars = Math.floor(value);
      const halfStar = (value - fullStars) === 0.5;
      let starsHtml = '';
      for (let i = 0; i < fullStars; i++) starsHtml += '<i class="fa-solid fa-star"></i>';
      if (halfStar) starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';
      for (let i = fullStars + (halfStar ? 1 : 0); i < 5; i++) starsHtml += '<i class="fa-regular fa-star"></i>';
      starsContainer.innerHTML = `<div style="color:#f1c40f; font-size:14px;">${starsHtml}</div>`;
    } else {
      starsContainer.innerHTML = '<small style="color:#777;">No ratings yet</small>';
    }
  } catch (err) {
    console.error('Error loading average rating:', err);
    document.getElementById('report-rating').textContent = '- / 5';
    document.getElementById('report-rating-stars').innerHTML = '';
  }
}

    
app.use('/api', (req, res, next) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// =================================================================
// SERVE FRONTEND (static)
// =================================================================

app.use(express.static(path.join(__dirname, '..', 'frontend'), {
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
    else if (filepath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
    else if (filepath.endsWith('.html')) res.setHeader('Content-Type', 'text/html');
  }
}));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

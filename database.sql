-- Create Database
CREATE DATABASE IF NOT EXISTS hotel_db;
USE hotel_db;

-- Users Table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('Admin', 'Receptionist', 'Guest') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookings Table
CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  guest_name VARCHAR(100) NOT NULL,
  room_number VARCHAR(10) NOT NULL,
  room_type VARCHAR(50) NOT NULL,
  checkin_date DATE NOT NULL,
  checkout_date DATE NOT NULL,
  status ENUM('Pending', 'Checked In', 'Checked Out', 'Cancelled') DEFAULT 'Pending',
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Payments Table
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT,
  room_type VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('Paid', 'Pending', 'Refunded') DEFAULT 'Paid',
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- Updated Rooms Table with additional fields
CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(10) UNIQUE NOT NULL,
  room_type VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  status ENUM('Available', 'Occupied', 'Maintenance') DEFAULT 'Available',
  description TEXT,
  capacity INT DEFAULT 1,
  amenities TEXT,
  size_sqm DECIMAL(10, 2),
  floor_number INT,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert Default Users
INSERT INTO users (username, password, role) VALUES 
('admin', '$2b$10$rBV2Q9u5LxW6Y7YJYvZ8/.EqX5WZkXqGxJmJZQvK6LGmFqJQqK7Iq', 'Admin'),
('reception1', '$2b$10$rBV2Q9u5LxW6Y7YJYvZ8/.EqX5WZkXqGxJmJZQvK6LGmFqJQqK7Iq', 'Receptionist'),
('guest1', '$2b$10$rBV2Q9u5LxW6Y7YJYvZ8/.EqX5WZkXqGxJmJZQvK6LGmFqJQqK7Iq', 'Guest');

-- Insert Sample Rooms with enhanced details
INSERT INTO rooms (room_number, room_type, price, status, description, capacity, amenities, size_sqm, floor_number, image_url) VALUES
('101', 'Single Room', 50.00, 'Available', 'Cozy single room with garden view', 1, 'WiFi,AC,TV,Mini Fridge', 20.00, 1, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304'),
('102', 'Single Room', 50.00, 'Occupied', 'Comfortable single room near elevator', 1, 'WiFi,AC,TV', 18.00, 1, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304'),
('103', 'Single Room', 50.00, 'Available', 'Bright single room with workspace', 1, 'WiFi,AC,TV,Desk', 22.00, 1, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304'),
('104', 'Single Room', 50.00, 'Available', 'Single room with balcony', 1, 'WiFi,AC,TV,Balcony', 25.00, 1, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304'),
('105', 'Single Room', 50.00, 'Available', 'Standard single room', 1, 'WiFi,AC,TV', 20.00, 1, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304'),
('201', 'Double Room', 80.00, 'Occupied', 'Spacious double room with city view', 2, 'WiFi,AC,TV,Mini Fridge,Coffee Maker', 35.00, 2, 'https://images.unsplash.com/photo-1618773928121-c32242e63f39'),
('202', 'Double Room', 80.00, 'Available', 'Modern double room with two beds', 2, 'WiFi,AC,TV,Safe', 32.00, 2, 'https://images.unsplash.com/photo-1618773928121-c32242e63f39'),
('203', 'Double Room', 80.00, 'Occupied', 'Double room with workspace', 2, 'WiFi,AC,TV,Desk,Mini Fridge', 34.00, 2, 'https://images.unsplash.com/photo-1618773928121-c32242e63f39'),
('301', 'Suite', 120.00, 'Occupied', 'Luxury suite with separate living area', 3, 'WiFi,AC,Smart TV,Mini Bar,Coffee Machine,Bathtub,Balcony', 55.00, 3, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b'),
('302', 'Suite', 120.00, 'Occupied', 'Premium suite with ocean view', 3, 'WiFi,AC,Smart TV,Mini Bar,Jacuzzi,Balcony', 60.00, 3, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b'),
('303', 'Suite', 120.00, 'Available', 'Executive suite with panoramic view', 4, 'WiFi,AC,Smart TV,Mini Bar,Coffee Machine,Bathtub,Balcony,Kitchen', 65.00, 3, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b');

-- Insert Sample Bookings
INSERT INTO bookings (user_id, guest_name, room_number, room_type, checkin_date, checkout_date, status, phone) VALUES
(3, 'Pablo Jobs', '102', 'Single Room', '2025-11-11', '2025-11-13', 'Checked In', '+63 912-345-6789'),
(3, 'Marie Juana', '301', 'Suite', '2025-11-10', '2025-11-14', 'Checked In', '+63 923-456-7890'),
(3, 'Guest1', '203', 'Double Room', '2025-11-09', '2025-11-12', 'Checked In', '+63 934-567-8901'),
(3, 'Mary Johnson', '201', 'Double Room', '2025-11-12', '2025-11-15', 'Pending', '+63 956-789-0123');

-- Insert Sample Payments
INSERT INTO payments (booking_id, room_type, amount, payment_method, status) VALUES
(1, 'Single Room', 100.00, 'Visa', 'Paid'),
(2, 'Suite', 480.00, 'GCash', 'Paid'),
(3, 'Double Room', 240.00, 'MasterCard', 'Paid'),
(4, 'Double Room', 240.00, 'GCash', 'Pending');
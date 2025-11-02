const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// --- MIDDLEWARE ---k                
app.use(cors());
app.use(express.json());

// JWT Secret (in production, use environment variable)
const JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';

// Admin credentials (in production, store in database with hashed passwords)
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

// --- DATABASE CONNECTION ---
// IMPORTANT: Replace with your actual database credentials
const db = mysql.createPool({
   host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  //10122004
  ssl: {
    rejectUnauthorized: false
  }
}).promise();

// --- DATABASE TABLE SETUP ---
async function setupDatabase() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await db.query(createTableQuery);
    console.log("Successfully connected to MySQL and ensured 'contacts' table exists.");
  } catch (error) {
    console.error("Error setting up database:", error);
  }
}

// --- MIDDLEWARE FUNCTIONS ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// --- API ROUTES ---

// GET: Fetch all contact messages for the admin panel (public route for contact form)
app.get('/api/contacts', async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM contacts ORDER BY submitted_at DESC");
    res.status(200).json(results);
  } catch (error) {
    console.error("Failed to fetch contacts:", error);
    res.status(500).json({ message: "Error fetching contact messages" });
  }
});

// POST: Submit a new contact message
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;

  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const query = "INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)";
    await db.query(query, [name, email, message]);
    res.status(201).json({ message: "Message received successfully!" });
  } catch (error) {
    console.error("Failed to insert contact:", error);
    res.status(500).json({ message: "Error saving your message" });
  }
});

// --- ADMIN AUTHENTICATION ROUTES ---

// POST: Admin login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    const token = jwt.sign(
      { username: username, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.status(200).json({ 
      message: 'Login successful',
      token: token,
      user: { username: username, role: 'admin' }
    });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// GET: Verify admin token
app.get('/api/admin/verify', authenticateToken, (req, res) => {
  res.status(200).json({ 
    message: 'Token is valid',
    user: req.user
  });
});

// GET: Fetch all contact messages for admin dashboard (protected route)
app.get('/api/admin/contacts', authenticateToken, async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM contacts ORDER BY submitted_at DESC");
    res.status(200).json(results);
  } catch (error) {
    console.error("Failed to fetch contacts:", error);
    res.status(500).json({ message: "Error fetching contact messages" });
  }
});

// --- START SERVER ---
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  setupDatabase();
});

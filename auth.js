const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('./db');

// Middleware to check if user is logged in
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

// Middleware to check if user is admin
function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
}

// Register Route
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const cleanUsername = username.toLowerCase().trim();
  const cleanEmail = email.toLowerCase().trim();

  // Username validation (alphanumeric and underscores, length 3-20)
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(cleanUsername)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores.' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [cleanUsername, cleanEmail]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Username or email is already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Bootstrap first user to be admin for testing, else regular user
    const usersCount = await db.query('SELECT COUNT(*) as count FROM users');
    const role = usersCount[0].count === 0 ? 'admin' : 'user';

    const result = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [cleanUsername, cleanEmail, passwordHash, role]
    );

    const userId = result.insertId;

    // Create empty profile
    await db.query(
      'INSERT INTO profiles (user_id, name, bio, avatar_url, theme_id, social_links) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, username.trim(), 'Welcome to my links page!', '', 'glass-dark', '{}']
    );

    // Set Session properties
    req.session.userId = userId;
    req.session.username = cleanUsername;
    req.session.role = role;

    return res.status(201).json({
      message: 'Registration successful.',
      user: { id: userId, username: cleanUsername, role }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  const { loginIdentifier, password } = req.body;

  if (!loginIdentifier || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const cleanIdentifier = loginIdentifier.toLowerCase().trim();

  try {
    const users = await db.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [cleanIdentifier, cleanIdentifier]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    const user = users[0];

    // Verify password hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    // Set Session properties
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    return res.json({
      message: 'Login successful.',
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

// Logout Route
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out. Please try again.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ message: 'Logout successfully.' });
  });
});

// Auth Status check Route
router.get('/status', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      loggedIn: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role
      }
    });
  }
  return res.json({ loggedIn: false });
});

module.exports = {
  router,
  requireAuth,
  requireAdmin
};

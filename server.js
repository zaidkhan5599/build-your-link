const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const db = require('./db');
const auth = require('./auth');
const apiRouter = require('./api');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup (stored in memory for easy local deployment)
app.use(session({
  secret: process.env.SESSION_SECRET || 'liinks-local-dev-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    secure: false, // Set to true in HTTPS production
    sameSite: 'lax'
  }
}));

// Route Debug logger (optional, helpful for verifying requests)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// API Routes
app.use('/api/auth', auth.router);
app.use('/api', apiRouter);

// Serve static assets first from /public directory
app.use(express.static(path.join(__dirname, 'public')));

// Dynamic Public Profile router (e.g. localhost:3000/johndoe)
const systemRoutes = ['login', 'register', 'dashboard', 'admin', 'api', 'css', 'js', 'favicon.ico', 'assets'];

app.get('/:username', async (req, res, next) => {
  const username = req.params.username.toLowerCase().trim();

  // Skip system routes and files with extensions
  if (systemRoutes.includes(username) || username.includes('.')) {
    return next();
  }

  try {
    // Check if user exists
    const users = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    
    if (users.length > 0) {
      // Serve the generic public profile template (client-side JS handles hydration)
      return res.sendFile(path.join(__dirname, 'public', 'profile.html'));
    } else {
      // User does not exist, serve custom 404 page
      return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
  } catch (error) {
    console.error('Server dynamic page error:', error);
    return res.status(500).send('Internal Server Error');
  }
});

// Default catch-all redirects to home
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize connection and start listening (only when run directly)
db.dbInitialized.then(() => {
  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(` Build Your Link Server Running on http://localhost:${PORT}`);
      console.log(`==================================================`);
    });
  }
}).catch(err => {
  console.error('Failed to start server due to database error:', err);
});

module.exports = app;

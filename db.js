const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

const dbName = process.env.DB_NAME || 'liinks_db';

let pool;

async function initDB() {
  try {
    // 1. Connect without database to verify / create it
    console.log(`Connecting to local MySQL at ${dbConfig.host}:${dbConfig.port}...`);
    const connection = await mysql.createConnection(dbConfig);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.end();

    // 2. Re-connect with target database in connection pool
    pool = mysql.createPool({
      ...dbConfig,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log(`Connected to MySQL database "${dbName}"`);

    // 3. Create tables
    await createTables();
  } catch (error) {
    console.error('Error initializing MySQL database:', error);
    console.error('Please ensure your local MySQL server is running and credentials in .env are correct.');
    process.exit(1);
  }
}

async function createTables() {
  const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `;

  const profilesTable = `
    CREATE TABLE IF NOT EXISTS profiles (
      user_id INT PRIMARY KEY,
      name VARCHAR(100),
      bio TEXT,
      avatar_url TEXT,
      theme_id VARCHAR(50) DEFAULT 'glass-dark',
      social_links TEXT, -- JSON string containing links
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `;

  const linksTable = `
    CREATE TABLE IF NOT EXISTS links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(150) NOT NULL,
      url TEXT NOT NULL,
      sort_order INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `;

  const analyticsTable = `
    CREATE TABLE IF NOT EXISTS analytics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      link_id INT NULL,
      event_type ENUM('view', 'click') NOT NULL,
      ip_hash VARCHAR(64),
      referrer TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
  `;

  await pool.query(usersTable);
  await pool.query(profilesTable);
  await pool.query(linksTable);
  await pool.query(analyticsTable);

  console.log('Database tables verified/created successfully.');
}

// Initialization Promise
const dbInitialized = initDB();

// Helper query function that awaits DB initialization
async function query(sql, params) {
  await dbInitialized;
  const [results] = await pool.execute(sql, params);
  return results;
}

module.exports = {
  query,
  dbInitialized
};

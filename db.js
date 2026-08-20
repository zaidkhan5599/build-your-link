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

  // Execute try-catch schema upgrades safely
  await runMigrations();

  console.log('Database tables verified/created successfully.');
}

async function runMigrations() {
  console.log('Checking database migrations...');
  
  // 1. Links: type block type column
  try {
    await pool.query("ALTER TABLE links ADD COLUMN type VARCHAR(30) DEFAULT 'link'");
    console.log('-> Migrated links: added type column');
  } catch (e) {
    // Ignore duplicate column errors
  }

  // 2. Profiles: font family
  try {
    await pool.query("ALTER TABLE profiles ADD COLUMN font_family VARCHAR(50) DEFAULT 'Outfit'");
    console.log('-> Migrated profiles: added font_family column');
  } catch (e) {}

  // 3. Profiles: bg type
  try {
    await pool.query("ALTER TABLE profiles ADD COLUMN bg_type VARCHAR(20) DEFAULT 'preset'");
    console.log('-> Migrated profiles: added bg_type column');
  } catch (e) {}

  // 4. Profiles: custom bg string
  try {
    await pool.query("ALTER TABLE profiles ADD COLUMN custom_bg VARCHAR(255) DEFAULT ''");
    console.log('-> Migrated profiles: added custom_bg column');
  } catch (e) {}

  // 5. Profiles: button corners shape
  try {
    await pool.query("ALTER TABLE profiles ADD COLUMN btn_shape VARCHAR(30) DEFAULT 'rounded'");
    console.log('-> Migrated profiles: added btn_shape column');
  } catch (e) {}

  // 6. Profiles: button styling style
  try {
    await pool.query("ALTER TABLE profiles ADD COLUMN btn_style VARCHAR(30) DEFAULT 'solid'");
    console.log('-> Migrated profiles: added btn_style column');
  } catch (e) {}

  // 7. Profiles: layout mode choice
  try {
    await pool.query("ALTER TABLE profiles ADD COLUMN layout_mode VARCHAR(30) DEFAULT 'mobile-card'");
    console.log('-> Migrated profiles: added layout_mode column');
  } catch (e) {}

  // 8. Users: first_name, last_name, mobile_number attributes
  try {
    await pool.query("ALTER TABLE users ADD COLUMN first_name VARCHAR(100) DEFAULT ''");
    console.log('-> Migrated users: added first_name column');
  } catch (e) {}

  try {
    await pool.query("ALTER TABLE users ADD COLUMN last_name VARCHAR(100) DEFAULT ''");
    console.log('-> Migrated users: added last_name column');
  } catch (e) {}

  try {
    await pool.query("ALTER TABLE users ADD COLUMN mobile_number VARCHAR(50) DEFAULT ''");
    console.log('-> Migrated users: added mobile_number column');
  } catch (e) {}
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

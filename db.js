const mysql = require('mysql2/promise');
const { Pool, types } = require('pg');
require('dotenv').config();

// Configure PG types to parse INT8 (bigint, OID 20) as integer.
// This ensures COUNT(*) returns numbers instead of strings.
types.setTypeParser(20, (val) => parseInt(val, 10));

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const isPostgres = !!(
  process.env.VERCEL === '1' ||
  process.env.DB_DIALECT === 'postgres' ||
  (connectionString && (connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://'))) ||
  process.env.POSTGRES_HOST ||
  process.env.POSTGRES_USER
);
const dialect = isPostgres ? 'postgres' : 'mysql';

const ssl = (connectionString || process.env.DB_SSL === 'true')
  ? { rejectUnauthorized: false }
  : false;

let pool;

async function initDB() {
  console.log(`Database initialization started. Active dialect: ${dialect.toUpperCase()}`);
  if (dialect === 'postgres') {
    try {
      const config = connectionString
        ? { connectionString, ssl }
        : {
            host: process.env.POSTGRES_HOST || process.env.DB_HOST || '127.0.0.1',
            port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432'),
            user: process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
            password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || '',
            database: process.env.POSTGRES_DATABASE || process.env.DB_NAME || 'postgres',
            ssl
          };

      if (connectionString) {
        console.log('Connecting to PostgreSQL database using connection string...');
      } else {
        console.log(`Connecting to PostgreSQL database at ${config.host}:${config.port}/${config.database}...`);
      }
      pool = new Pool(config);

      // Test connection
      const client = await pool.connect();
      console.log('Connected to PostgreSQL successfully.');
      client.release();

      // Create tables
      await createTablesPostgres();
    } catch (error) {
      console.error('Error initializing PostgreSQL database:', error);
      console.error('Please ensure your database server is running and credentials in .env are correct.');
      process.exit(1);
    }
  } else {
    // MySQL
    try {
      const dbConfig = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
      };

      const dbName = process.env.DB_NAME || 'liinks_db';

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
      await createTablesMySQL();
    } catch (error) {
      console.error('Error initializing MySQL database:', error);
      console.error('Please ensure your local MySQL server is running and credentials in .env are correct.');
      process.exit(1);
    }
  }
}

async function createTablesMySQL() {
  const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      first_name VARCHAR(100) DEFAULT '',
      last_name VARCHAR(100) DEFAULT '',
      mobile_number VARCHAR(50) DEFAULT '',
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
      social_links TEXT,
      font_family VARCHAR(50) DEFAULT 'Outfit',
      bg_type VARCHAR(20) DEFAULT 'preset',
      custom_bg VARCHAR(255) DEFAULT '',
      btn_shape VARCHAR(30) DEFAULT 'rounded',
      btn_style VARCHAR(30) DEFAULT 'solid',
      layout_mode VARCHAR(30) DEFAULT 'mobile-card',
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
      type VARCHAR(30) DEFAULT 'link',
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

  await runMigrationsMySQL();
  console.log('MySQL database tables verified/created successfully.');
}

async function createTablesPostgres() {
  const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      first_name VARCHAR(100) DEFAULT '',
      last_name VARCHAR(100) DEFAULT '',
      mobile_number VARCHAR(50) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const profilesTable = `
    CREATE TABLE IF NOT EXISTS profiles (
      user_id INT PRIMARY KEY,
      name VARCHAR(100),
      bio TEXT,
      avatar_url TEXT,
      theme_id VARCHAR(50) DEFAULT 'glass-dark',
      social_links TEXT,
      font_family VARCHAR(50) DEFAULT 'Outfit',
      bg_type VARCHAR(20) DEFAULT 'preset',
      custom_bg VARCHAR(255) DEFAULT '',
      btn_shape VARCHAR(30) DEFAULT 'rounded',
      btn_style VARCHAR(30) DEFAULT 'solid',
      layout_mode VARCHAR(30) DEFAULT 'mobile-card',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;

  const linksTable = `
    CREATE TABLE IF NOT EXISTS links (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(150) NOT NULL,
      url TEXT NOT NULL,
      sort_order INT DEFAULT 0,
      is_active SMALLINT DEFAULT 1,
      type VARCHAR(30) DEFAULT 'link',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;

  const analyticsTable = `
    CREATE TABLE IF NOT EXISTS analytics (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      link_id INT NULL,
      event_type VARCHAR(20) NOT NULL,
      ip_hash VARCHAR(64),
      referrer TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE SET NULL
    );
  `;

  await pool.query(usersTable);
  await pool.query(profilesTable);
  await pool.query(linksTable);
  await pool.query(analyticsTable);

  await runMigrationsPostgres();
  console.log('PostgreSQL database tables verified/created successfully.');
}

async function runMigrationsMySQL() {
  console.log('Checking database migrations for MySQL...');
  
  // 1. Links: type block type column
  try {
    await pool.query("ALTER TABLE links ADD COLUMN type VARCHAR(30) DEFAULT 'link'");
    console.log('-> Migrated links: added type column');
  } catch (e) {
    // Ignore duplicate column errors
  }

  // 2. Profiles: columns
  const profileColumns = [
    { name: 'font_family', type: "VARCHAR(50) DEFAULT 'Outfit'" },
    { name: 'bg_type', type: "VARCHAR(20) DEFAULT 'preset'" },
    { name: 'custom_bg', type: "VARCHAR(255) DEFAULT ''" },
    { name: 'btn_shape', type: "VARCHAR(30) DEFAULT 'rounded'" },
    { name: 'btn_style', type: "VARCHAR(30) DEFAULT 'solid'" },
    { name: 'layout_mode', type: "VARCHAR(30) DEFAULT 'mobile-card'" }
  ];

  for (const col of profileColumns) {
    try {
      await pool.query(`ALTER TABLE profiles ADD COLUMN ${col.name} ${col.type}`);
      console.log(`-> Migrated profiles: added ${col.name} column`);
    } catch (e) {
      // Ignore duplicate column errors
    }
  }

  // 3. Users: columns
  const userColumns = [
    { name: 'first_name', type: "VARCHAR(100) DEFAULT ''" },
    { name: 'last_name', type: "VARCHAR(100) DEFAULT ''" },
    { name: 'mobile_number', type: "VARCHAR(50) DEFAULT ''" }
  ];

  for (const col of userColumns) {
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
      console.log(`-> Migrated users: added ${col.name} column`);
    } catch (e) {
      // Ignore duplicate column errors
    }
  }
}

async function runMigrationsPostgres() {
  console.log('Checking database migrations for PostgreSQL...');
  
  // 1. Links: type block type column
  try {
    await pool.query("ALTER TABLE links ADD COLUMN IF NOT EXISTS type VARCHAR(30) DEFAULT 'link'");
    console.log('-> Migrated links: added type column');
  } catch (e) {
    console.error('Migration failed for links.type:', e.message);
  }

  // 2. Profiles columns
  const profileColumns = [
    { name: 'font_family', type: "VARCHAR(50) DEFAULT 'Outfit'" },
    { name: 'bg_type', type: "VARCHAR(20) DEFAULT 'preset'" },
    { name: 'custom_bg', type: "VARCHAR(255) DEFAULT ''" },
    { name: 'btn_shape', type: "VARCHAR(30) DEFAULT 'rounded'" },
    { name: 'btn_style', type: "VARCHAR(30) DEFAULT 'solid'" },
    { name: 'layout_mode', type: "VARCHAR(30) DEFAULT 'mobile-card'" }
  ];

  for (const col of profileColumns) {
    try {
      await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      console.log(`-> Migrated profiles: added ${col.name} column`);
    } catch (e) {
      console.error(`Migration failed for profiles.${col.name}:`, e.message);
    }
  }

  // 3. Users columns
  const userColumns = [
    { name: 'first_name', type: "VARCHAR(100) DEFAULT ''" },
    { name: 'last_name', type: "VARCHAR(100) DEFAULT ''" },
    { name: 'mobile_number', type: "VARCHAR(50) DEFAULT ''" }
  ];

  for (const col of userColumns) {
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      console.log(`-> Migrated users: added ${col.name} column`);
    } catch (e) {
      console.error(`Migration failed for users.${col.name}:`, e.message);
    }
  }
}

// Initialization Promise
const dbInitialized = initDB();

// Compatibility wrapper for queries:
// Translates MySQL "?" placeholders to PostgreSQL "$1", "$2", etc.
// Enriches returned array with .insertId and .affectedRows.
async function query(sql, params = []) {
  await dbInitialized;

  if (dialect === 'postgres') {
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    if (pgSql.trim().toUpperCase().startsWith('INSERT')) {
      if (!pgSql.toUpperCase().includes('RETURNING')) {
        pgSql += ' RETURNING *';
      }
    }

    const result = await pool.query(pgSql, params);
    const rows = result.rows || [];

    // Determine insert ID if any rows returned
    let insertId = null;
    if (rows[0]) {
      const firstRow = rows[0];
      insertId = firstRow.id || firstRow.user_id || Object.values(firstRow)[0];
    }

    rows.insertId = insertId ? parseInt(insertId, 10) : null;
    rows.affectedRows = result.rowCount;

    return rows;
  } else {
    // MySQL
    const [results] = await pool.execute(sql, params);
    return results;
  }
}

module.exports = {
  query,
  dbInitialized,
  dialect
};

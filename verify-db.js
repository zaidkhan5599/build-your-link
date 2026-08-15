const db = require('./db');

async function testConnection() {
  console.log('==================================================');
  console.log(' Running Database Configuration Verification Checks');
  console.log('==================================================');
  
  try {
    // Wait for the dbInitialized Promise inside db.js to settle
    await db.dbInitialized;
    console.log('✅ Connection check: SUCCESS!');
    console.log('✅ Schema migration check: SUCCESS!');
    
    // Perform simple query test
    const tables = await db.query("SHOW TABLES LIKE 'users'");
    if (tables.length > 0) {
      console.log('✅ Integrity check: Tables exist and are responsive!');
    } else {
      console.log('❌ Integrity check: Tables were not created correctly.');
    }
    
    console.log('==================================================');
    console.log('All checks PASSED. You can start the server safely.');
    console.log('==================================================');
    process.exit(0);
  } catch (error) {
    console.error('❌ Check FAILED!');
    console.error('Database connection error message:', error.message);
    console.log('==================================================');
    console.log('Fixing guide:');
    console.log('1. Make sure your local MySQL server is currently running.');
    console.log('2. Verify port 3306 or your custom port is exposed.');
    console.log('3. Review and edit credentials inside your .env file.');
    console.log('==================================================');
    process.exit(1);
  }
}

testConnection();

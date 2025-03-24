
const mysql = require('mysql2/promise');

// Database connection configuration
let pool = null;
let isDbConnected = false;

// Initialize database connection pool
const initDatabase = async () => {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'chat_assistant',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    console.log('Database pool initialized');
    
    // Verify connection
    const connection = await pool.getConnection();
    console.log('Database connected successfully');
    connection.release();
    
    // Create required tables
    await createTables();
    
    isDbConnected = true;
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    isDbConnected = false;
    return false;
  }
};

// Create necessary tables if they don't exist
const createTables = async () => {
  if (!pool) return;
  
  try {
    // Widget config table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS widget_config (
        id INT PRIMARY KEY,
        position VARCHAR(20) NOT NULL,
        title VARCHAR(100) NOT NULL,
        subtitle VARCHAR(255) NOT NULL,
        primary_color VARCHAR(20) NOT NULL,
        icon_type VARCHAR(20) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Agent config table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_config (
        id INT PRIMARY KEY,
        system_prompt TEXT NOT NULL,
        voice_enabled BOOLEAN DEFAULT true,
        voice_id VARCHAR(50) NOT NULL,
        voice_language VARCHAR(10) NOT NULL,
        voice_latency INT DEFAULT 100,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Agent functions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_functions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        parameters JSON NOT NULL,
        webhook VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Training files table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS training_files (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        size INT NOT NULL,
        type VARCHAR(100) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Conversations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(36) PRIMARY KEY,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(36) PRIMARY KEY,
        conversation_id VARCHAR(36) NOT NULL,
        role ENUM('user', 'assistant', 'system') NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `);
    
    // Admin config table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_config (
        id INT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        password_hash VARCHAR(100) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Database tables created/verified');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
};

// Get database connection
const getDbConnection = () => {
  return pool;
};

// Check if database is connected
const isConnected = () => {
  return isDbConnected;
};

module.exports = {
  initDatabase,
  getDbConnection,
  isConnected
};

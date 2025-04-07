const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Database connection configuration
let pool = null;
let isDbConnected = false;
let lastConnectionError = null;

// Ensure data directory exists
const ensureDataDirectory = () => {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    console.log('Creating data directory');
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
};

// Get database configuration based on environment
const getDbConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  console.log(`Current environment: ${env}`);

  if (env === 'production') {
    return {
      host: process.env.PROD_DB_HOST || 'localhost',
      user: process.env.PROD_DB_USER || 'root',
      password: process.env.PROD_DB_PASSWORD || '',
      database: process.env.PROD_DB_NAME || 'chat_assistant'
    };
  } else {
    return {
      host: process.env.DEV_DB_HOST || 'localhost',
      user: process.env.DEV_DB_USER || 'root',
      password: process.env.DEV_DB_PASSWORD || '',
      database: process.env.DEV_DB_NAME || 'chat_assistant'
    };
  }
};

// Initialize database connection pool
const initDatabase = async () => {
  try {
    // Ensure the data directory exists for fallback storage
    ensureDataDirectory();
    
    const dbConfig = getDbConfig();
    console.log('Initializing database connection with the following parameters:');
    console.log('Host:', dbConfig.host);
    console.log('User:', dbConfig.user);
    console.log('Database:', dbConfig.database);
    
    // Create database connection pool
    pool = mysql.createPool({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
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
    lastConnectionError = null;
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    lastConnectionError = error;
    
    // More detailed error logging depending on error type
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('ACCESS DENIED: Check your username and password');
      console.error('Make sure to update the .env file with correct credentials');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('DATABASE NOT FOUND: The specified database does not exist');
      console.error('Create the database with: CREATE DATABASE chat_assistant;');
      console.error('Or configure a different database name in .env file');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('CONNECTION REFUSED: Make sure your MySQL/MariaDB server is running');
      console.error('Check if the server is running and accessible at the configured host and port');
    }
    
    console.log('Using file-based fallback data storage');
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
    
    // Admin config table - Increased the api_key column size to TEXT
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_config (
        id INT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        password_hash VARCHAR(100) NOT NULL,
        api_key TEXT DEFAULT '',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Check if api_key column exists, if not add it with TEXT type
    try {
      await pool.query(`
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'admin_config' 
        AND COLUMN_NAME = 'api_key'
      `);
      
      // Try to alter the column type to TEXT if it exists
      try {
        console.log('Attempting to increase api_key column size to TEXT');
        await pool.query(`
          ALTER TABLE admin_config
          MODIFY COLUMN api_key TEXT
        `);
        console.log('Successfully increased api_key column size');
      } catch (altError) {
        console.error('Error modifying api_key column:', altError);
      }
    } catch (checkError) {
      console.error('Error checking for api_key column:', checkError);
      
      // Try to add the column if it doesn't exist
      try {
        await pool.query(`
          ALTER TABLE admin_config
          ADD COLUMN api_key TEXT DEFAULT ''
        `);
        console.log('Added api_key column successfully');
      } catch (addError) {
        console.error('Error adding api_key column:', addError);
      }
    }
    
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

// Get last connection error
const getLastConnectionError = () => {
  return lastConnectionError;
};

// Attempt to reconnect to the database
const reconnect = async () => {
  console.log('Attempting to reconnect to the database...');
  return await initDatabase();
};

module.exports = {
  initDatabase,
  getDbConnection,
  isConnected,
  getLastConnectionError,
  reconnect
};

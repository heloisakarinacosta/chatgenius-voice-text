
const express = require('express');
const router = express.Router();
const db = require('../database');
const fs = require('fs');
const path = require('path');

// Ensure data directory exists
const ensureDataDirectory = () => {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    console.log('Creating data directory');
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
};

// Get admin configuration
router.get('/', async (req, res) => {
  try {
    const pool = db.getDbConnection();
    if (!pool) {
      console.log('Database not connected, using fallback file storage');
      // Se não houver conexão com o banco de dados, busque do arquivo local
      const dataDir = ensureDataDirectory();
      const configPath = path.join(dataDir, 'config.json');
      
      if (fs.existsSync(configPath)) {
        try {
          const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          console.log('Admin config loaded from file:', configData);
          return res.json({
            username: configData.username || "admin",
            passwordHash: configData.passwordHash || "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // "admin" - SHA-256 hashed
            apiKey: configData.apiKey || ""
          });
        } catch (fileError) {
          console.error('Error reading config file:', fileError);
        }
      }
      
      // If file doesn't exist or can't be read, return default config
      const defaultConfig = {
        username: "admin",
        passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // "admin" - SHA-256 hashed
        apiKey: ""
      };
      
      // Create the config file with default values
      try {
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log('Created default config file');
      } catch (writeError) {
        console.error('Error creating config file:', writeError);
      }
      
      return res.json(defaultConfig);
    }
    
    const [rows] = await pool.query('SELECT * FROM admin_config WHERE id = 1');
    
    if (rows.length === 0) {
      // Insert default config if not exists
      const defaultConfig = {
        username: "admin",
        password_hash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // "admin" - SHA-256 hashed
        api_key: ""
      };
      
      await pool.query(
        'INSERT INTO admin_config (id, username, password_hash, api_key) VALUES (1, ?, ?, ?)',
        [defaultConfig.username, defaultConfig.password_hash, defaultConfig.api_key]
      );
      
      return res.json({
        username: defaultConfig.username,
        passwordHash: defaultConfig.password_hash,
        apiKey: defaultConfig.api_key
      });
    }
    
    const config = rows[0];
    res.json({
      username: config.username,
      passwordHash: config.password_hash,
      apiKey: config.api_key || ""
    });
  } catch (error) {
    console.error('Error fetching admin config:', error);
    res.status(500).json({ error: 'Failed to fetch admin configuration' });
  }
});

// Update admin configuration
router.put('/', async (req, res) => {
  try {
    const { username, passwordHash, apiKey } = req.body;
    console.log('Updating admin config:', { username, passwordHash, apiKey: apiKey ? 'REDACTED' : '' });
    
    const pool = db.getDbConnection();
    if (!pool) {
      console.log('Database not connected, saving to fallback file storage');
      // Se não houver conexão com o banco de dados, salve no arquivo local
      const dataDir = ensureDataDirectory();
      const configPath = path.join(dataDir, 'config.json');
      
      try {
        const configData = {
          username: username || "admin",
          passwordHash: passwordHash || "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
          apiKey: apiKey || ""
        };
        
        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
        console.log('Admin config saved to file successfully');
        return res.json({ success: true, message: 'Admin configuration saved to file successfully' });
      } catch (fileError) {
        console.error('Error writing to config file:', fileError);
        return res.status(500).json({ error: 'Failed to save admin configuration to file' });
      }
    }
    
    await pool.query(
      'UPDATE admin_config SET username = ?, password_hash = ?, api_key = ? WHERE id = 1',
      [username, passwordHash, apiKey]
    );
    
    console.log('Admin config updated in database successfully');
    res.json({ success: true, message: 'Admin configuration updated successfully' });
  } catch (error) {
    console.error('Error updating admin config:', error);
    res.status(500).json({ error: 'Failed to update admin configuration' });
  }
});

// Get OpenAI API Key for the widget
router.get('/api-key', async (req, res) => {
  try {
    const pool = db.getDbConnection();
    if (!pool) {
      // Se não houver conexão com o banco de dados, busque do arquivo local
      console.log('Database not connected, using fallback file storage for API key');
      const dataDir = ensureDataDirectory();
      const configPath = path.join(dataDir, 'config.json');
      
      try {
        // Tentativa de buscar de um arquivo local de backup
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (config.apiKey) {
            console.log('API key found in config file');
            return res.json({ apiKey: config.apiKey });
          }
        }
        console.log('API key not found in config file');
        // Se não encontrar arquivo local ou não tiver API key, retorne 404
        return res.status(404).json({ error: 'API key not configured' });
      } catch (fileError) {
        console.error('Error reading from local file:', fileError);
        return res.status(404).json({ error: 'API key not configured' });
      }
    }
    
    // Se tiver conexão com banco de dados, busque de lá
    console.log('Fetching API key from database');
    const [rows] = await pool.query('SELECT api_key FROM admin_config WHERE id = 1');
    
    if (rows.length === 0 || !rows[0].api_key) {
      console.log('API key not found in database');
      return res.status(404).json({ error: 'API key not configured' });
    }
    
    console.log('API key found in database');
    res.json({ apiKey: rows[0].api_key });
  } catch (error) {
    console.error('Error fetching API key:', error);
    res.status(500).json({ error: 'Failed to fetch API key' });
  }
});

module.exports = router;

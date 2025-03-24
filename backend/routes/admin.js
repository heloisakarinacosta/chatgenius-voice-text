
const express = require('express');
const router = express.Router();
const db = require('../database');

// Get admin configuration
router.get('/', async (req, res) => {
  try {
    const pool = db.getDbConnection();
    if (!pool) {
      return res.status(503).json({ error: 'Database not connected' });
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
    
    const pool = db.getDbConnection();
    if (!pool) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    await pool.query(
      'UPDATE admin_config SET username = ?, password_hash = ?, api_key = ? WHERE id = 1',
      [username, passwordHash, apiKey]
    );
    
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
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const [rows] = await pool.query('SELECT api_key FROM admin_config WHERE id = 1');
    
    if (rows.length === 0 || !rows[0].api_key) {
      return res.status(404).json({ error: 'API key not configured' });
    }
    
    res.json({ apiKey: rows[0].api_key });
  } catch (error) {
    console.error('Error fetching API key:', error);
    res.status(500).json({ error: 'Failed to fetch API key' });
  }
});

module.exports = router;

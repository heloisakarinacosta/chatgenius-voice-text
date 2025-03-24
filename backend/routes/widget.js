
const express = require('express');
const router = express.Router();
const db = require('../database');

// Get widget configuration
router.get('/', async (req, res) => {
  try {
    const pool = db.getDbConnection();
    if (!pool) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const [rows] = await pool.query('SELECT * FROM widget_config WHERE id = 1');
    
    if (rows.length === 0) {
      // Insert default config if not exists
      const defaultConfig = {
        position: "bottom-right",
        title: "Chat Assistant",
        subtitle: "How can I help you today?",
        primary_color: "#000000",
        icon_type: "chat"
      };
      
      await pool.query(
        'INSERT INTO widget_config (id, position, title, subtitle, primary_color, icon_type) VALUES (1, ?, ?, ?, ?, ?)',
        [defaultConfig.position, defaultConfig.title, defaultConfig.subtitle, defaultConfig.primary_color, defaultConfig.icon_type]
      );
      
      return res.json({
        position: defaultConfig.position,
        title: defaultConfig.title,
        subtitle: defaultConfig.subtitle,
        primaryColor: defaultConfig.primary_color,
        iconType: defaultConfig.icon_type
      });
    }
    
    const config = rows[0];
    res.json({
      position: config.position,
      title: config.title,
      subtitle: config.subtitle,
      primaryColor: config.primary_color,
      iconType: config.icon_type
    });
  } catch (error) {
    console.error('Error fetching widget config:', error);
    res.status(500).json({ error: 'Failed to fetch widget configuration' });
  }
});

// Update widget configuration
router.put('/', async (req, res) => {
  try {
    const { position, title, subtitle, primaryColor, iconType } = req.body;
    
    const pool = db.getDbConnection();
    if (!pool) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    await pool.query(
      'UPDATE widget_config SET position = ?, title = ?, subtitle = ?, primary_color = ?, icon_type = ? WHERE id = 1',
      [position, title, subtitle, primaryColor, iconType]
    );
    
    res.json({ success: true, message: 'Widget configuration updated successfully' });
  } catch (error) {
    console.error('Error updating widget config:', error);
    res.status(500).json({ error: 'Failed to update widget configuration' });
  }
});

module.exports = router;

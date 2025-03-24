
const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Add training file
router.post('/', async (req, res) => {
  try {
    const { name, content, size, type } = req.body;
    const id = req.body.id || uuidv4();
    
    const pool = db.getDbConnection();
    if (!pool) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    await pool.query(
      'INSERT INTO training_files (id, name, content, size, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, content, size, type, new Date()]
    );
    
    res.json({
      success: true,
      message: 'Training file added successfully',
      id
    });
  } catch (error) {
    console.error('Error adding training file:', error);
    res.status(500).json({ error: 'Failed to add training file' });
  }
});

// Remove training file
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const pool = db.getDbConnection();
    if (!pool) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    await pool.query('DELETE FROM training_files WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Training file removed successfully'
    });
  } catch (error) {
    console.error('Error removing training file:', error);
    res.status(500).json({ error: 'Failed to remove training file' });
  }
});

module.exports = router;

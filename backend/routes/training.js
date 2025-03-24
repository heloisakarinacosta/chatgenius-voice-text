
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
      console.log('Database not connected, saving to localStorage fallback');
      return res.json({
        success: true,
        message: 'Training file added successfully (localStorage fallback)',
        id
      });
    }
    
    // Handle DOCX files specially
    let fileContent = content || '';
    let fileType = type || 'text/plain';
    
    // Special handling for docx files
    if (name.endsWith('.docx') || fileType.includes('openxmlformats-officedocument.wordprocessingml.document')) {
      console.log('Processing DOCX file:', name, 'Size:', size);
      // Store the placeholder content as is
      if (!fileContent.includes('[DOCX Document:')) {
        fileContent = `[DOCX Document: ${name}]`;
      }
    }
    
    // Log file details
    console.log(`Saving file: ${name}, Type: ${fileType}, Content length: ${fileContent.length}`);
    
    // Use parameterized query to prevent SQL injection
    await pool.query(
      'INSERT INTO training_files (id, name, content, size, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, fileContent, size || 0, fileType, new Date()]
    );
    
    console.log(`Training file ${name} added successfully with ID: ${id}`);
    res.json({
      success: true,
      message: 'Training file added successfully',
      id
    });
  } catch (error) {
    console.error('Error adding training file:', error);
    res.status(500).json({ 
      error: 'Failed to add training file', 
      details: error.message,
      success: false 
    });
  }
});

// Get all training files
router.get('/', async (req, res) => {
  try {
    const pool = db.getDbConnection();
    if (!pool) {
      console.log('Database not connected, using localStorage fallback for getting training files');
      return res.json([]);
    }
    
    const [rows] = await pool.query('SELECT * FROM training_files ORDER BY timestamp DESC');
    console.log(`Retrieved ${rows.length} training files from database`);
    res.json(rows);
  } catch (error) {
    console.error('Error getting training files:', error);
    res.status(500).json({ 
      error: 'Failed to get training files', 
      details: error.message
    });
  }
});

// Remove training file
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const pool = db.getDbConnection();
    if (!pool) {
      console.log('Database not connected, using localStorage fallback for delete');
      return res.json({
        success: true,
        message: 'Training file removed successfully (localStorage fallback)',
      });
    }
    
    await pool.query('DELETE FROM training_files WHERE id = ?', [id]);
    
    console.log(`Training file ${id} removed successfully`);
    res.json({
      success: true,
      message: 'Training file removed successfully'
    });
  } catch (error) {
    console.error('Error removing training file:', error);
    res.status(500).json({ 
      error: 'Failed to remove training file', 
      details: error.message,
      success: false 
    });
  }
});

module.exports = router;

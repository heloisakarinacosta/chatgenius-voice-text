
const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Get all conversations
router.get('/', async (req, res) => {
  try {
    const pool = db.getDbConnection();
    if (!pool) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const [rows] = await pool.query('SELECT * FROM conversations ORDER BY created_at DESC');
    
    const conversationsWithMessages = await Promise.all(
      rows.map(async (conv) => {
        const [messageRows] = await pool.query(
          'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
          [conv.id]
        );
        
        const messages = messageRows.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp)
        }));
        
        return {
          id: conv.id,
          messages,
          isActive: Boolean(conv.is_active),
          createdAt: new Date(conv.created_at)
        };
      })
    );
    
    res.json(conversationsWithMessages);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Create a new conversation
router.post('/', async (req, res) => {
  try {
    const id = req.body.id || uuidv4();
    
    const pool = db.getDbConnection();
    if (!pool) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    await pool.query(
      'INSERT INTO conversations (id, is_active, created_at) VALUES (?, ?, ?)',
      [id, true, new Date()]
    );
    
    res.json({ 
      success: true, 
      message: 'Conversation created successfully', 
      id 
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Add message to conversation
router.post('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, content } = req.body;
    const messageId = req.body.id || uuidv4();
    
    const pool = db.getDbConnection();
    if (!pool) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    await pool.query(
      'INSERT INTO messages (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
      [messageId, id, role, content, new Date()]
    );
    
    res.json({ 
      success: true, 
      message: 'Message added successfully',
      id: messageId
    });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

module.exports = router;

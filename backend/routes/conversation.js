
const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Tracking for request debouncing
const requestCache = new Map();
const CACHE_TTL = 2000; // 2 seconds

// Get all conversations
router.get('/', async (req, res) => {
  // Simple request deduplication
  const cacheKey = 'get-all-conversations';
  const now = Date.now();
  const lastRequest = requestCache.get(cacheKey);
  
  if (lastRequest && (now - lastRequest.timestamp < CACHE_TTL)) {
    console.log('Debouncing duplicate request for conversations');
    return res.json(lastRequest.data || []);
  }
  
  try {
    const pool = db.getDbConnection();
    if (!pool) {
      console.log('Database not connected, returning empty conversations array');
      requestCache.set(cacheKey, { 
        timestamp: now,
        data: []
      });
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
    
    console.log(`Retrieved ${conversationsWithMessages.length} conversations from database`);
    
    // Cache the result
    requestCache.set(cacheKey, {
      timestamp: now,
      data: conversationsWithMessages
    });
    
    res.json(conversationsWithMessages);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    
    // Still cache the error state to prevent further requests
    requestCache.set(cacheKey, {
      timestamp: now,
      data: []
    });
    
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Create a new conversation
router.post('/', async (req, res) => {
  const cacheKey = 'get-all-conversations';
  requestCache.delete(cacheKey); // Invalidate cache on write
  
  try {
    const id = req.body.id || uuidv4();
    
    const pool = db.getDbConnection();
    if (!pool) {
      console.error('Database not connected, cannot create conversation');
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    console.log(`Creating new conversation with ID: ${id}`);
    
    // Check if conversation already exists first
    const [existingConvs] = await pool.query(
      'SELECT id FROM conversations WHERE id = ?',
      [id]
    );
    
    if (existingConvs && existingConvs.length > 0) {
      console.log(`Conversation with ID ${id} already exists, returning success`);
      return res.json({
        success: true,
        message: 'Conversation already exists',
        id
      });
    }
    
    await pool.query(
      'INSERT INTO conversations (id, is_active, created_at) VALUES (?, ?, ?)',
      [id, true, new Date()]
    );
    
    // Removed the welcome message creation to prevent duplicate messages
    // Now the client will be responsible for creating all messages
    
    console.log(`New conversation created with ID: ${id}`);
    
    res.json({ 
      success: true, 
      message: 'Conversation created successfully', 
      id 
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation', details: error.message });
  }
});

// Add message to conversation
router.post('/:id/messages', async (req, res) => {
  const cacheKey = 'get-all-conversations';
  requestCache.delete(cacheKey); // Invalidate cache on write
  
  try {
    const { id } = req.params;
    
    // Check if id is null, undefined, or the string "null"/"undefined"
    if (!id || id === 'null' || id === 'undefined') {
      console.error('Invalid conversation ID received:', id);
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }
    
    const { role, content } = req.body;
    
    // Validate required fields
    if (!role || !content) {
      console.error('Missing required fields:', { role, contentLength: content?.length });
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const messageId = req.body.id || uuidv4();
    
    const pool = db.getDbConnection();
    if (!pool) {
      console.error('Database not connected, cannot add message');
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    // Check if the conversation exists first
    let conversationExists = false;
    
    try {
      const [conversationRows] = await pool.query(
        'SELECT id FROM conversations WHERE id = ?',
        [id]
      );
      
      conversationExists = conversationRows && conversationRows.length > 0;
      
      // If the conversation doesn't exist, create it
      if (!conversationExists) {
        console.log(`Conversation ${id} not found, creating it automatically`);
        
        await pool.query(
          'INSERT INTO conversations (id, is_active, created_at) VALUES (?, ?, ?)',
          [id, true, new Date()]
        );
        
        conversationExists = true;
      }
    } catch (error) {
      console.error('Error checking conversation existence:', error);
      return res.status(500).json({ error: 'Failed to check conversation existence', details: error.message });
    }
    
    if (!conversationExists) {
      console.error('Could not create or find conversation:', id);
      return res.status(404).json({ error: 'Conversation not found and could not be created' });
    }
    
    // Check if this message ID already exists to avoid duplicates
    try {
      const [existingMessageRows] = await pool.query(
        'SELECT id FROM messages WHERE id = ?',
        [messageId]
      );
      
      if (existingMessageRows && existingMessageRows.length > 0) {
        console.log(`Message with ID ${messageId} already exists, skipping insertion`);
        return res.json({ 
          success: true, 
          message: 'Message already exists',
          id: messageId
        });
      }
    } catch (error) {
      console.error('Error checking message existence:', error);
      // Continue with insertion attempt even if check fails
    }
    
    // Log received data for debugging
    console.log('Adding message to conversation:', {
      conversationId: id,
      messageId,
      role,
      contentSample: content ? content.substring(0, 50) + '...' : 'undefined'
    });
    
    try {
      await pool.query(
        'INSERT INTO messages (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
        [messageId, id, role, content, new Date()]
      );
      
      console.log('Message added successfully to database');
      
      res.json({ 
        success: true, 
        message: 'Message added successfully',
        id: messageId
      });
    } catch (error) {
      console.error('Error inserting message:', error);
      res.status(500).json({ error: 'Failed to insert message', details: error.message });
    }
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message', details: error.message });
  }
});

module.exports = router;

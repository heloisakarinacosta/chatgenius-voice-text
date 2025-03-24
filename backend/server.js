
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database');

// Import routes
const widgetRoutes = require('./routes/widget');
const agentRoutes = require('./routes/agent');
const adminRoutes = require('./routes/admin');
const conversationRoutes = require('./routes/conversation');
const trainingRoutes = require('./routes/training');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize database
db.initDatabase().then(connected => {
  console.log(`Database ${connected ? 'connected successfully' : 'connection failed'}`);
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dbConnected: db.isConnected() });
});

// API routes
app.use('/api/widget', widgetRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/conversation', conversationRoutes);
app.use('/api/training', trainingRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

// Import routes
const widgetRoutes = require('./routes/widget');
const agentRoutes = require('./routes/agent');
const adminRoutes = require('./routes/admin');
const conversationRoutes = require('./routes/conversation');
const trainingRoutes = require('./routes/training');

const app = express();
const PORT = process.env.PORT || 3000;
const DEV_PORT = 8080;

// Middleware
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:3000', 'http://191.232.33.131:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize database
db.initDatabase().then(connected => {
  console.log(`Database ${connected ? 'connected successfully' : 'connection failed'}`);
});

// API routes
app.use('/api/widget', widgetRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/conversation', conversationRoutes);
app.use('/api/training', trainingRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dbConnected: db.isConnected() });
});

// Serve static files if in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  const staticPath = path.resolve(__dirname, '../dist');
  app.use(express.static(staticPath));

  // All other routes should redirect to the index.html
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(staticPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log('Available routes:');
  console.log('- GET /api/admin/api-key');
  console.log('- GET /api/health');
  // Add other important routes here for debugging
});

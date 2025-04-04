
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
const db = require('./database');

// Import routes
const widgetRoutes = require('./routes/widget');
const agentRoutes = require('./routes/agent');
const adminRoutes = require('./routes/admin');
const conversationRoutes = require('./routes/conversation');
const trainingRoutes = require('./routes/training');

const app = express();
const PORT = process.env.PORT || 3000;
const DEV_PORT = process.env.DEV_PORT || 3030;

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors({
  origin: [
    `http://localhost:${DEV_PORT}`, 
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:3000', 
    'https://localhost:3000',
    'http://191.232.33.131:3000',
    'https://191.232.33.131:3000'
  ],
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
if (isProduction) {
  // Set static folder
  const staticPath = path.resolve(__dirname, '../dist');
  app.use(express.static(staticPath));

  // All other routes should redirect to the index.html
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(staticPath, 'index.html'));
  });
}

// Start server based on configuration
if (isProduction && process.env.USE_HTTPS === 'true' && 
    fs.existsSync(process.env.SSL_KEY_PATH) && fs.existsSync(process.env.SSL_CERT_PATH)) {
  // Create HTTPS server with SSL certificates
  const httpsOptions = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH)
  };
  const httpsServer = https.createServer(httpsOptions, app);
  httpsServer.listen(PORT, () => {
    console.log(`HTTPS Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log('Secure server started with SSL');
  });
  
  // Optionally redirect HTTP to HTTPS
  if (process.env.REDIRECT_HTTP === 'true') {
    const httpApp = express();
    httpApp.use((req, res) => {
      res.redirect(`https://${req.hostname}${req.url}`);
    });
    http.createServer(httpApp).listen(80, () => {
      console.log('HTTP to HTTPS redirect server started on port 80');
    });
  }
} else {
  // Create HTTP server (development or fallback)
  const server = http.createServer(app);
  server.listen(isProduction ? PORT : DEV_PORT, () => {
    console.log(`HTTP Server running on port ${isProduction ? PORT : DEV_PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log('Available routes:');
    console.log('- GET /api/admin/api-key');
    console.log('- GET /api/health');
    
    if (isProduction) {
      console.log('');
      console.log('WARNING: Running in production mode without HTTPS.');
      console.log('To enable microphone access in production, please consider:');
      console.log('1. Using a reverse proxy (like Nginx or Apache) with HTTPS');
      console.log('2. Updating the .env file with your SSL certificate paths');
      console.log('');
    }
  });
}

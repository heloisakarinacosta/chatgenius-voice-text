
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
const DEV_PORT = 8080;

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// HTTPS options for production
let httpsOptions = {};
if (isProduction && process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
  try {
    httpsOptions = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH)
    };
    console.log('SSL certificates loaded successfully');
  } catch (error) {
    console.error('Failed to load SSL certificates:', error);
    process.exit(1);
  }
}

// Middleware
app.use(cors({
  origin: [
    'http://localhost:8080', 
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

// Start server
if (isProduction && process.env.USE_HTTPS === 'true' && httpsOptions.key && httpsOptions.cert) {
  // Create HTTPS server
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
  });
}

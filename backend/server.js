
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
console.log(`Running in ${isProduction ? 'production' : 'development'} mode`);
console.log(`Server will listen on port ${isProduction ? PORT : DEV_PORT}`);

// Middleware setup before routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS configuration - Simplified and more permissive for development
app.use(cors({
  origin: '*', // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control', 'Pragma', 'Expires'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Add debug headers middleware
app.use((req, res, next) => {
  // Log all incoming requests
  console.log(`${req.method} ${req.path} - Origin: ${req.get('origin') || 'unknown'}`);
  
  // Add response headers for CORS
  res.header('Access-Control-Allow-Origin', '*'); // More permissive for development
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, Pragma, Expires');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Set JSON content type for all API responses
  if (req.path.startsWith('/api')) {
    res.set('Content-Type', 'application/json');
  }
  
  next();
});

// Handle preflight OPTIONS requests
app.options('*', (req, res) => {
  console.log(`Handling OPTIONS request for ${req.path}`);
  res.status(204).end();
});

// Health check route - independent of database
app.get('/api/health', (req, res) => {
  try {
    // Get database connection details for diagnosis
    const dbStatus = db.isConnected ? db.isConnected() : false;
    const lastError = db.getLastConnectionError ? db.getLastConnectionError() : null;
    
    console.log(`Health check called - Database connected: ${dbStatus}`);
    
    // Format error for safe JSON response
    let errorInfo = null;
    if (lastError) {
      errorInfo = {
        code: lastError.code || 'UNKNOWN_ERROR',
        message: lastError.message || 'Unknown database error',
        sqlMessage: lastError.sqlMessage || null,
        sqlState: lastError.sqlState || null
      };
      console.log('Last DB connection error:', errorInfo);
    }
    
    // Enhanced response with detailed error information
    const response = { 
      status: 'ok', 
      server: true,
      dbConnected: dbStatus,
      environment: process.env.NODE_ENV || 'development',
      dbConfig: {
        host: process.env.DB_HOST || process.env.DEV_DB_HOST || '(not set)',
        database: process.env.DB_NAME || process.env.DEV_DB_NAME || '(not set)',
        user: process.env.DB_USER || process.env.DEV_DB_USER || '(not set)'
      },
      dbError: errorInfo
    };
    
    // Send the response with proper JSON headers
    res.status(200)
       .set({
         'Content-Type': 'application/json',
         'Cache-Control': 'no-cache, no-store, must-revalidate',
         'Pragma': 'no-cache',
         'Expires': '0',
         'Access-Control-Allow-Origin': '*' // Ensure CORS headers are present
       })
       .json(response);
  } catch (error) {
    console.error('Error in health check endpoint:', error);
    res.status(500)
       .set({
         'Content-Type': 'application/json',
         'Access-Control-Allow-Origin': '*' // Ensure CORS headers are present
       })
       .json({ 
         status: 'error', 
         message: 'Internal server error during health check',
         error: error.message || 'Unknown error'
       });
  }
});

// Initialize database after setting up basic routes
console.log('Initializing database connection...');
db.initDatabase().then(connected => {
  console.log(`Database ${connected ? 'connected successfully' : 'connection failed'}`);
}).catch(err => {
  console.error('Database initialization error:', err);
});

// API routes
app.use('/api/widget', widgetRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/conversation', conversationRoutes);
app.use('/api/training', trainingRoutes);

// Error handling middleware - must be after routes
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500)
     .set({
       'Content-Type': 'application/json',
       'Access-Control-Allow-Origin': '*' // Ensure CORS headers are present
     })
     .json({ error: err.message || 'Internal Server Error' });
});

// Serve static files if in production
if (isProduction) {
  // Set static folder
  const staticPath = path.resolve(__dirname, '../dist');
  
  // Serve static files
  app.use(express.static(staticPath));
  
  // All other routes should redirect to the index.html
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.resolve(staticPath, 'index.html'));
  });
}

// Catch-all route handler for unhandled routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.status(404)
       .set({
         'Content-Type': 'application/json',
         'Access-Control-Allow-Origin': '*' // Ensure CORS headers are present
       })
       .json({ error: 'API route not found' });
  } else if (isProduction) {
    // In production, redirect to index.html for client-side routing
    res.sendFile(path.resolve(__dirname, '../dist', 'index.html'));
  } else {
    // In development, just send a 404
    res.status(404)
       .set({
         'Content-Type': 'application/json',
         'Access-Control-Allow-Origin': '*' // Ensure CORS headers are present
       })
       .json({ error: 'Route not found' });
  }
});

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
    console.log('Available API routes:');
    console.log('- GET /api/health');
    console.log('- GET /api/widget');
    console.log('- GET /api/agent');
    console.log('- GET /api/admin');
    console.log('- GET /api/conversation');
    console.log('- GET /api/training');
    
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

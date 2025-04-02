
import * as localDb from './localStorageDb';

// Base URL for the API - Using the configured DEV_API_PORT from process.env
const DEV_PORT = process.env.DEV_API_PORT || 3030;
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/api'  // In production, use relative path to avoid CORS issues
  : `http://localhost:${DEV_PORT}/api`;

// Configuration for fetch requests
const FETCH_TIMEOUT = 3000; // 3 seconds timeout
const MAX_RETRIES = 1;
const RETRY_DELAY = 1000; // 1 second between retries

// This file serves as a facade over actual database implementations
// It will use either the API connection (to the backend) or localStorage as a fallback
let isDbConnected = false;
let connectionAttempted = false;
let connectionRetryCount = 0;
let lastConnectionAttempt = 0;
let inProgressRequests = new Set();

// Helper function to create a fetch request with timeout
const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
  const controller = new AbortController();
  const { signal } = controller;
  
  // Create a timeout that will abort the fetch
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  
  try {
    const response = await fetch(url, { ...options, signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Initialize database connection - this will try to connect to the backend API
// Added retry delay to prevent rapid reconnection attempts
export const initDatabase = async () => {
  // Check if we've already tried recently to avoid hammering the server
  const now = Date.now();
  if (connectionAttempted && (now - lastConnectionAttempt) < RETRY_DELAY) {
    console.log('Skipping connection attempt - too soon since last try');
    return isDbConnected;
  }
  
  // Check if we've exceeded max retries
  if (connectionRetryCount >= MAX_RETRIES) {
    // Only try again after a longer cooldown period (10 seconds)
    if ((now - lastConnectionAttempt) < 10000) {
      console.log('Max retries exceeded, using localStorage');
      return isDbConnected;
    } else {
      // Reset retry count after cooldown
      connectionRetryCount = 0;
    }
  }

  try {
    connectionAttempted = true;
    lastConnectionAttempt = now;
    connectionRetryCount++;
    
    console.log('Attempting to connect to backend API at:', API_BASE_URL);
    const response = await fetchWithTimeout(`${API_BASE_URL}/health`, {
      headers: { 'Cache-Control': 'no-cache' },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      console.error('API returned error status:', response.status);
      isDbConnected = false;
      throw new Error('API is not available');
    }
    
    const data = await response.json();
    console.log('Backend health check response:', data);
    isDbConnected = data.dbConnected === true;
    
    if (!isDbConnected) {
      console.log('Database not connected in backend, falling back to localStorage');
    }
    
    // Reset retry count on successful connection
    if (isDbConnected) {
      connectionRetryCount = 0;
    }
    
    console.log(`Using ${isDbConnected ? 'backend API with database' : 'localStorage fallback'} for data storage`);
    
    return isDbConnected;
  } catch (error) {
    console.error('Error connecting to backend API:', error);
    console.log('Using localStorage fallback for database operations');
    isDbConnected = false;
    return false;
  }
};

// Widget configuration functions
export const getWidgetConfig = async () => {
  // Generate a unique request ID to prevent duplicate requests
  const requestId = `widget-config-${Date.now()}`;
  if (inProgressRequests.has(requestId)) {
    console.log('Duplicate request prevented:', requestId);
    return localDb.getWidgetConfig();
  }
  
  if (isDbConnected) {
    try {
      inProgressRequests.add(requestId);
      const response = await fetchWithTimeout(`${API_BASE_URL}/widget`, {
        headers: { 'Cache-Control': 'no-cache' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Failed to fetch widget config');
      const result = await response.json();
      inProgressRequests.delete(requestId);
      return result;
    } catch (error) {
      console.error('Error fetching widget config from API:', error);
      inProgressRequests.delete(requestId);
      return localDb.getWidgetConfig();
    }
  }
  return localDb.getWidgetConfig();
};

export const updateWidgetConfig = async (config: any) => {
  if (isDbConnected) {
    try {
      const response = await fetch(`${API_BASE_URL}/widget`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Server error when updating widget config:', errorData);
        throw new Error(errorData.error || 'Failed to update widget config');
      }
      return true;
    } catch (error) {
      console.error('Error updating widget config via API:', error);
      return localDb.updateWidgetConfig(config);
    }
  }
  return localDb.updateWidgetConfig(config);
};

// Agent configuration functions
export const getAgentConfig = async () => {
  if (isDbConnected) {
    try {
      const response = await fetch(`${API_BASE_URL}/agent`, {
        headers: { 'Cache-Control': 'no-cache' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Failed to fetch agent config');
      return await response.json();
    } catch (error) {
      console.error('Error fetching agent config from API:', error);
      return localDb.getAgentConfig();
    }
  }
  return localDb.getAgentConfig();
};

export const updateAgentConfig = async (config: any) => {
  if (isDbConnected) {
    try {
      const response = await fetch(`${API_BASE_URL}/agent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Server error when updating agent config:', errorData);
        throw new Error(errorData.error || 'Failed to update agent config');
      }
      return true;
    } catch (error) {
      console.error('Error updating agent config via API:', error);
      return localDb.updateAgentConfig(config);
    }
  }
  return localDb.updateAgentConfig(config);
};

// Admin configuration functions
export const getAdminConfig = async () => {
  if (isDbConnected) {
    try {
      // Add a cache busting parameter to prevent browser caching
      const cacheBuster = new Date().getTime();
      const response = await fetch(`${API_BASE_URL}/admin?_=${cacheBuster}`, {
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        console.error('Failed to fetch admin config:', response.status);
        throw new Error('Failed to fetch admin config');
      }
      
      const data = await response.json();
      console.log('Admin config fetched from API successfully');
      
      return {
        username: data.username,
        passwordHash: data.passwordHash,
        apiKey: data.apiKey || ""
      };
    } catch (error) {
      console.error('Error fetching admin config from API:', error);
      return localDb.getAdminConfig();
    }
  }
  return localDb.getAdminConfig();
};

export const updateAdminConfig = async (config: any) => {
  if (isDbConnected) {
    try {
      console.log('Updating admin config:', {
        ...config,
        apiKey: config.apiKey ? '[REDACTED]' : '' // Don't log the actual API key
      });
      
      const response = await fetch(`${API_BASE_URL}/admin`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          username: config.username || 'admin',
          passwordHash: config.passwordHash || '',
          apiKey: config.apiKey || ''
        })
      });
      
      if (!response.ok) {
        let errorMessage = 'Failed to update admin config';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error('Server error when updating admin config:', errorData);
        } catch (parseError) {
          console.error('Could not parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      // Store in local storage as well for redundancy
      await localDb.updateAdminConfig(config);
      
      return true;
    } catch (error) {
      console.error('Error updating admin config via API:', error);
      // Fallback to local storage
      return localDb.updateAdminConfig(config);
    }
  }
  return localDb.updateAdminConfig(config);
};

// Conversation functions
export const getConversations = async () => {
  // Add request tracking to prevent excessive calls
  const requestId = `conversations-${Date.now()}`;
  if (inProgressRequests.has(requestId)) {
    console.log('Duplicate request prevented for conversations');
    return localDb.getConversations();
  }
  
  if (isDbConnected) {
    try {
      inProgressRequests.add(requestId);
      console.log('Fetching conversations from API');
      const response = await fetchWithTimeout(`${API_BASE_URL}/conversation`, {
        headers: { 'Cache-Control': 'no-cache' },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        console.log(`API returned error status for conversations: ${response.status}`);
        throw new Error('Failed to fetch conversations');
      }
      
      const conversations = await response.json();
      console.log(`Retrieved ${conversations.length} conversations from API`);
      inProgressRequests.delete(requestId);
      return conversations;
    } catch (error) {
      console.error('Error fetching conversations from API:', error);
      inProgressRequests.delete(requestId);
      
      // If we get a connection error, mark the database as disconnected
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.log('Connection to API lost, switching to localStorage');
        isDbConnected = false;
      }
      
      return localDb.getConversations();
    }
  }
  return localDb.getConversations();
};

export const createConversation = async (id: string) => {
  if (isDbConnected) {
    try {
      const response = await fetch(`${API_BASE_URL}/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      return response.ok;
    } catch (error) {
      console.error('Error creating conversation via API:', error);
      return localDb.createConversation(id);
    }
  }
  return localDb.createConversation(id);
};

export const addMessage = async (conversationId: string, message: any) => {
  if (isDbConnected) {
    try {
      const response = await fetch(`${API_BASE_URL}/conversation/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      return response.ok;
    } catch (error) {
      console.error('Error adding message via API:', error);
      return localDb.addMessage(conversationId, message);
    }
  }
  return localDb.addMessage(conversationId, message);
};

// Training file functions
export const getTrainingFiles = async () => {
  // Generate a unique request ID to prevent duplicate requests
  const requestId = `training-files-${Date.now()}`;
  if (inProgressRequests.has(requestId)) {
    console.log('Duplicate training files request prevented');
    return localDb.getTrainingFiles();
  }
  
  // Always get local files first
  const localFiles = localDb.getTrainingFiles();
  console.log(`Found ${localFiles.length} training files in localStorage`);
  
  if (isDbConnected) {
    try {
      console.log('Fetching training files from API...');
      inProgressRequests.add(requestId);
      const response = await fetchWithTimeout(`${API_BASE_URL}/training`, {
        headers: { 'Cache-Control': 'no-cache' },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch training files: ${response.status}`);
      }
      
      const apiFiles = await response.json();
      console.log(`Retrieved ${apiFiles.length} training files from API`);
      inProgressRequests.delete(requestId);
      
      // Merge API files with local files to ensure we don't lose any
      // Convert API timestamp strings to Date objects
      const processedApiFiles = apiFiles.map((file: any) => ({
        ...file,
        timestamp: new Date(file.timestamp)
      }));
      
      // Create a map of file IDs for quick lookup
      const fileMap = new Map();
      
      // First add all local files to the map
      localFiles.forEach(file => {
        fileMap.set(file.id, file);
      });
      
      // Then add API files, overwriting local ones with the same ID
      processedApiFiles.forEach(file => {
        fileMap.set(file.id, file);
      });
      
      // Convert map back to array
      const mergedFiles = Array.from(fileMap.values());
      console.log(`Returning ${mergedFiles.length} merged training files`);
      
      // Update local storage with the merged files
      const config = localDb.getAgentConfig();
      config.trainingFiles = mergedFiles;
      localDb.updateAgentConfig(config);
      
      return mergedFiles;
    } catch (error) {
      console.error('Error fetching training files from API:', error);
      inProgressRequests.delete(requestId);
      
      // If we get a connection error, mark the database as disconnected
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.log('Connection to API lost, switching to localStorage');
        isDbConnected = false;
      }
      
      return localFiles;
    }
  }
  return localFiles;
};

export const addTrainingFile = async (file: any) => {
  // Always add to local storage first
  localDb.addTrainingFile(file);
  console.log(`Added training file ${file.name} to localStorage`);
  
  // Generate a unique request ID based on file name and timestamp
  const requestId = `add-file-${file.name}-${Date.now()}`;
  if (inProgressRequests.has(requestId)) {
    console.log('Duplicate file upload request prevented');
    return true;
  }
  
  if (isDbConnected) {
    try {
      console.log(`Sending training file ${file.name} to API...`);
      inProgressRequests.add(requestId);
      const response = await fetchWithTimeout(`${API_BASE_URL}/training`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file)
      });
      
      if (!response.ok) {
        // Try to get more detailed error information
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Server error when adding training file:', errorData);
        inProgressRequests.delete(requestId);
        throw new Error(errorData.error || `Failed to add training file: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Training file API response:', result);
      inProgressRequests.delete(requestId);
      return true;
    } catch (error) {
      console.error('Error adding training file via API:', error);
      inProgressRequests.delete(requestId);
      
      // If we get a connection error, mark the database as disconnected
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.log('Connection to API lost, switching to localStorage');
        isDbConnected = false;
      }
      
      // Already added to localStorage, so return true
      return true;
    }
  }
  return true;
};

export const removeTrainingFile = async (id: string) => {
  // Always remove from local storage first
  localDb.removeTrainingFile(id);
  console.log(`Removed training file ${id} from localStorage`);
  
  // Generate a unique request ID
  const requestId = `remove-file-${id}-${Date.now()}`;
  if (inProgressRequests.has(requestId)) {
    console.log('Duplicate file removal request prevented');
    return true;
  }
  
  if (isDbConnected) {
    try {
      console.log(`Removing training file with ID ${id} via API...`);
      inProgressRequests.add(requestId);
      const response = await fetchWithTimeout(`${API_BASE_URL}/training/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Server error when removing training file:', errorData);
        inProgressRequests.delete(requestId);
        throw new Error(errorData.error || `Failed to remove training file: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Training file removal API response:', result);
      inProgressRequests.delete(requestId);
      return true;
    } catch (error) {
      console.error('Error removing training file via API:', error);
      inProgressRequests.delete(requestId);
      
      // If we get a connection error, mark the database as disconnected
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.log('Connection to API lost, switching to localStorage');
        isDbConnected = false;
      }
      
      // Already removed from localStorage, so return true
      return true;
    }
  }
  return true;
};

// Get database connection status
export const getDbConnection = async () => {
  // Prevent duplicate concurrent requests
  const requestId = `db-connection-${Date.now()}`;
  if (inProgressRequests.has(requestId)) {
    console.log('Duplicate DB connection check prevented');
    return isDbConnected;
  }
  
  try {
    inProgressRequests.add(requestId);
    const response = await fetchWithTimeout(`${API_BASE_URL}/health`, {
      headers: { 'Cache-Control': 'no-cache' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('API health check failed');
    const data = await response.json();
    isDbConnected = data.dbConnected;
    inProgressRequests.delete(requestId);
    return data.dbConnected;
  } catch (error) {
    console.error('Error checking database connection:', error);
    isDbConnected = false;
    inProgressRequests.delete(requestId);
    return null;
  }
};

// Check if database is connected
export const isConnected = () => {
  return isDbConnected;
};

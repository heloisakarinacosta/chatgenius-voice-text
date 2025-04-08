import * as localDb from './localStorageDb';

// Enhanced API base URL function that robustly handles both development and production environments
const getApiBaseUrl = () => {
  // Detection for remote development environments
  const isLovableRemote = window.location.hostname.includes('lovableproject.com');
  
  // In production mode
  if (process.env.NODE_ENV === 'production' && !isLovableRemote) {
    // In true production, use relative URL to ensure requests go to the same server
    return '/api';
  }
  
  // For lovable.dev remote development
  if (isLovableRemote) {
    // Always try to connect to localhost:3030 for remote development
    return 'http://localhost:3030/api';
  }
  
  // Regular local development
  return '/api';  // Use vite proxy in local development
};

const API_BASE_URL = getApiBaseUrl();

// Log the API base URL to help with debugging
console.log(`API base URL configured as: ${API_BASE_URL} (${process.env.NODE_ENV || 'development'} environment)`);
console.log(`Running on hostname: ${window.location.hostname}`);

// Configuration for fetch requests
const FETCH_TIMEOUT = 15000; // 15 seconds timeout (increased from 10)
const MAX_RETRIES = 3;     
const RETRY_DELAY = 1000;  // 1 second between retries

// Database connection state
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
    console.log(`Fetching from URL: ${url}`);
    
    // Check if we're on lovableproject.com to adjust CORS settings
    const isLovableRemote = window.location.hostname.includes('lovableproject.com');
    
    // Set appropriate credentials mode based on environment
    const credentials = isLovableRemote ? 'omit' : 'include';
    
    // Ensure we always set the proper headers
    const headers = {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'Origin': window.location.origin,
      ...(options.headers || {})
    };
    
    // Attempt the fetch with a timeout
    const response = await fetch(url, { 
      ...options, 
      signal,
      headers,
      credentials,
      mode: isLovableRemote ? 'cors' : undefined // Only set mode for cross-origin requests
    });
    
    clearTimeout(timeoutId);
    
    // Check if response is OK
    if (!response.ok) {
      console.error(`Fetch error: ${response.status} ${response.statusText}`);
      
      // Log the response body for debugging
      try {
        const errorText = await response.text();
        console.error(`Error response body: ${errorText.substring(0, 200)}${errorText.length > 200 ? '...' : ''}`);
      } catch (e) {
        console.error('Could not read error response body');
      }
      
      throw new Error(`API returned error status: ${response.status}`);
    }
    
    // Check content type to ensure we're getting JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('API returned non-JSON response:', contentType);
      
      // Try to get the text of the response for debugging
      try {
        const responseText = await response.text();
        console.error(`Response body (not JSON): ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
      } catch (e) {
        console.error('Could not read non-JSON response body');
      }
      
      throw new Error('API returned non-JSON response');
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Add more detailed error logging
    if (error.name === 'AbortError') {
      console.error(`Fetch timeout after ${FETCH_TIMEOUT}ms:`, url);
      throw new Error(`Request timed out after ${FETCH_TIMEOUT}ms`);
    }
    
    throw error;
  }
};

// Initialize database connection - this will try to connect to the backend API
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
    
    // Add cache busting parameter
    const cacheBuster = `?_=${Date.now()}`;
    
    try {
      // First, try a simple options request to check CORS
      const optionsResp = await fetch(`${API_BASE_URL}/health${cacheBuster}`, {
        method: 'OPTIONS',
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
      
      if (optionsResp.ok) {
        console.log('OPTIONS request succeeded, CORS appears to be properly configured');
      } else {
        console.warn('OPTIONS request returned status:', optionsResp.status);
      }
    } catch (corsError) {
      console.warn('OPTIONS request failed, potential CORS issue:', corsError);
      // Continue anyway, as the actual request might still work
    }
    
    // Attempt the actual health check with several retries
    let response;
    let retryCount = 0;
    const maxFetchRetries = 2;
    
    while (retryCount <= maxFetchRetries) {
      try {
        response = await fetchWithTimeout(`${API_BASE_URL}/health${cacheBuster}`, {
          headers: { 
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Accept': 'application/json'
          },
          cache: 'no-store',
          credentials: 'include'
        });
        break; // Success, exit the retry loop
      } catch (fetchError) {
        retryCount++;
        if (retryCount <= maxFetchRetries) {
          console.log(`Fetch attempt ${retryCount} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between retries
        } else {
          throw fetchError; // Re-throw after all retries failed
        }
      }
    }
    
    // Ensure we got a response
    if (!response) {
      throw new Error('No response from health check after retries');
    }
    
    // Response checks are now done in fetchWithTimeout
    const data = await response.json();
    console.log('Backend health check response:', data);
    
    // A successful response with dbConnected: true means we're fully connected
    isDbConnected = data.dbConnected === true && data.status === 'ok';
    
    if (!isDbConnected && data.status === 'ok') {
      console.log('Server is OK but database not connected in backend, falling back to localStorage');
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

// Helper function to detect remote environment
export const isRemoteDevelopment = () => {
  return window.location.hostname.includes('lovableproject.com');
};

// Get health check URL based on environment
export const getApiHealthUrl = () => {
  if (isRemoteDevelopment()) {
    return 'http://localhost:3030/api/health';
  }
  return `${API_BASE_URL}/health`;
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

// Get database connection status with improved remote handling
export const getDbConnection = async () => {
  // Prevent duplicate concurrent requests
  const requestId = `db-connection-${Date.now()}`;
  if (inProgressRequests.has(requestId)) {
    console.log('Duplicate DB connection check prevented');
    return isDbConnected;
  }
  
  try {
    inProgressRequests.add(requestId);
    // Add cache busting parameter
    const cacheBuster = `?_=${Date.now()}`;
    
    // Determine the appropriate health check URL
    const url = getApiHealthUrl() + cacheBuster;
    console.log(`Checking database connection at: ${url}`);
    
    // For remote development environment (lovableproject.com)
    if (isRemoteDevelopment()) {
      try {
        console.log('Using remote development connection mode');
        // Use fetch directly with mode: 'cors' and credentials: 'omit'
        const response = await fetch(url, {
          headers: { 
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Origin': window.location.origin
          },
          mode: 'cors',
          credentials: 'omit'
        });
        
        if (!response.ok) {
          console.error(`Health check failed with status: ${response.status}`);
          isDbConnected = false;
          inProgressRequests.delete(requestId);
          return false;
        }
        
        const data = await response.json();
        console.log('Health check response:', data);
        isDbConnected = data.dbConnected && data.status === 'ok';
        inProgressRequests.delete(requestId);
        return data.dbConnected;
      } catch (error) {
        console.error('Error checking database connection in remote mode:', error);
        isDbConnected = false;
        inProgressRequests.delete(requestId);
        return false;
      }
    }
    
    // Standard fetch for local development
    const response = await fetchWithTimeout(url, {
      headers: { 
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Accept': 'application/json',
        'Origin': window.location.origin
      },
      cache: 'no-store',
      credentials: 'include'
    });
    
    const data = await response.json();
    isDbConnected = data.dbConnected && data.status === 'ok';
    inProgressRequests.delete(requestId);
    return data.dbConnected;
  } catch (error) {
    console.error('Error checking database connection:', error);
    isDbConnected = false;
    inProgressRequests.delete(requestId);
    return false;
  }
};

// Check if database is connected
export const isConnected = () => {
  return isDbConnected;
};

import * as localDb from './localStorageDb';
import { WidgetConfig, AgentConfig, AdminConfig, Message, Conversation, TrainingFile } from "@/types/chat";

// Enhanced API base URL function that robustly handles both development and production environments
const getApiBaseUrl = () => {
  // For remote environments like lovableproject.com - use absolute URL
  if (window.location.hostname.includes('.lovableproject.com')) {
    // Use window.location.origin for the same domain
    return `${window.location.origin}/api`;
  }
  
  // For Gitpod or Codespaces development
  if (window.location.hostname.includes('.gitpod.io') || 
      window.location.hostname.includes('.codespaces.')) {
    return '/api'; // Use proxy in these environments
  }
  
  // In production mode, use relative URL to ensure requests go to the same server
  if (process.env.NODE_ENV === 'production') {
    return '/api';
  }
  
  // For local development
  return '/api';  // Use vite proxy in local development
};

const API_BASE_URL = getApiBaseUrl();

// Log the API base URL to help with debugging
console.log(`API base URL configured as: ${API_BASE_URL} (${process.env.NODE_ENV || 'development'} environment)`);
console.log(`Running on hostname: ${window.location.hostname}`);

// Configuration for fetch requests
const FETCH_TIMEOUT = 15000; // 15 seconds timeout
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
    
    // Set appropriate credentials mode (always include credentials)
    const credentials = 'include';
    
    // Ensure we always set the proper headers
    const headers = {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json',
      'Origin': window.location.origin,
      ...(options.headers || {})
    };
    
    // Attempt the fetch with a timeout
    const response = await fetch(url, { 
      ...options, 
      signal,
      headers,
      credentials,
      mode: 'cors'
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
export const initDatabase = async (): Promise<boolean> => {
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
    
    // Always try a simple options request to check CORS first
    console.log('Checking CORS with OPTIONS request');
    try {
      // First, try a simple options request to check CORS
      const optionsResp = await fetch(`${API_BASE_URL}/health${cacheBuster}`, {
        method: 'OPTIONS',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        },
        mode: 'cors'
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
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Origin': window.location.origin
          },
          cache: 'no-store',
          mode: 'cors'
        });
        break; // Success, exit the retry loop
      } catch (fetchError) {
        retryCount++;
        console.log(`Fetch attempt ${retryCount} failed:`, fetchError.message);
        if (retryCount <= maxFetchRetries) {
          console.log(`Retrying... (attempt ${retryCount} of ${maxFetchRetries})`);
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

// Get health check URL
export const getApiHealthUrl = () => {
  return `${API_BASE_URL}/health`;
};

// Get database connection status
export const getDbConnection = async (): Promise<boolean> => {
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
    
    // Standard fetch 
    const response = await fetchWithTimeout(url, {
      headers: { 
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      },
      cache: 'no-store'
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

// Flag to check for remote development environment
export const isRemoteDevelopment = () => {
  return window.location.hostname.includes('.lovableproject.com') || 
         window.location.hostname.includes('.gitpod.io') ||
         window.location.hostname.includes('.codespaces.');
};

// Check if database is connected
export const isConnected = () => {
  return isDbConnected;
};

// Export type-safe versions of all functions from localDb
export const getWidgetConfig = (): WidgetConfig => localDb.getWidgetConfig();
export const updateWidgetConfig = (config: WidgetConfig): boolean => localDb.updateWidgetConfig(config);
export const getAgentConfig = (): AgentConfig => localDb.getAgentConfig();
export const updateAgentConfig = (config: AgentConfig): boolean => localDb.updateAgentConfig(config);
export const getAdminConfig = (): AdminConfig => localDb.getAdminConfig();
export const updateAdminConfig = (config: AdminConfig): boolean => localDb.updateAdminConfig(config);
export const getConversations = (): Conversation[] => localDb.getConversations();
export const createConversation = (id: string): boolean => localDb.createConversation(id);
export const addMessage = (conversationId: string, message: Message): boolean => localDb.addMessage(conversationId, message);
export const getTrainingFiles = (): TrainingFile[] => localDb.getTrainingFiles();
export const addTrainingFile = (file: TrainingFile): boolean => localDb.addTrainingFile(file);
export const removeTrainingFile = (id: string): boolean => localDb.removeTrainingFile(id);

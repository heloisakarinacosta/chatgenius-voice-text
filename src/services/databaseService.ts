
import * as localDb from './localStorageDb';

// This file serves as a facade over actual database implementations
// It will use either a real database connection (in a server environment)
// or localStorage as a fallback (in a browser environment)

// We're always using localStorage in the browser version
// In a real-world app, this would communicate with a backend API
const isDbConnected = false;

// Initialize database connection - this would normally try to connect to MariaDB
// but in browser context, we're always using localStorage
export const initDatabase = async () => {
  console.log('Using localStorage fallback for database operations');
  return false; // Always return false to indicate we're using localStorage
};

// Expose all methods from localStorageDb
export const getWidgetConfig = localDb.getWidgetConfig;
export const updateWidgetConfig = localDb.updateWidgetConfig;
export const getAgentConfig = localDb.getAgentConfig;
export const updateAgentConfig = localDb.updateAgentConfig;
export const getAdminConfig = localDb.getAdminConfig;
export const updateAdminConfig = localDb.updateAdminConfig;
export const getConversations = localDb.getConversations;
export const createConversation = localDb.createConversation;
export const addMessage = localDb.addMessage;
export const addTrainingFile = localDb.addTrainingFile;
export const removeTrainingFile = localDb.removeTrainingFile;

// Get database connection status
export const getDbConnection = async () => {
  return null; // Always return null in browser context
};

// Check if database is connected
export const isConnected = () => {
  return isDbConnected;
};

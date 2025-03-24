
import * as localDb from './localStorageDb';

// Base URL for the API
const API_BASE_URL = 'http://localhost:3001/api';

// This file serves as a facade over actual database implementations
// It will use either the API connection (to the backend) or localStorage as a fallback
let isDbConnected = false;

// Initialize database connection - this will try to connect to the backend API
export const initDatabase = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error('API is not available');
    }
    
    const data = await response.json();
    isDbConnected = data.dbConnected;
    
    console.log(`Using ${isDbConnected ? 'backend API with database' : 'localStorage fallback'} for data storage`);
    
    return isDbConnected;
  } catch (error) {
    console.error('Error connecting to backend API:', error);
    console.log('Using localStorage fallback for database operations');
    return false;
  }
};

// Widget configuration functions
export const getWidgetConfig = async () => {
  if (isDbConnected) {
    try {
      const response = await fetch(`${API_BASE_URL}/widget`);
      if (!response.ok) throw new Error('Failed to fetch widget config');
      return await response.json();
    } catch (error) {
      console.error('Error fetching widget config from API:', error);
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
      return response.ok;
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
      const response = await fetch(`${API_BASE_URL}/agent`);
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
      return response.ok;
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
      const response = await fetch(`${API_BASE_URL}/admin`);
      if (!response.ok) throw new Error('Failed to fetch admin config');
      return await response.json();
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
      const response = await fetch(`${API_BASE_URL}/admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      return response.ok;
    } catch (error) {
      console.error('Error updating admin config via API:', error);
      return localDb.updateAdminConfig(config);
    }
  }
  return localDb.updateAdminConfig(config);
};

// Conversation functions
export const getConversations = async () => {
  if (isDbConnected) {
    try {
      const response = await fetch(`${API_BASE_URL}/conversation`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return await response.json();
    } catch (error) {
      console.error('Error fetching conversations from API:', error);
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
export const addTrainingFile = async (file: any) => {
  if (isDbConnected) {
    try {
      const response = await fetch(`${API_BASE_URL}/training`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file)
      });
      return response.ok;
    } catch (error) {
      console.error('Error adding training file via API:', error);
      return localDb.addTrainingFile(file);
    }
  }
  return localDb.addTrainingFile(file);
};

export const removeTrainingFile = async (id: string) => {
  if (isDbConnected) {
    try {
      const response = await fetch(`${API_BASE_URL}/training/${id}`, {
        method: 'DELETE'
      });
      return response.ok;
    } catch (error) {
      console.error('Error removing training file via API:', error);
      return localDb.removeTrainingFile(id);
    }
  }
  return localDb.removeTrainingFile(id);
};

// Get database connection status
export const getDbConnection = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) throw new Error('API health check failed');
    const data = await response.json();
    return data.dbConnected;
  } catch (error) {
    console.error('Error checking database connection:', error);
    return null;
  }
};

// Check if database is connected
export const isConnected = () => {
  return isDbConnected;
};

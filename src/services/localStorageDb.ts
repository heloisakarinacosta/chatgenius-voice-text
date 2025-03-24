// Local storage fallback implementation for database operations

export interface WidgetConfig {
  position: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "center-right" | "center-left";
  title: string;
  subtitle: string;
  primaryColor: string;
  iconType: "chat" | "support" | "help";
}

export interface AgentConfig {
  systemPrompt: string;
  functions: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
    webhook: string;
  }>;
  voice: {
    enabled: boolean;
    voiceId: string;
    language: string;
    latency: number;
  };
  trainingFiles: Array<{
    id: string;
    name: string;
    content: string;
    size: number;
    type: string;
    timestamp: Date;
  }>;
}

export interface AdminConfig {
  username: string;
  passwordHash: string;
  apiKey: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  messages: Message[];
  isActive: boolean;
  createdAt: Date;
}

// Default configurations
const defaultWidgetConfig: WidgetConfig = {
  position: "bottom-right",
  title: "Chat Assistant",
  subtitle: "How can I help you today?",
  primaryColor: "#000000",
  iconType: "chat",
};

const defaultAgentConfig: AgentConfig = {
  systemPrompt: "You are a helpful assistant. Provide clear and concise information to the user's queries.",
  functions: [],
  voice: {
    enabled: true,
    voiceId: "alloy",
    language: "en-US",
    latency: 100,
  },
  trainingFiles: [],
};

const defaultAdminConfig: AdminConfig = {
  username: "admin",
  passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // "admin" - SHA-256 hashed
};

// Get widget configuration from localStorage
export const getWidgetConfig = (): WidgetConfig => {
  const storedConfig = localStorage.getItem("widgetConfig");
  if (storedConfig) {
    return JSON.parse(storedConfig);
  }
  return defaultWidgetConfig;
};

// Save widget configuration to localStorage
export const updateWidgetConfig = (config: WidgetConfig): boolean => {
  try {
    localStorage.setItem("widgetConfig", JSON.stringify(config));
    return true;
  } catch (error) {
    console.error("Error saving widget config:", error);
    return false;
  }
};

// Get agent configuration from localStorage
export const getAgentConfig = (): AgentConfig => {
  const storedConfig = localStorage.getItem("agentConfig");
  if (storedConfig) {
    const parsedConfig = JSON.parse(storedConfig);
    
    // Convert string timestamps back to Date objects for training files
    if (parsedConfig.trainingFiles && Array.isArray(parsedConfig.trainingFiles)) {
      parsedConfig.trainingFiles = parsedConfig.trainingFiles.map((file: any) => ({
        ...file,
        timestamp: new Date(file.timestamp)
      }));
    }
    
    return parsedConfig;
  }
  return defaultAgentConfig;
};

// Save agent configuration to localStorage
export const updateAgentConfig = (config: AgentConfig): boolean => {
  try {
    localStorage.setItem("agentConfig", JSON.stringify(config));
    return true;
  } catch (error) {
    console.error("Error saving agent config:", error);
    return false;
  }
};

// Get admin configuration from localStorage
export const getAdminConfig = () => {
  const adminConfig = localStorage.getItem('adminConfig');
  
  if (!adminConfig) {
    return {
      username: 'admin',
      passwordHash: '',
      apiKey: ''
    };
  }
  
  try {
    const parsedConfig = JSON.parse(adminConfig);
    return {
      username: parsedConfig.username || 'admin',
      passwordHash: parsedConfig.passwordHash || '',
      apiKey: parsedConfig.apiKey || ''
    };
  } catch (e) {
    console.error('Error parsing admin config from localStorage:', e);
    return {
      username: 'admin',
      passwordHash: '',
      apiKey: ''
    };
  }
};

// Save admin configuration to localStorage
export const updateAdminConfig = (config) => {
  try {
    localStorage.setItem('adminConfig', JSON.stringify({
      username: config.username || 'admin',
      passwordHash: config.passwordHash || '',
      apiKey: config.apiKey || ''
    }));
    return true;
  } catch (e) {
    console.error('Error saving admin config to localStorage:', e);
    return false;
  }
};

// Get all conversations from localStorage
export const getConversations = (): Conversation[] => {
  const storedConversations = localStorage.getItem("conversations");
  if (storedConversations) {
    const parsedConversations = JSON.parse(storedConversations);
    
    // Convert string timestamps back to Date objects
    return parsedConversations.map((conv: any) => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      messages: conv.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    }));
  }
  return [];
};

// Create a new conversation in localStorage
export const createConversation = (id: string): boolean => {
  try {
    const conversations = getConversations();
    const newConversation = {
      id,
      messages: [],
      isActive: true,
      createdAt: new Date()
    };
    
    conversations.push(newConversation);
    localStorage.setItem("conversations", JSON.stringify(conversations));
    return true;
  } catch (error) {
    console.error("Error creating conversation:", error);
    return false;
  }
};

// Add a message to a conversation in localStorage
export const addMessage = (conversationId: string, message: Message): boolean => {
  try {
    const conversations = getConversations();
    const updatedConversations = conversations.map(conv => 
      conv.id === conversationId
        ? { ...conv, messages: [...conv.messages, message] }
        : conv
    );
    
    localStorage.setItem("conversations", JSON.stringify(updatedConversations));
    return true;
  } catch (error) {
    console.error("Error adding message:", error);
    return false;
  }
};

// Add a training file in localStorage
export const addTrainingFile = (file: any): boolean => {
  try {
    const config = getAgentConfig();
    config.trainingFiles.push(file);
    return updateAgentConfig(config);
  } catch (error) {
    console.error("Error adding training file:", error);
    return false;
  }
};

// Remove a training file in localStorage
export const removeTrainingFile = (id: string): boolean => {
  try {
    const config = getAgentConfig();
    config.trainingFiles = config.trainingFiles.filter(file => file.id !== id);
    return updateAgentConfig(config);
  } catch (error) {
    console.error("Error removing training file:", error);
    return false;
  }
};

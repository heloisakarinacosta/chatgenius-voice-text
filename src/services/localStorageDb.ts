
// Local storage fallback implementation for database operations
import { WidgetConfig, AgentConfig, AdminConfig, Message, Conversation, TrainingFile } from "@/types/chat";

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
  model: "gpt-4o",
  temperature: 0.7,
  maxTokens: 1000,
  detectEmotion: false,
  knowledgeType: 'rag',
  rag: { enabled: true },
  fineTuning: { enabled: false, modelId: '', status: 'not_started' },
  assistant: { enabled: false, assistantId: '', name: '' }
};

const defaultAdminConfig: AdminConfig = {
  username: "admin",
  passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // "admin" - SHA-256 hashed
  apiKey: "", // Added empty apiKey property
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
    
    // Ensure all required fields are present by merging with defaults
    return {
      ...defaultAgentConfig,
      ...parsedConfig,
      voice: {
        ...defaultAgentConfig.voice,
        ...(parsedConfig.voice || {})
      },
      rag: {
        ...defaultAgentConfig.rag,
        ...(parsedConfig.rag || {})
      },
      fineTuning: {
        ...defaultAgentConfig.fineTuning,
        ...(parsedConfig.fineTuning || {})
      },
      assistant: {
        ...defaultAgentConfig.assistant,
        ...(parsedConfig.assistant || {})
      }
    };
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
export const getAdminConfig = (): AdminConfig => {
  const adminConfig = localStorage.getItem('adminConfig');
  
  if (!adminConfig) {
    return defaultAdminConfig;
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
    return defaultAdminConfig;
  }
};

// Save admin configuration to localStorage
export const updateAdminConfig = (config: AdminConfig): boolean => {
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

// Get training files from localStorage
export const getTrainingFiles = (): TrainingFile[] => {
  const config = getAgentConfig();
  return config.trainingFiles || [];
};

// Add a training file in localStorage
export const addTrainingFile = (file: TrainingFile): boolean => {
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

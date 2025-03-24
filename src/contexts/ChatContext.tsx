
import React, { createContext, useContext, useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import * as database from "@/services/databaseService";
import {
  Message,
  Conversation,
  WidgetConfig,
  AgentConfig,
  AdminConfig,
  ChatContextType,
  AgentFunction,
  TrainingFile
} from "@/types/chat";

// Re-export the types
export type {
  Message,
  Conversation,
  WidgetConfig,
  AgentConfig,
  AdminConfig,
  AgentFunction,
  TrainingFile
};

// Create the chat context
export const ChatContext = createContext<ChatContextType>({
  messages: [],
  conversations: [],
  currentConversationId: null,
  widgetConfig: {
    position: "bottom-right",
    title: "Chat Assistant",
    subtitle: "How can I help you today?",
    primaryColor: "#000000",
    iconType: "chat"
  },
  agentConfig: {
    systemPrompt: "You are a helpful assistant. Provide clear and concise information to the user's queries.",
    functions: [],
    voice: {
      enabled: true,
      voiceId: "alloy",
      language: "en-US",
      latency: 100
    },
    trainingFiles: [],
    model: "gpt-4o",
    temperature: 0.7,
    maxTokens: 1000,
    detectEmotion: false
  },
  adminConfig: {
    username: "admin",
    passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // "admin" in SHA-256
    apiKey: ""
  },
  isDbConnected: false,
  updateWidgetConfig: () => Promise.resolve(false),
  updateAgentConfig: () => Promise.resolve(false),
  updateAdminConfig: () => Promise.resolve(false),
  sendMessage: () => Promise.resolve(false),
  addTrainingFile: () => Promise.resolve(false),
  removeTrainingFile: () => Promise.resolve(false),
  loadData: () => Promise.resolve()
});

export const useChat = () => useContext(ChatContext);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State for messages, conversations, and configurations
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>({
    position: "bottom-right",
    title: "Chat Assistant",
    subtitle: "How can I help you today?",
    primaryColor: "#000000",
    iconType: "chat"
  });
  
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    systemPrompt: "You are a helpful assistant. Provide clear and concise information to the user's queries.",
    functions: [],
    voice: {
      enabled: true,
      voiceId: "alloy",
      language: "en-US",
      latency: 100
    },
    trainingFiles: [],
    model: "gpt-4o", 
    temperature: 0.7,
    maxTokens: 1000,
    detectEmotion: false
  });
  
  const [adminConfig, setAdminConfig] = useState<AdminConfig>({
    username: "admin",
    passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // "admin" in SHA-256
    apiKey: ""
  });

  const [isDbConnected, setIsDbConnected] = useState(false);
  
  // Check database connection on component mount
  useEffect(() => {
    const initializeData = async () => {
      try {
        const isConnected = await database.initDatabase();
        console.log("Database connection initialized:", isConnected);
        setIsDbConnected(isConnected);
        await loadData();
      } catch (error) {
        console.error("Error initializing database:", error);
        setIsDbConnected(false);
      }
    };
    
    initializeData();
  }, []);
  
  // Function to load all data from the database
  const loadData = async () => {
    try {
      console.log("Loading data from database/localStorage...");
      
      // Load widget configuration
      const widgetCfg = await database.getWidgetConfig();
      if (widgetCfg) {
        console.log("Widget config loaded:", widgetCfg);
        setWidgetConfig(widgetCfg);
      }
      
      // Load agent configuration
      const agentCfg = await database.getAgentConfig();
      if (agentCfg) {
        console.log("Agent config loaded:", agentCfg);
        // Ensure we have the default fields for agent config
        const mergedAgentConfig = {
          ...agentConfig, // Default values
          ...agentCfg,    // Values from database
        };
        setAgentConfig(mergedAgentConfig);
      }
      
      // Load admin configuration
      const adminCfg = await database.getAdminConfig();
      if (adminCfg) {
        console.log("Admin config loaded:", adminCfg);
        setAdminConfig(adminCfg);
      }
      
      // Load conversations
      const convs = await database.getConversations();
      if (convs && convs.length > 0) {
        console.log(`${convs.length} conversations loaded`);
        setConversations(convs);
      }
      
      // Update database connection status
      const connectionStatus = database.isConnected();
      console.log("Database connection status after loading data:", connectionStatus);
      setIsDbConnected(connectionStatus);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };
  
  // Function to update widget configuration
  const updateWidgetConfig = async (config: WidgetConfig) => {
    try {
      console.log("Updating widget config:", config);
      const success = await database.updateWidgetConfig(config);
      if (success) {
        setWidgetConfig(config);
        console.log("Widget config updated successfully");
      } else {
        console.error("Failed to update widget config");
      }
      return success;
    } catch (error) {
      console.error("Error updating widget config:", error);
      return false;
    }
  };
  
  // Function to update agent configuration
  const updateAgentConfig = async (config: AgentConfig) => {
    try {
      console.log("Updating agent config");
      const success = await database.updateAgentConfig(config);
      if (success) {
        setAgentConfig(config);
        console.log("Agent config updated successfully");
      } else {
        console.error("Failed to update agent config");
      }
      return success;
    } catch (error) {
      console.error("Error updating agent config:", error);
      return false;
    }
  };
  
  // Function to update admin configuration
  const updateAdminConfig = async (config: AdminConfig) => {
    try {
      console.log("Updating admin config");
      const success = await database.updateAdminConfig(config);
      if (success) {
        setAdminConfig(config);
        console.log("Admin config updated successfully");
      } else {
        console.error("Failed to update admin config");
      }
      return success;
    } catch (error) {
      console.error("Error updating admin config:", error);
      return false;
    }
  };
  
  // Function to add a message directly
  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
    // Update conversation if it exists
    if (currentConversationId) {
      setConversations(prev => {
        return prev.map(conv => {
          if (conv.id === currentConversationId) {
            return {
              ...conv,
              messages: [...conv.messages, message]
            };
          }
          return conv;
        });
      });
    }
  };

  // Function to update a message
  const updateMessage = (messageId: string, updatedContent: string) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, content: updatedContent } : msg
      )
    );
    
    // Update in conversations too
    if (currentConversationId) {
      setConversations(prev => {
        return prev.map(conv => {
          if (conv.id === currentConversationId) {
            return {
              ...conv,
              messages: conv.messages.map(msg => 
                msg.id === messageId ? { ...msg, content: updatedContent } : msg
              )
            };
          }
          return conv;
        });
      });
    }
  };

  // Function to start a new conversation
  const startNewConversation = () => {
    const newConversationId = uuidv4();
    setCurrentConversationId(newConversationId);
    setMessages([]);
    // Create the new conversation in state
    setConversations(prev => [...prev, {
      id: newConversationId,
      messages: [],
      isActive: true,
      createdAt: new Date()
    }]);
    // Also create it in the database
    database.createConversation(newConversationId).catch(err => {
      console.error("Error creating new conversation:", err);
    });
  };
  
  // Function to send a message
  const sendMessage = async (content: string) => {
    if (!currentConversationId) {
      // Create a new conversation if one doesn't exist
      const newConversationId = uuidv4();
      const conversationCreated = await database.createConversation(newConversationId);
      
      if (conversationCreated) {
        setCurrentConversationId(newConversationId);
        setConversations(prev => [...prev, {
          id: newConversationId,
          messages: [],
          isActive: true,
          createdAt: new Date()
        }]);
      } else {
        console.error('Failed to create new conversation');
        return false;
      }
    }
    
    const newMessage = {
      id: uuidv4(),
      role: "user" as const,
      content: content,
      timestamp: new Date()
    };
    
    const messageAdded = await database.addMessage(currentConversationId as string, newMessage);
    
    if (messageAdded) {
      addMessage(newMessage);
      return true;
    } else {
      console.error('Failed to add message to conversation');
      return false;
    }
  };
  
  // Function to add a training file
  const addTrainingFile = async (file: TrainingFile | File) => {
    try {
      // Handle both TrainingFile objects and File objects
      let trainingFile: TrainingFile;
      
      if (file instanceof File) {
        // If it's a browser File object, create a TrainingFile
        const content = await readFileContents(file);
        trainingFile = {
          id: uuidv4(),
          name: file.name,
          content,
          size: file.size,
          type: file.type,
          timestamp: new Date()
        };
      } else {
        // Already a TrainingFile object
        trainingFile = file;
      }
      
      const success = await database.addTrainingFile(trainingFile);
      if (success) {
        setAgentConfig(prev => ({
          ...prev,
          trainingFiles: [...prev.trainingFiles, trainingFile]
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error adding training file:", error);
      return false;
    }
  };
  
  // Function to remove a training file
  const removeTrainingFile = async (id: string) => {
    try {
      const success = await database.removeTrainingFile(id);
      if (success) {
        setAgentConfig(prev => ({
          ...prev,
          trainingFiles: prev.trainingFiles.filter(file => file.id !== id)
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error removing training file:", error);
      return false;
    }
  };

  // Helper function to read file contents
  const readFileContents = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };
  
  return (
    <ChatContext.Provider
      value={{
        messages,
        conversations,
        currentConversationId,
        widgetConfig,
        agentConfig,
        adminConfig,
        isDbConnected,
        isWidgetOpen,
        setIsWidgetOpen,
        isVoiceChatActive,
        setIsVoiceChatActive,
        updateWidgetConfig,
        updateAgentConfig,
        updateAdminConfig,
        sendMessage,
        addMessage,
        updateMessage,
        startNewConversation,
        addTrainingFile,
        removeTrainingFile,
        loadData
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

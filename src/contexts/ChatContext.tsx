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
    trainingFiles: []
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
    trainingFiles: []
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
      const isConnected = await database.initDatabase();
      setIsDbConnected(isConnected);
      await loadData();
    };
    
    initializeData();
  }, []);
  
  // Function to load all data from the database
  const loadData = async () => {
    // Load widget configuration
    const widgetCfg = await database.getWidgetConfig();
    setWidgetConfig(widgetCfg);
    
    // Load agent configuration
    const agentCfg = await database.getAgentConfig();
    setAgentConfig(agentCfg);
    
    // Load admin configuration
    const adminCfg = await database.getAdminConfig();
    setAdminConfig(adminCfg);
    
    // Load conversations
    const convs = await database.getConversations();
    setConversations(convs);
    
    // Update database connection status
    setIsDbConnected(database.isConnected());
  };
  
  // Function to update widget configuration
  const updateWidgetConfig = async (config: WidgetConfig) => {
    const success = await database.updateWidgetConfig(config);
    if (success) {
      setWidgetConfig(config);
    }
    return success;
  };
  
  // Function to update agent configuration
  const updateAgentConfig = async (config: AgentConfig) => {
    const success = await database.updateAgentConfig(config);
    if (success) {
      setAgentConfig(config);
    }
    return success;
  };
  
  // Function to update admin configuration
  const updateAdminConfig = async (config: AdminConfig) => {
    const success = await database.updateAdminConfig(config);
    if (success) {
      setAdminConfig(config);
    }
    return success;
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
      conversationId: currentConversationId as string,
      role: "user" as const,
      content: content,
      timestamp: new Date()
    };
    
    const messageAdded = await database.addMessage(currentConversationId as string, newMessage);
    
    if (messageAdded) {
      setMessages(prev => [...prev, newMessage]);
      setConversations(prev => {
        return prev.map(conv => {
          if (conv.id === currentConversationId) {
            return {
              ...conv,
              messages: [...conv.messages, newMessage]
            };
          }
          return conv;
        });
      });
      return true;
    } else {
      console.error('Failed to add message to conversation');
      return false;
    }
  };
  
  // Function to add a training file
  const addTrainingFile = async (file: TrainingFile) => {
    const success = await database.addTrainingFile(file);
    if (success) {
      setAgentConfig(prev => ({
        ...prev,
        trainingFiles: [...prev.trainingFiles, file]
      }));
    }
    return success;
  };
  
  // Function to remove a training file
  const removeTrainingFile = async (id: string) => {
    const success = await database.removeTrainingFile(id);
    if (success) {
      setAgentConfig(prev => ({
        ...prev,
        trainingFiles: prev.trainingFiles.filter(file => file.id !== id)
      }));
    }
    return success;
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
        updateWidgetConfig,
        updateAgentConfig,
        updateAdminConfig,
        sendMessage,
        addTrainingFile,
        removeTrainingFile,
        loadData
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

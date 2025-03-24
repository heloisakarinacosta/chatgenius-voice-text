
import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { getWidgetConfig, getAgentConfig, updateWidgetConfig, updateAgentConfig, getAdminConfig, updateAdminConfig, isConnected } from "@/services/databaseService";
import { v4 as uuidv4 } from "uuid";

// Define types
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

export interface WidgetConfig {
  position: string;
  title: string;
  subtitle: string;
  primaryColor: string;
  iconType: string;
}

export interface TrainingFile {
  id: string;
  name: string;
  content: string;
  size: number;
  type: string;
  timestamp: Date;
}

export interface AgentFunction {
  name: string;
  description: string;
  parameters: Record<string, any>;
  webhook?: string;
}

export interface AdminConfig {
  username: string;
  passwordHash: string;
  apiKey: string;  // Adding the apiKey property here
}

export interface AgentConfig {
  systemPrompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
  detectEmotion: boolean;
  voice: {
    enabled: boolean;
    voiceId: string;
    language: string;
    latency: number;
  };
  functions: AgentFunction[];
  trainingFiles: TrainingFile[];
}

interface ChatContextType {
  isWidgetOpen: boolean;
  setIsWidgetOpen: (open: boolean) => void;
  isVoiceChatActive: boolean;
  setIsVoiceChatActive: (active: boolean) => void;
  messages: Message[];
  addMessage: (content: string, role: "user" | "assistant" | "system") => string;
  updateMessage: (id: string, content: string) => void;
  clearMessages: () => void;
  startNewConversation: () => void;
  widgetConfig: WidgetConfig;
  setWidgetConfig: (config: WidgetConfig) => void;
  updateWidgetConfig: (config: WidgetConfig) => Promise<boolean>;
  agentConfig: AgentConfig;
  setAgentConfig: (config: AgentConfig) => void;
  updateAgentConfig: (config: AgentConfig) => Promise<boolean>;
  adminConfig: AdminConfig;
  updateAdminConfig: (config: AdminConfig) => Promise<boolean>;
  addTrainingFile: (file: File) => Promise<void>;
  removeTrainingFile: (id: string) => void;
  isDbConnected: boolean;
  setIsDbConnected: (connected: boolean) => void;
}

const defaultContext: ChatContextType = {
  isWidgetOpen: false,
  setIsWidgetOpen: () => {},
  isVoiceChatActive: false,
  setIsVoiceChatActive: () => {},
  messages: [],
  addMessage: () => "",
  updateMessage: () => {},
  clearMessages: () => {},
  startNewConversation: () => {},
  widgetConfig: {
    position: "bottom-right",
    title: "Chat Assistant",
    subtitle: "Como posso ajudar você hoje?",
    primaryColor: "#000000",
    iconType: "chat",
  },
  setWidgetConfig: () => {},
  updateWidgetConfig: async () => false,
  agentConfig: {
    systemPrompt: "Você é um assistente de IA útil e amigável.",
    model: "gpt-4o-mini",
    maxTokens: 1024,
    temperature: 0.7,
    detectEmotion: false,
    voice: {
      enabled: true,
      voiceId: "alloy",
      language: "pt-BR",
      latency: 100,
    },
    functions: [],
    trainingFiles: [],
  },
  setAgentConfig: () => {},
  updateAgentConfig: async () => false,
  adminConfig: {
    username: "admin",
    passwordHash: "",
    apiKey: "",
  },
  updateAdminConfig: async () => false,
  addTrainingFile: async () => {},
  removeTrainingFile: () => {},
  isDbConnected: false,
  setIsDbConnected: () => {},
};

const ChatContext = createContext<ChatContextType>(defaultContext);

export const useChat = () => useContext(ChatContext);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>(defaultContext.widgetConfig);
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(defaultContext.agentConfig);
  const [adminConfig, setAdminConfig] = useState<AdminConfig>(defaultContext.adminConfig);
  const [isDbConnected, setIsDbConnected] = useState(isConnected());

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const widgetConfigData = await getWidgetConfig();
        if (widgetConfigData) {
          setWidgetConfig(widgetConfigData);
        }

        const agentConfigData = await getAgentConfig();
        if (agentConfigData) {
          if (agentConfigData.trainingFiles) {
            agentConfigData.trainingFiles = agentConfigData.trainingFiles.map((file) => ({
              ...file,
              timestamp: new Date(file.timestamp),
            }));
          }
          setAgentConfig(agentConfigData);
        }
        
        const adminConfigData = await getAdminConfig();
        if (adminConfigData) {
          setAdminConfig({
            username: adminConfigData.username || "admin",
            passwordHash: adminConfigData.passwordHash || "",
            apiKey: adminConfigData.apiKey || "",
          });
        }
        
        setIsDbConnected(isConnected());
      } catch (error) {
        console.error("Error loading configurations:", error);
      }
    };

    loadConfig();
  }, []);

  const addMessage = useCallback((content: string, role: "user" | "assistant" | "system"): string => {
    const id = uuidv4();
    const newMessage: Message = {
      id,
      role,
      content,
      timestamp: new Date(),
    };

    setMessages((prevMessages) => [...prevMessages, newMessage]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, content: string) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === id ? { ...msg, content } : msg
      )
    );
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const startNewConversation = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  const handleUpdateWidgetConfig = useCallback(async (config: WidgetConfig) => {
    setWidgetConfig(config);
    return await updateWidgetConfig(config);
  }, []);

  const handleUpdateAgentConfig = useCallback(async (config: AgentConfig) => {
    setAgentConfig(config);
    return await updateAgentConfig(config);
  }, []);

  const handleUpdateAdminConfig = useCallback(async (config: AdminConfig) => {
    setAdminConfig(config);
    return await updateAdminConfig(config);
  }, []);

  const addTrainingFile = useCallback(async (file: File) => {
    try {
      const reader = new FileReader();
      
      const filePromise = new Promise<TrainingFile>((resolve) => {
        reader.onload = (e) => {
          const newFile: TrainingFile = {
            id: uuidv4(),
            name: file.name,
            content: e.target?.result as string,
            size: file.size,
            type: file.type,
            timestamp: new Date()
          };
          
          resolve(newFile);
        };
      });
      
      reader.readAsText(file);
      
      const newFile = await filePromise;
      
      setAgentConfig((prev) => ({
        ...prev,
        trainingFiles: [...prev.trainingFiles, newFile],
      }));
      
      await updateAgentConfig({
        ...agentConfig,
        trainingFiles: [...agentConfig.trainingFiles, newFile]
      });
      
    } catch (error) {
      console.error("Error adding training file:", error);
      throw error;
    }
  }, [agentConfig]);

  const removeTrainingFile = useCallback((id: string) => {
    setAgentConfig((prev) => {
      const updatedConfig = {
        ...prev,
        trainingFiles: prev.trainingFiles.filter((file) => file.id !== id),
      };
      
      updateAgentConfig(updatedConfig).catch(err => {
        console.error("Error saving agent config after removing file:", err);
      });
      
      return updatedConfig;
    });
  }, []);

  const contextValue: ChatContextType = {
    isWidgetOpen,
    setIsWidgetOpen,
    isVoiceChatActive,
    setIsVoiceChatActive,
    messages,
    addMessage,
    updateMessage,
    clearMessages,
    startNewConversation,
    widgetConfig,
    setWidgetConfig,
    updateWidgetConfig: handleUpdateWidgetConfig,
    agentConfig,
    setAgentConfig,
    updateAgentConfig: handleUpdateAgentConfig,
    adminConfig,
    updateAdminConfig: handleUpdateAdminConfig,
    addTrainingFile,
    removeTrainingFile,
    isDbConnected,
    setIsDbConnected,
  };

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
};

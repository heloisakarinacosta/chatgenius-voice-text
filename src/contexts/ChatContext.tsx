
import React, { createContext, useState, useContext, useCallback, useEffect, ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import * as db from "../services/database";
import { toast } from "sonner";

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

export interface VoiceConfig {
  enabled: boolean;
  voiceId: string;
  language: string;
  latency: number;
}

export interface TrainingFile {
  id: string;
  name: string;
  content: string;
  size: number;
  type: string;
  timestamp: Date;
}

export interface AgentConfig {
  systemPrompt: string;
  functions: AgentFunction[];
  voice: VoiceConfig;
  trainingFiles: TrainingFile[];
}

export interface AgentFunction {
  name: string;
  description: string;
  parameters: Record<string, any>;
  webhook: string;
}

export interface WidgetConfig {
  position: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "center-right" | "center-left";
  title: string;
  subtitle: string;
  primaryColor: string;
  iconType: "chat" | "support" | "help";
}

export interface AdminConfig {
  username: string;
  passwordHash: string;
}

interface ChatContextType {
  conversations: Conversation[];
  currentConversationId: string | null;
  isWidgetOpen: boolean;
  isVoiceChatActive: boolean;
  widgetConfig: WidgetConfig;
  agentConfig: AgentConfig;
  adminConfig: AdminConfig;
  messages: Message[];
  setIsWidgetOpen: (isOpen: boolean) => void;
  setIsVoiceChatActive: (isActive: boolean) => void;
  startNewConversation: () => string;
  switchConversation: (id: string) => void;
  addMessage: (content: string, role: "user" | "assistant" | "system") => void;
  updateWidgetConfig: (config: Partial<WidgetConfig>) => void;
  updateAgentConfig: (config: Partial<AgentConfig>) => void;
  updateAdminConfig: (config: Partial<AdminConfig>) => void;
  addTrainingFile: (file: File) => Promise<void>;
  removeTrainingFile: (id: string) => void;
  isDbConnected: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

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
    voiceId: "alloy", // Default OpenAI voice
    language: "en-US",
    latency: 100,
  },
  trainingFiles: [],
};

const defaultAdminConfig: AdminConfig = {
  username: "admin",
  passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // "admin" - SHA-256 hashed
};

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>(defaultWidgetConfig);
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(defaultAgentConfig);
  const [adminConfig, setAdminConfig] = useState<AdminConfig>(defaultAdminConfig);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Inicializa a conexão com o banco de dados
  useEffect(() => {
    const initializeDb = async () => {
      try {
        const connected = await db.initDatabase();
        setIsDbConnected(connected);
        
        if (connected) {
          // Carrega dados do banco de dados
          await loadDataFromDb();
        } else {
          // Carrega dados do localStorage como fallback
          loadDataFromLocalStorage();
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error initializing database:", error);
        setIsDbConnected(false);
        loadDataFromLocalStorage();
        setIsLoading(false);
      }
    };
    
    initializeDb();
  }, []);

  // Carrega dados do banco de dados
  const loadDataFromDb = async () => {
    try {
      // Carrega configurações do widget
      const widgetConfigData = await db.getWidgetConfig();
      if (widgetConfigData) {
        setWidgetConfig(widgetConfigData as WidgetConfig);
      }
      
      // Carrega configurações do agente
      const agentConfigData = await db.getAgentConfig();
      if (agentConfigData) {
        setAgentConfig(agentConfigData as AgentConfig);
      }
      
      // Carrega configurações de admin
      const adminConfigData = await db.getAdminConfig();
      if (adminConfigData) {
        setAdminConfig(adminConfigData as AdminConfig);
      }
      
      // Carrega conversas
      const conversationsData = await db.getConversations();
      if (conversationsData && conversationsData.length > 0) {
        setConversations(conversationsData as Conversation[]);
      }
    } catch (error) {
      console.error("Error loading data from database:", error);
      toast.error("Failed to load data from database. Using local storage as fallback.");
      loadDataFromLocalStorage();
    }
  };

  // Carrega dados do localStorage como fallback
  const loadDataFromLocalStorage = () => {
    const storedWidgetConfig = localStorage.getItem("widgetConfig");
    const storedAgentConfig = localStorage.getItem("agentConfig");
    const storedAdminConfig = localStorage.getItem("adminConfig");
    const storedConversations = localStorage.getItem("conversations");

    if (storedWidgetConfig) setWidgetConfig(JSON.parse(storedWidgetConfig));
    if (storedAgentConfig) setAgentConfig(JSON.parse(storedAgentConfig));
    if (storedAdminConfig) setAdminConfig(JSON.parse(storedAdminConfig));
    if (storedConversations) {
      const parsedConversations = JSON.parse(storedConversations);
      // Convert string timestamps back to Date objects
      const conversationsWithDates = parsedConversations.map((conv: any) => ({
        ...conv,
        createdAt: new Date(conv.createdAt),
        messages: conv.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
      }));
      setConversations(conversationsWithDates);
    }
  };

  // Salva configurações quando elas mudam
  useEffect(() => {
    if (!isLoading) {
      if (isDbConnected) {
        // Atualiza no banco de dados
        db.updateWidgetConfig(widgetConfig);
      } else {
        // Salva no localStorage como fallback
        localStorage.setItem("widgetConfig", JSON.stringify(widgetConfig));
      }
    }
  }, [widgetConfig, isDbConnected, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      if (isDbConnected) {
        // Atualiza no banco de dados
        db.updateAgentConfig(agentConfig);
      } else {
        // Salva no localStorage como fallback
        localStorage.setItem("agentConfig", JSON.stringify(agentConfig));
      }
    }
  }, [agentConfig, isDbConnected, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      if (isDbConnected) {
        // Atualiza no banco de dados
        db.updateAdminConfig(adminConfig);
      } else {
        // Salva no localStorage como fallback
        localStorage.setItem("adminConfig", JSON.stringify(adminConfig));
      }
    }
  }, [adminConfig, isDbConnected, isLoading]);

  useEffect(() => {
    if (!isLoading && !isDbConnected) {
      // Salva conversas no localStorage apenas como fallback
      // Deep clone to avoid circular references
      const conversationsForStorage = conversations.map(conv => ({
        ...conv,
        messages: conv.messages.map(msg => ({
          ...msg,
        })),
      }));
      localStorage.setItem("conversations", JSON.stringify(conversationsForStorage));
    }
  }, [conversations, isDbConnected, isLoading]);

  const startNewConversation = useCallback(() => {
    const newId = uuidv4();
    const newConversation: Conversation = {
      id: newId,
      messages: [],
      isActive: true,
      createdAt: new Date(),
    };
    
    setConversations(prev => [...prev, newConversation]);
    setCurrentConversationId(newId);
    
    if (isDbConnected) {
      // Cria a conversa no banco de dados
      db.createConversation(newId);
    }
    
    return newId;
  }, [isDbConnected]);

  const switchConversation = useCallback((id: string) => {
    if (conversations.some(conv => conv.id === id)) {
      setCurrentConversationId(id);
    }
  }, [conversations]);

  const addMessage = useCallback((content: string, role: "user" | "assistant" | "system") => {
    if (!currentConversationId) {
      const newId = startNewConversation();
      setCurrentConversationId(newId);
    }
    
    const newMessage: Message = {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date(),
    };
    
    setConversations(prev => 
      prev.map(conv => 
        conv.id === currentConversationId 
          ? { ...conv, messages: [...conv.messages, newMessage] } 
          : conv
      )
    );
    
    if (isDbConnected && currentConversationId) {
      // Adiciona a mensagem no banco de dados
      db.addMessage(currentConversationId, newMessage);
    }
  }, [currentConversationId, startNewConversation, isDbConnected]);

  const updateWidgetConfig = useCallback((config: Partial<WidgetConfig>) => {
    setWidgetConfig(prev => {
      const newConfig = { ...prev, ...config };
      return newConfig;
    });
  }, []);

  const updateAgentConfig = useCallback((config: Partial<AgentConfig>) => {
    setAgentConfig(prev => ({ ...prev, ...config }));
  }, []);

  const updateAdminConfig = useCallback((config: Partial<AdminConfig>) => {
    setAdminConfig(prev => ({ ...prev, ...config }));
  }, []);

  // Adiciona um arquivo de treinamento
  const addTrainingFile = useCallback(async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        if (event.target && event.target.result) {
          const newFile: TrainingFile = {
            id: uuidv4(),
            name: file.name,
            content: event.target.result as string,
            size: file.size,
            type: file.type,
            timestamp: new Date(),
          };
          
          setAgentConfig(prev => ({
            ...prev,
            trainingFiles: [...prev.trainingFiles, newFile],
          }));
          
          if (isDbConnected) {
            // Adiciona o arquivo no banco de dados
            await db.addTrainingFile(newFile);
          }
          
          resolve();
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      
      reader.onerror = () => {
        reject(new Error("Error reading file"));
      };
      
      reader.readAsText(file);
    });
  }, [isDbConnected]);

  // Remove um arquivo de treinamento
  const removeTrainingFile = useCallback((id: string) => {
    setAgentConfig(prev => ({
      ...prev,
      trainingFiles: prev.trainingFiles.filter(file => file.id !== id),
    }));
    
    if (isDbConnected) {
      // Remove o arquivo do banco de dados
      db.removeTrainingFile(id);
    }
  }, [isDbConnected]);

  // Obtém mensagens para a conversa atual
  const messages = currentConversationId 
    ? conversations.find(conv => conv.id === currentConversationId)?.messages || []
    : [];

  // Mostra indicador de carregamento enquanto os dados são inicializados
  if (isLoading) {
    return <div>Loading...</div>;
  }

  const value = {
    conversations,
    currentConversationId,
    isWidgetOpen,
    isVoiceChatActive,
    widgetConfig,
    agentConfig,
    adminConfig,
    messages,
    setIsWidgetOpen,
    setIsVoiceChatActive,
    startNewConversation,
    switchConversation,
    addMessage,
    updateWidgetConfig,
    updateAgentConfig,
    updateAdminConfig,
    addTrainingFile,
    removeTrainingFile,
    isDbConnected,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

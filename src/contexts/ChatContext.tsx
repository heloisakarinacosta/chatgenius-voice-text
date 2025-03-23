
import React, { createContext, useState, useContext, useCallback, useEffect, ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";

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

export interface AgentConfig {
  systemPrompt: string;
  functions: AgentFunction[];
  voice: VoiceConfig;
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

  // Load configurations from localStorage
  useEffect(() => {
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
  }, []);

  // Save configurations to localStorage when they change
  useEffect(() => {
    localStorage.setItem("widgetConfig", JSON.stringify(widgetConfig));
    localStorage.setItem("agentConfig", JSON.stringify(agentConfig));
    localStorage.setItem("adminConfig", JSON.stringify(adminConfig));
    
    // Deep clone to avoid circular references
    const conversationsForStorage = conversations.map(conv => ({
      ...conv,
      messages: conv.messages.map(msg => ({
        ...msg,
      })),
    }));
    localStorage.setItem("conversations", JSON.stringify(conversationsForStorage));
  }, [widgetConfig, agentConfig, adminConfig, conversations]);

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
    return newId;
  }, []);

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
  }, [currentConversationId, startNewConversation]);

  const updateWidgetConfig = useCallback((config: Partial<WidgetConfig>) => {
    setWidgetConfig(prev => ({ ...prev, ...config }));
  }, []);

  const updateAgentConfig = useCallback((config: Partial<AgentConfig>) => {
    setAgentConfig(prev => ({ ...prev, ...config }));
  }, []);

  const updateAdminConfig = useCallback((config: Partial<AdminConfig>) => {
    setAdminConfig(prev => ({ ...prev, ...config }));
  }, []);

  // Get messages for the current conversation
  const messages = currentConversationId 
    ? conversations.find(conv => conv.id === currentConversationId)?.messages || []
    : [];

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

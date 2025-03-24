
import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { fetchWidgetConfig, fetchAgentConfig } from "@/services/databaseService";
import { v4 as uuidv4 } from "uuid";

// Defina os tipos
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
  functions: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
    webhook?: string;
  }>;
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
  agentConfig: AgentConfig;
  setAgentConfig: (config: AgentConfig) => void;
  addTrainingFile: (file: TrainingFile) => void;
  removeTrainingFile: (id: string) => void;
  isDbConnected: boolean;
  setIsDbConnected: (connected: boolean) => void;
}

// Valor padrão para o contexto
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
  addTrainingFile: () => {},
  removeTrainingFile: () => {},
  isDbConnected: false,
  setIsDbConnected: () => {},
};

// Crie o contexto
const ChatContext = createContext<ChatContextType>(defaultContext);

// Hook personalizado para acessar o contexto
export const useChat = () => useContext(ChatContext);

// Provedor do contexto
export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>(defaultContext.widgetConfig);
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(defaultContext.agentConfig);
  const [isDbConnected, setIsDbConnected] = useState(false);

  // Carrega a configuração inicial
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Carrega a configuração do widget
        const widgetConfigData = await fetchWidgetConfig();
        if (widgetConfigData) {
          setWidgetConfig(widgetConfigData);
        }

        // Carrega a configuração do agente
        const agentConfigData = await fetchAgentConfig();
        if (agentConfigData) {
          // Certifique-se de que as datas nas trainingFiles são objetos Date
          if (agentConfigData.trainingFiles) {
            agentConfigData.trainingFiles = agentConfigData.trainingFiles.map((file) => ({
              ...file,
              timestamp: new Date(file.timestamp),
            }));
          }
          setAgentConfig(agentConfigData);
        }
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
      }
    };

    loadConfig();
  }, []);

  // Adicionar uma mensagem
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

  // Atualizar uma mensagem existente
  const updateMessage = useCallback((id: string, content: string) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === id ? { ...msg, content } : msg
      )
    );
  }, []);

  // Limpar todas as mensagens
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Iniciar uma nova conversa
  const startNewConversation = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  // Adicionar um arquivo de treinamento
  const addTrainingFile = useCallback((file: TrainingFile) => {
    setAgentConfig((prev) => ({
      ...prev,
      trainingFiles: [...prev.trainingFiles, file],
    }));
  }, []);

  // Remover um arquivo de treinamento
  const removeTrainingFile = useCallback((id: string) => {
    setAgentConfig((prev) => ({
      ...prev,
      trainingFiles: prev.trainingFiles.filter((file) => file.id !== id),
    }));
  }, []);

  // Valor do contexto
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
    agentConfig,
    setAgentConfig,
    addTrainingFile,
    removeTrainingFile,
    isDbConnected,
    setIsDbConnected,
  };

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
};

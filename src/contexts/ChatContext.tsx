
import React, { createContext, useContext, useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import * as database from "@/services/databaseService";
import { toast } from "sonner";
import {
  Message,
  Conversation,
  WidgetConfig,
  AgentConfig,
  AdminConfig,
  ChatContextType,
  AgentFunction,
  TrainingFile,
  VoiceConfig,
  KnowledgeType,
  FineTuningConfig,
  AssistantConfig
} from "@/types/chat";

// Re-export the types
export type {
  Message,
  Conversation,
  WidgetConfig,
  AgentConfig,
  AdminConfig,
  AgentFunction,
  TrainingFile,
  VoiceConfig,
  KnowledgeType,
  FineTuningConfig,
  AssistantConfig
};

// Create the chat context with correct types
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
      latency: 100,
      silenceTimeout: 10,
      maxCallDuration: 1800,
      waitBeforeSpeaking: 0.4,
      waitAfterPunctuation: 0.1,
      waitWithoutPunctuation: 1.5,
      waitAfterNumber: 0.5,
      endCallMessage: "Encerrando chamada por inatividade. Obrigado pela conversa."
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
  },
  adminConfig: {
    username: "admin",
    passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // "admin" in SHA-256
    apiKey: ""
  },
  isDbConnected: false,
  isWidgetOpen: false,
  setIsWidgetOpen: () => {},
  isVoiceChatActive: false,
  setIsVoiceChatActive: () => {},
  updateWidgetConfig: () => Promise.resolve(false),
  updateAgentConfig: () => Promise.resolve(false),
  updateAdminConfig: () => Promise.resolve(false),
  sendMessage: () => Promise.resolve(false),
  addMessage: () => "",
  updateMessage: () => {},
  startNewConversation: () => Promise.resolve(null),
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
      latency: 100,
      silenceTimeout: 10,
      maxCallDuration: 1800,
      waitBeforeSpeaking: 0.4,
      waitAfterPunctuation: 0.1,
      waitWithoutPunctuation: 1.5,
      waitAfterNumber: 0.5,
      endCallMessage: "Encerrando chamada por inatividade. Obrigado pela conversa."
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
          voice: {
            ...agentConfig.voice, // Default voice values
            ...agentCfg.voice     // Voice values from database
          },
          // Ensure new fields have defaults
          knowledgeType: agentCfg.knowledgeType || 'rag',
          rag: agentCfg.rag || { enabled: true },
          fineTuning: agentCfg.fineTuning || { enabled: false, modelId: '', status: 'not_started' },
          assistant: agentCfg.assistant || { enabled: false, assistantId: '', name: '' }
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
  const addMessage = (content: string, role: "user" | "assistant" | "system"): string => {
    const messageId = uuidv4();
    
    // Enhanced duplicate message detection
    // Check if the exact same message from the same role exists in the last 10 seconds
    const recentDuplicateMessage = messages.find(msg => 
      msg.role === role && 
      msg.content === content &&
      new Date().getTime() - msg.timestamp.getTime() < 10000
    );
    
    if (recentDuplicateMessage) {
      console.log("Duplicate message detected, skipping:", content.substring(0, 30));
      return recentDuplicateMessage.id;
    }
    
    const newMessage: Message = {
      id: messageId,
      role: role,
      content: content,
      timestamp: new Date()
    };
    
    setMessages(prev => {
      // Double-check to make sure we're not adding a duplicate message
      const isDuplicate = prev.some(msg => 
        msg.role === role && 
        msg.content === content && 
        new Date().getTime() - msg.timestamp.getTime() < 10000
      );
      
      if (isDuplicate) {
        console.log("Last-minute duplicate detection prevented adding:", content.substring(0, 30));
        return prev;
      }
      
      return [...prev, newMessage];
    });
    
    // Update conversation if it exists
    if (currentConversationId) {
      setConversations(prev => {
        return prev.map(conv => {
          if (conv.id === currentConversationId) {
            // Check for duplicates in the current conversation
            const isDuplicate = conv.messages.some(msg => 
              msg.role === role && 
              msg.content === content && 
              new Date().getTime() - new Date(msg.timestamp).getTime() < 10000
            );
            
            if (isDuplicate) {
              console.log("Duplicate prevented in conversation:", content.substring(0, 30));
              return conv;
            }
            
            return {
              ...conv,
              messages: [...conv.messages, newMessage]
            };
          }
          return conv;
        });
      });
      
      // Also add the message to the database if not a duplicate
      database.addMessage(currentConversationId, newMessage).catch(err => {
        console.error("Error adding message to database:", err);
      });
    }
    
    return messageId;
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
  const startNewConversation = async (): Promise<string | null> => {
    try {
      const newConversationId = uuidv4();
      
      // Create the conversation in database first
      const success = await database.createConversation(newConversationId);
      
      if (success) {
        setCurrentConversationId(newConversationId);
        setMessages([]);
        
        // Create the new conversation in state
        setConversations(prev => [...prev, {
          id: newConversationId,
          messages: [],
          isActive: true,
          createdAt: new Date()
        }]);
        
        console.log(`New conversation created with ID: ${newConversationId}`);
        return newConversationId;
      } else {
        console.error("Failed to create new conversation in database");
        return null;
      }
    } catch (error) {
      console.error("Error creating new conversation:", error);
      return null;
    }
  };
  
  // Function to send a message
  const sendMessage = async (content: string) => {
    if (!currentConversationId) {
      // Create a new conversation if one doesn't exist
      const newConversationId = await startNewConversation();
      
      if (!newConversationId) {
        console.error('Failed to create new conversation');
        toast.error("Erro ao criar conversa", {
          description: "Tente novamente em alguns instantes."
        });
        return false;
      }
    }
    
    // Check for duplicate messages in the current session (last 10 seconds)
    const recentDuplicate = messages.find(msg => 
      msg.role === "user" && 
      msg.content === content && 
      new Date().getTime() - msg.timestamp.getTime() < 10000
    );
    
    if (recentDuplicate) {
      console.log("Prevented duplicate message from being sent:", content.substring(0, 30));
      return true; // Pretend success to avoid error messages
    }
    
    try {
      const newMessage = {
        id: uuidv4(),
        role: "user" as const,
        content: content,
        timestamp: new Date()
      };
      
      // Add message to database
      const messageAdded = await database.addMessage(currentConversationId, newMessage);
      
      if (messageAdded) {
        // Update state only after successful database operation
        setMessages(prev => {
          // Final duplicate check before adding to messages
          const isDuplicate = prev.some(msg => 
            msg.role === "user" && 
            msg.content === content && 
            new Date().getTime() - msg.timestamp.getTime() < 10000
          );
          
          if (isDuplicate) {
            console.log("Last-second duplicate prevention:", content.substring(0, 30));
            return prev;
          }
          
          return [...prev, newMessage];
        });
        
        // Update conversation with the same duplicate check
        setConversations(prev => {
          return prev.map(conv => {
            if (conv.id === currentConversationId) {
              // Check for duplicates in current conversation
              const isDuplicate = conv.messages.some(msg => 
                msg.role === "user" && 
                msg.content === content && 
                new Date().getTime() - new Date(msg.timestamp).getTime() < 10000
              );
              
              if (isDuplicate) {
                return conv;
              }
              
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
        toast.error("Erro ao enviar mensagem", {
          description: "Tente novamente em alguns instantes."
        });
        return false;
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem", {
        description: "Verifique sua conexão e tente novamente."
      });
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

import React, { useState, useEffect, useRef } from "react";
import { useChat } from "@/contexts/ChatContext";
import ChatBubble from "@/components/ChatBubble";
import VoiceChatAgent from "@/components/VoiceChatAgent";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  Send, 
  Mic, 
  X, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  Maximize2,
  Minimize2
} from "lucide-react";
import { callOpenAI } from "@/utils/openai";

interface ChatWidgetProps {
  apiKey: string | null;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ apiKey }) => {
  const { 
    messages, 
    sendMessage, 
    addMessage,
    updateMessage,
    startNewConversation,
    widgetConfig, 
    isWidgetOpen, 
    setIsWidgetOpen,
    isVoiceChatActive,
    setIsVoiceChatActive,
    currentConversationId,
    agentConfig
  } = useChat();
  
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [errorSending, setErrorSending] = useState(false);
  const [processingMessage, setProcessingMessage] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    if (isWidgetOpen && !isVoiceChatActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isWidgetOpen, isVoiceChatActive]);

  useEffect(() => {
    console.log("ChatWidget: API key present:", !!apiKey);
  }, [apiKey]);

  useEffect(() => {
    const createConversationIfNeeded = async () => {
      if (isWidgetOpen && !currentConversationId) {
        console.log("No conversation ID found, creating a new one");
        try {
          const id = await startNewConversation();
          console.log("Created new conversation with ID:", id);
        } catch (error) {
          console.error("Error creating new conversation:", error);
          toast.error("Erro ao criar nova conversa");
        }
      }
    };
    
    createConversationIfNeeded();
  }, [isWidgetOpen, currentConversationId, startNewConversation]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setErrorSending(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const handleSendMessage = async () => {
    if (inputValue.trim() === "" || isLoading || processingMessage) return;
    
    if (!apiKey) {
      toast.error("Configure sua chave API OpenAI primeiro", {
        description: "Vá para configurações para adicionar sua chave API"
      });
      return;
    }
    
    setIsLoading(true);
    setProcessingMessage(true);
    setErrorSending(false);
    const message = inputValue.trim();
    setInputValue("");
    
    try {
      console.log("Sending message, current conversation ID:", currentConversationId);
      
      if (!currentConversationId) {
        console.log("No active conversation, creating a new one");
        const newId = await startNewConversation();
        if (!newId) {
          throw new Error("Failed to create new conversation");
        }
        console.log("New conversation created with ID:", newId);
      }
      
      const tempMessageId = addMessage(message, "user");
      console.log(`Added message to UI with temp ID: ${tempMessageId}`);
      
      console.log("Sending message to server...");
      const success = await sendMessage(message);
      
      if (!success) {
        console.error("Failed to send message to server");
        setErrorSending(true);
        toast.error("Erro ao enviar mensagem", {
          description: "Não foi possível comunicar com o servidor. Tente novamente."
        });
        return;
      } else {
        console.log("Message sent successfully");
        
        await getAssistantResponse();
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setErrorSending(true);
      toast.error("Erro ao enviar mensagem", {
        description: "Verifique sua conexão e tente novamente."
      });
    } finally {
      setIsLoading(false);
      setProcessingMessage(false);
    }
  };
  
  const getAssistantResponse = async () => {
    if (!apiKey || !currentConversationId) return;
    
    try {
      const conversationMessages = messages.map(msg => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content
      }));
      
      if (agentConfig?.systemPrompt) {
        conversationMessages.unshift({
          role: "system",
          content: agentConfig.systemPrompt
        });
      }
      
      const tempAssistantId = addMessage("...", "assistant");
      
      const response = await callOpenAI({
        messages: conversationMessages,
        model: agentConfig?.model || "gpt-4o-mini",
        temperature: agentConfig?.temperature || 0.7,
        trainingFiles: agentConfig?.trainingFiles || [],
        detectEmotion: agentConfig?.detectEmotion || false
      }, apiKey);
      
      updateMessage(tempAssistantId, response);
      
      console.log("Received response from OpenAI:", response.substring(0, 50) + "...");
    } catch (error) {
      console.error("Error getting assistant response:", error);
      toast.error("Erro ao obter resposta do assistente", {
        description: "Verifique sua chave API e tente novamente."
      });
    }
  };
  
  const handleStartNewConversation = async () => {
    setIsLoading(true);
    try {
      console.log("Starting new conversation");
      const newId = await startNewConversation();
      if (newId) {
        toast.success("Nova conversa iniciada");
        console.log("New conversation started with ID:", newId);
      } else {
        toast.error("Erro ao iniciar nova conversa");
        console.error("No ID returned when starting new conversation");
      }
    } catch (error) {
      console.error("Error starting new conversation:", error);
      toast.error("Erro ao iniciar nova conversa");
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleWidget = () => {
    setIsWidgetOpen(!isWidgetOpen);
    setIsMinimized(false);
  };
  
  const toggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMinimized(!isMinimized);
  };

  const toggleVoiceChat = () => {
    setIsVoiceChatActive(!isVoiceChatActive);
  };
  
  const widgetPosition = widgetConfig?.position || "bottom-right";
  
  const positionClasses = {
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4"
  }[widgetPosition];
  
  const primaryColor = widgetConfig?.primaryColor || "#000000";
  
  const colorStyles = {
    backgroundColor: primaryColor
  };
  
  if (!isWidgetOpen) {
    return (
      <div className={`fixed z-50 ${positionClasses}`}>
        <button
          onClick={toggleWidget}
          className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
          style={colorStyles}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-white"
          >
            <path
              d="M21 11.5C21 16.1944 16.9706 20 12 20C11.3696 20 10.7311 19.9449 10.1092 19.8373L6.5 21.9616V18.5164C4.4342 17.2504 3 14.7663 3 12C3 7.30554 7.02944 3.5 12 3.5C16.9706 3.5 21 7.30554 21 11.5Z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    );
  }
  
  return (
    <div className={`fixed z-50 ${positionClasses}`}>
      <div className="bg-background rounded-lg shadow-lg overflow-hidden flex flex-col w-80 sm:w-96 transition-all duration-300 max-h-[85vh] transform animate-in fade-in slide-in-from-bottom-8">
        <div 
          className="p-4 flex justify-between items-center text-white cursor-pointer"
          style={colorStyles}
          onClick={toggleMinimize}
        >
          <div>
            <h3 className="font-medium">{widgetConfig?.title || "Assistente de Chat"}</h3>
            <p className="text-sm opacity-90">{widgetConfig?.subtitle || "Como posso ajudar você hoje?"}</p>
          </div>
          <div className="flex items-center space-x-2">
            {isMinimized ? (
              <Maximize2 className="h-4 w-4" onClick={toggleMinimize} />
            ) : (
              <Minimize2 className="h-4 w-4" onClick={toggleMinimize} />
            )}
            <X className="h-5 w-5" onClick={toggleWidget} />
          </div>
        </div>
        
        <div className={`flex-1 flex flex-col ${isMinimized ? 'hidden' : ''}`}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[50vh]">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground text-sm text-center">
                  Inicie uma conversa digitando uma mensagem ou usando o chat por voz.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {isVoiceChatActive && (
            <div className="px-4 py-3 border-t">
              <VoiceChatAgent apiKey={apiKey || ""} />
            </div>
          )}
          
          <div className="p-4 border-t bg-muted/30">
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="ghost"
                className={`rounded-full p-2 ${isVoiceChatActive ? 'bg-primary/10 text-primary' : ''}`}
                onClick={toggleVoiceChat}
                title={isVoiceChatActive ? "Desativar chat por voz" : "Ativar chat por voz"}
                disabled={isLoading || processingMessage}
              >
                <Mic className="h-5 w-5" />
              </Button>
              
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                className="flex-1"
                disabled={isLoading || processingMessage}
              />
              
              <Button
                size="sm"
                variant="default"
                className="rounded-full p-2"
                onClick={handleSendMessage}
                disabled={isLoading || processingMessage || inputValue.trim() === ""}
              >
                {isLoading || processingMessage ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            
            {errorSending && (
              <div className="mt-2 text-xs text-red-500">
                Erro ao enviar mensagem. Tente novamente.
              </div>
            )}
            
            <div className="flex justify-center mt-3">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-muted-foreground"
                onClick={handleStartNewConversation}
                disabled={isLoading || processingMessage}
              >
                <RefreshCw className="h-3 w-3 mr-1" /> 
                Nova conversa
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWidget;

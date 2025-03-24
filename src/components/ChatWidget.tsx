import React, { useState, useRef, useEffect } from "react";
import { Send, X, MessageCircle, Volume2, Mic, MicOff, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChat } from "@/contexts/ChatContext";
import { cn } from "@/lib/utils";
import { callOpenAI, streamOpenAI, generateSpeech, OpenAIMessage } from "@/utils/openai";
import ChatBubble from "./ChatBubble";
import VoiceChat from "./VoiceChat";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Link } from "react-router-dom";

interface ChatWidgetProps {
  apiKey: string;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ apiKey }) => {
  const {
    isWidgetOpen,
    setIsWidgetOpen,
    isVoiceChatActive,
    setIsVoiceChatActive,
    widgetConfig,
    agentConfig,
    messages,
    addMessage,
    startNewConversation,
  } = useChat();
  
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<string>("");

  useEffect(() => {
    const posMap: Record<string, string> = {
      "top-right": "top-4 right-4",
      "top-left": "top-4 left-4",
      "bottom-right": "bottom-4 right-4",
      "bottom-left": "bottom-4 left-4",
      "center-right": "top-1/2 -translate-y-1/2 right-4",
      "center-left": "top-1/2 -translate-y-1/2 left-4",
    };
    setPosition(posMap[widgetConfig.position] || "bottom-right");
  }, [widgetConfig.position]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isWidgetOpen && !isVoiceChatActive) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isWidgetOpen, isVoiceChatActive]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;
    
    if (!apiKey) {
      toast.error("API Key não configurada", {
        description: "Por favor, configure sua chave de API OpenAI no painel de administração.",
        action: {
          label: "Configurar",
          onClick: () => window.location.href = "/admin",
        },
      });
      return;
    }
    
    const userMessage = inputValue.trim();
    setInputValue("");
    addMessage(userMessage, "user");
    setIsProcessing(true);
    setIsTyping(true);
    
    const conversationHistory: OpenAIMessage[] = [
      { role: "system", content: agentConfig.systemPrompt },
      ...messages.map(msg => ({ 
        role: msg.role as "user" | "assistant" | "system", 
        content: msg.content 
      })),
      { role: "user", content: userMessage },
    ];
    
    try {
      let assistantMessage = "";
      
      await streamOpenAI(
        {
          messages: conversationHistory,
          functions: agentConfig.functions.map(fn => ({
            name: fn.name,
            description: fn.description,
            parameters: fn.parameters,
          })),
          stream: true,
        },
        apiKey,
        {
          onMessage: (chunk) => {
            if (!assistantMessage) {
              addMessage("", "assistant");
            }
            assistantMessage += chunk;
            
            const updatedMessages = [...messages];
            if (updatedMessages.length > 0) {
              const lastMessage = updatedMessages[updatedMessages.length - 1];
              if (lastMessage.role === "assistant") {
                lastMessage.content = assistantMessage;
              }
            }
          },
          onComplete: async (fullMessage) => {
            setIsTyping(false);
            if (!assistantMessage) {
              addMessage(fullMessage, "assistant");
            }
            
            if (agentConfig.voice.enabled && isVoiceChatActive) {
              try {
                const audioBuffer = await generateSpeech(
                  fullMessage,
                  agentConfig.voice.voiceId,
                  apiKey
                );
                
                const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                
                audio.onended = () => {
                  URL.revokeObjectURL(audioUrl);
                };
                
                audio.play();
              } catch (error) {
                console.error("Error generating speech:", error);
                toast.error("Não foi possível gerar a fala. Por favor, verifique suas configurações.");
              }
            }
            
            setIsProcessing(false);
          },
          onError: (error) => {
            setIsTyping(false);
            console.error("Error in AI response:", error);
            
            let errorMessage = "Desculpe, encontrei um erro ao processar sua solicitação. Por favor, tente novamente.";
            let errorDescription = "";
            let errorAction = null;
            
            if (error.message === "API_KEY_MISSING") {
              errorMessage = "Chave da API OpenAI não configurada";
              errorDescription = "Por favor, configure sua chave de API OpenAI no painel de administração.";
              errorAction = {
                label: "Configurar",
                onClick: () => window.location.href = "/admin",
              };
            } else if (error.message === "API_KEY_INVALID") {
              errorMessage = "Chave da API OpenAI inválida";
              errorDescription = "A chave da API fornecida não é válida. Por favor, verifique e atualize sua chave.";
              errorAction = {
                label: "Atualizar Chave",
                onClick: () => window.location.href = "/admin",
              };
            } else if (error.message === "API_QUOTA_EXCEEDED") {
              errorMessage = "Cota da API OpenAI excedida";
              errorDescription = "Você excedeu sua cota atual da API OpenAI. Verifique seu plano e detalhes de faturamento.";
              errorAction = {
                label: "Saiba Mais",
                onClick: () => window.open("https://platform.openai.com/account/billing", "_blank"),
              };
            }
            
            addMessage(errorMessage, "assistant");
            
            toast.error(errorMessage, {
              description: errorDescription,
              action: errorAction,
              duration: 10000,
            });
            
            setIsProcessing(false);
          },
        }
      );
    } catch (error) {
      setIsTyping(false);
      console.error("Error sending message:", error);
      addMessage("Desculpe, encontrei um erro ao processar sua solicitação. Por favor, tente novamente.", "assistant");
      setIsProcessing(false);
      toast.error("Erro ao processar sua mensagem. Por favor, tente novamente.");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleWidget = () => {
    if (!isWidgetOpen) {
      startNewConversation();
    }
    setIsWidgetOpen(!isWidgetOpen);
  };

  const toggleVoiceMode = (value: string) => {
    setIsVoiceChatActive(value === "voice");
  };

  return (
    <>
      <Button
        variant="default"
        size="icon"
        className={`fixed z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-300 ${position} ${
          isWidgetOpen ? "scale-0 opacity-0" : "scale-100 opacity-100"
        }`}
        style={{ backgroundColor: widgetConfig.primaryColor }}
        onClick={toggleWidget}
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </Button>

      <div
        className={cn(
          "fixed z-50 flex flex-col glass rounded-xl shadow-xl transition-all duration-300 ease-in-out",
          isWidgetOpen 
            ? "opacity-100 scale-100" 
            : "opacity-0 scale-95 pointer-events-none",
          position.includes("right") ? "right-4" : "left-4",
          position.includes("top") ? "top-4" : "",
          position.includes("bottom") ? "bottom-4" : "",
          position.includes("center") ? "top-1/2 -translate-y-1/2" : ""
        )}
        style={{ width: "360px", height: "560px", maxWidth: "95vw", maxHeight: "90vh" }}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-medium">{widgetConfig.title}</h3>
            <p className="text-sm text-muted-foreground">{widgetConfig.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {!apiKey && (
              <Link to="/admin">
                <Button variant="outline" size="icon" className="h-8 w-8 p-0">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            )}
            {agentConfig.voice.enabled && (
              <ToggleGroup type="single" value={isVoiceChatActive ? "voice" : "text"} onValueChange={toggleVoiceMode}>
                <ToggleGroupItem value="text" aria-label="Texto" className="h-8 w-8 p-0">
                  <MessageCircle className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="voice" aria-label="Voz" className="h-8 w-8 p-0">
                  <Mic className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            )}
            <Button variant="ghost" size="icon" onClick={() => setIsWidgetOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!apiKey ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Settings className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-medium">API Key não configurada</h3>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                Configure sua chave de API OpenAI para começar a usar o chat.
              </p>
              <Link to="/admin">
                <Button>Configurar API Key</Button>
              </Link>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-medium">Como posso ajudar você hoje?</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {isVoiceChatActive 
                  ? "Clique no botão do microfone abaixo para começar a falar."
                  : "Envie uma mensagem para iniciar uma conversa."}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))
          )}
          {isTyping && (
            <ChatBubble 
              key="typing-indicator" 
              message={{
                id: "typing",
                role: "assistant",
                content: "",
                timestamp: new Date()
              }} 
              isTyping={true}
            />
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t">
          {isVoiceChatActive ? (
            <VoiceChat apiKey={apiKey} />
          ) : (
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder="Digite sua mensagem..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isProcessing || !apiKey}
                className="flex-1"
              />
              <Button 
                variant="default" 
                size="icon"
                disabled={!inputValue.trim() || isProcessing || !apiKey}
                onClick={handleSendMessage}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>

        {agentConfig.voice.enabled && !isVoiceChatActive && apiKey && (
          <div className="absolute bottom-20 right-4">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-10 w-10 border-dashed"
              onClick={() => setIsVoiceChatActive(true)}
            >
              <Mic className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

export default ChatWidget;

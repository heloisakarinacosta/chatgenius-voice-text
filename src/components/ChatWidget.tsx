
import React, { useState, useRef, useEffect } from "react";
import { Send, X, MessageCircle, Volume2, Mic, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChat } from "@/contexts/ChatContext";
import { cn } from "@/lib/utils";
import { callOpenAI, streamOpenAI, generateSpeech, OpenAIMessage } from "@/utils/openai";
import ChatBubble from "./ChatBubble";
import VoiceChatAgent from "./VoiceChatAgent";
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
    updateMessage,
  } = useChat();
  
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [position, setPosition] = useState<string>("");
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null);

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

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      
      audioRef.current.onplay = () => {
        setIsSpeaking(true);
      };
      
      audioRef.current.onended = () => {
        setIsSpeaking(false);
        if (audioRef.current && audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
          audioRef.current.src = "";
        }
      };
      
      audioRef.current.onerror = (e) => {
        console.error("Audio playback error:", e);
        setIsSpeaking(false);
        toast.error("Erro ao reproduzir áudio", {
          description: "Não foi possível reproduzir a resposta em áudio."
        });
      };
    }
    
    return () => {
      if (audioRef.current) {
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current = null;
      }
    };
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;
    
    if (!apiKey) {
      toast.error("API Key não configurada", {
        description: "Entre em contato com o administrador para configurar a API da OpenAI.",
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
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const conversationHistory: OpenAIMessage[] = [
      { role: "system", content: agentConfig.systemPrompt },
      ...messages.map(msg => ({ 
        role: msg.role as "user" | "assistant" | "system", 
        content: msg.content 
      })),
      { role: "user", content: userMessage },
    ];
    
    try {
      console.log("Enviando mensagem para OpenAI", conversationHistory);
      console.log("Arquivos de treinamento disponíveis:", agentConfig.trainingFiles.length);
      
      const assistantMessageId = addMessage("", "assistant");
      let assistantMessage = "";
      let responseTimeout: NodeJS.Timeout | null = null;
      
      responseTimeout = setTimeout(() => {
        if (assistantMessage.trim() === "") {
          console.warn("Nenhuma resposta recebida após 15 segundos");
          updateMessage(assistantMessageId, "Desculpe, estou demorando mais do que o esperado para responder. Por favor, aguarde...");
        }
      }, 15000);
      
      const failureTimeout = setTimeout(() => {
        if (assistantMessage.trim() === "" || assistantMessage.includes("Desculpe, estou demorando mais")) {
          console.error("Tempo limite excedido esperando resposta da OpenAI");
          updateMessage(
            assistantMessageId, 
            "Desculpe, não consegui obter uma resposta. Verifique sua conexão com a internet ou tente novamente mais tarde."
          );
          setIsTyping(false);
          setIsProcessing(false);
          toast.error("Tempo limite excedido", {
            description: "Não foi possível obter uma resposta no tempo esperado.",
          });
        }
      }, 60000);
      
      setStreamStartTime(Date.now());
      
      const streamOptions: any = {
        messages: conversationHistory,
        model: agentConfig.model || "gpt-4o-mini",
        temperature: agentConfig.temperature || 0.7,
        max_tokens: agentConfig.maxTokens || 1024,
        stream: true,
        trainingFiles: agentConfig.trainingFiles,
        detectEmotion: agentConfig.detectEmotion
      };
      
      if (agentConfig.functions && agentConfig.functions.length > 0) {
        streamOptions.functions = agentConfig.functions.map(fn => ({
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters,
        }));
      }
      
      await streamOpenAI(
        streamOptions,
        apiKey,
        {
          onMessage: (chunk) => {
            if (assistantMessage === "" && chunk.trim() !== "") {
              if (responseTimeout) {
                clearTimeout(responseTimeout);
                responseTimeout = null;
              }
            }
            
            assistantMessage += chunk;
            updateMessage(assistantMessageId, assistantMessage);
            
            if (typingTimeout) {
              clearTimeout(typingTimeout);
            }
            
            if (streamStartTime) {
              const timeElapsed = Date.now() - streamStartTime;
              console.log(`Chunk recebido após ${timeElapsed}ms:`, chunk);
            }
          },
          onComplete: async (fullMessage) => {
            if (responseTimeout) {
              clearTimeout(responseTimeout);
            }
            if (failureTimeout) {
              clearTimeout(failureTimeout);
            }
            
            setIsTyping(false);
            
            if (streamStartTime) {
              const totalTime = Date.now() - streamStartTime;
              console.log(`Stream completo em ${totalTime}ms`);
              setStreamStartTime(null);
            }
            
            if (!fullMessage || fullMessage.trim() === "") {
              console.warn("Mensagem completa recebida, mas está vazia");
              updateMessage(
                assistantMessageId, 
                "Desculpe, não consegui gerar uma resposta. Por favor, tente novamente."
              );
            } else {
              console.log("Mensagem completa recebida com sucesso");
            }
            
            if (agentConfig.voice.enabled && isVoiceChatActive) {
              try {
                console.log("Voz ativa, gerando áudio...");
                const audioBuffer = await generateSpeech(
                  fullMessage,
                  agentConfig.voice.voiceId,
                  apiKey
                );
                
                const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                if (audioRef.current) {
                  if (audioRef.current.src) {
                    URL.revokeObjectURL(audioRef.current.src);
                  }
                  
                  audioRef.current.src = audioUrl;
                  audioRef.current.play().catch(error => {
                    console.error("Erro ao reproduzir áudio:", error);
                    toast.error("Erro ao reproduzir áudio", {
                      description: "Seu navegador bloqueou a reprodução automática. Clique para ouvir a resposta.",
                      action: {
                        label: "Reproduzir",
                        onClick: () => audioRef.current?.play(),
                      }
                    });
                  });
                }
              } catch (error) {
                console.error("Erro ao gerar fala:", error);
                let errorMessage = "Não foi possível gerar a fala. Por favor, verifique suas configurações.";
                let errorDescription = "";
                
                if (error instanceof Error) {
                  if (error.message.includes("limit")) {
                    errorMessage = "Limite da API de voz excedido";
                    errorDescription = "Você excedeu seu limite de uso para a API de voz. Tente novamente mais tarde.";
                  } else if (error.message.includes("key")) {
                    errorMessage = "Problema com a chave da API";
                    errorDescription = "Sua chave da API não tem permissão para usar o serviço de voz.";
                  }
                }
                
                toast.error(errorMessage, {
                  description: errorDescription,
                });
              }
            }
            
            setIsProcessing(false);
          },
          onError: (error) => {
            if (responseTimeout) {
              clearTimeout(responseTimeout);
            }
            if (failureTimeout) {
              clearTimeout(failureTimeout);
            }
            
            setIsTyping(false);
            console.error("Erro na resposta da IA:", error);
            
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
            
            updateMessage(assistantMessageId, errorMessage);
            
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
      console.error("Erro ao enviar mensagem:", error);
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
    if (!isWidgetOpen && startNewConversation) {
      startNewConversation();
    }
    if (setIsWidgetOpen) {
      setIsWidgetOpen(!isWidgetOpen);
    }
  };

  const toggleVoiceMode = () => {
    if (setIsVoiceChatActive) {
      setIsVoiceChatActive(!isVoiceChatActive);
    }
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
              <Button 
                variant={isVoiceChatActive ? "default" : "outline"} 
                size="icon" 
                className="h-8 w-8 p-0"
                onClick={toggleVoiceMode}
              >
                <Mic className="h-4 w-4" />
              </Button>
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
                Entre em contato com o administrador para configurar a API da OpenAI.
              </p>
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
          {isSpeaking && (
            <div className="flex justify-center mt-2 mb-2">
              <div className="bg-primary/10 text-primary text-xs px-3 py-1 rounded-full flex items-center gap-1 animate-pulse">
                <Volume2 className="h-3 w-3" />
                <span>Falando...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t">
          {isVoiceChatActive ? (
            <VoiceChatAgent apiKey={apiKey} />
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

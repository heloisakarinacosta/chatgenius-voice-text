
import React, { useState, useRef, useEffect } from "react";
import { Send, X, MessageCircle, Volume2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChat } from "@/contexts/ChatContext";
import { cn } from "@/lib/utils";
import { callOpenAI, streamOpenAI, generateSpeech, OpenAIMessage } from "@/utils/openai";
import ChatBubble from "./ChatBubble";
import VoiceChat from "./VoiceChat";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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

  // Handle widget positioning
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when widget opens
  useEffect(() => {
    if (isWidgetOpen && !isVoiceChatActive) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isWidgetOpen, isVoiceChatActive]);

  // Handle sending message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;
    
    const userMessage = inputValue.trim();
    setInputValue("");
    addMessage(userMessage, "user");
    setIsProcessing(true);
    setIsTyping(true);
    
    // Prepare conversation history
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
      
      // Stream the response for a better UX
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
              // Add initial empty message that will be updated
              addMessage("", "assistant");
            }
            assistantMessage += chunk;
            
            // Update the last message with the accumulated text
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
            // If message wasn't initialized in onMessage
            if (!assistantMessage) {
              addMessage(fullMessage, "assistant");
            }
            
            // Generate speech if voice is enabled
            if (agentConfig.voice.enabled && isVoiceChatActive) {
              try {
                const audioBuffer = await generateSpeech(
                  fullMessage,
                  agentConfig.voice.voiceId,
                  apiKey
                );
                
                // Play the audio
                const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                
                audio.onended = () => {
                  URL.revokeObjectURL(audioUrl);
                };
                
                audio.play();
              } catch (error) {
                console.error("Error generating speech:", error);
                toast.error("Could not generate speech. Please check your settings.");
              }
            }
            
            setIsProcessing(false);
          },
          onError: (error) => {
            setIsTyping(false);
            console.error("Error in AI response:", error);
            addMessage("I'm sorry, I encountered an error processing your request. Please try again.", "assistant");
            setIsProcessing(false);
            toast.error("Error processing your message. Please try again.");
          },
        }
      );
    } catch (error) {
      setIsTyping(false);
      console.error("Error sending message:", error);
      addMessage("I'm sorry, I encountered an error processing your request. Please try again.", "assistant");
      setIsProcessing(false);
      toast.error("Error processing your message. Please try again.");
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleWidget = () => {
    if (!isWidgetOpen) {
      // Start a new conversation if widget is being opened
      startNewConversation();
    }
    setIsWidgetOpen(!isWidgetOpen);
  };

  const toggleVoiceMode = (value: string) => {
    setIsVoiceChatActive(value === "voice");
  };

  return (
    <>
      {/* Chat toggle button */}
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

      {/* Chat widget */}
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
        {/* Chat header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-medium">{widgetConfig.title}</h3>
            <p className="text-sm text-muted-foreground">{widgetConfig.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-medium">How can I help you today?</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {isVoiceChatActive 
                  ? "Click the microphone button below to start speaking."
                  : "Send a message to start a conversation."}
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

        {/* Input area */}
        <div className="p-4 border-t">
          {isVoiceChatActive ? (
            <VoiceChat apiKey={apiKey} />
          ) : (
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder="Type your message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isProcessing}
                className="flex-1"
              />
              <Button 
                variant="default" 
                size="icon"
                disabled={!inputValue.trim() || isProcessing}
                onClick={handleSendMessage}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>

        {/* Voice mode toggle */}
        {agentConfig.voice.enabled && !isVoiceChatActive && (
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


import React, { useEffect, useState } from "react";
import { Message } from "@/contexts/ChatContext";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { User, Bot, Loader2 } from "lucide-react";
import { ptBR } from "date-fns/locale";

interface ChatBubbleProps {
  message: Message;
  isTyping?: boolean;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isTyping = false }) => {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [displayContent, setDisplayContent] = useState<string>(message.content);

  useEffect(() => {
    // Atualiza o conteúdo quando a mensagem muda
    setDisplayContent(message.content);

    // Formata a hora usando date-fns
    try {
      const formattedTime = format(new Date(message.timestamp), "HH:mm", { 
        locale: ptBR 
      });
      setCurrentTime(formattedTime);
    } catch (e) {
      console.error("Erro ao formatar timestamp:", e);
      setCurrentTime("");
    }
  }, [message]);

  // Quando o conteúdo da mensagem é atualizado, atualiza o displayContent
  useEffect(() => {
    setDisplayContent(message.content);
  }, [message.content]);

  return (
    <div className={cn(
      "flex items-start gap-2.5 mb-4",
      message.role === "user" ? "justify-end" : "justify-start"
    )}>
      {message.role !== "user" && (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      
      <div className={cn(
        "max-w-[80%] px-4 py-2 rounded-lg",
        message.role === "user" 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted"
      )}>
        {isTyping ? (
          <div className="flex items-center gap-1.5">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Digitando</span>
          </div>
        ) : displayContent ? (
          <div className="text-sm whitespace-pre-wrap">
            {displayContent}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando resposta...</span>
          </div>
        )}
        
        {currentTime && (
          <div className="text-[10px] mt-1 opacity-60 text-right">
            {currentTime}
          </div>
        )}
      </div>
      
      {message.role === "user" && (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
          <User className="h-4 w-4 text-primary" />
        </div>
      )}
    </div>
  );
};

export default ChatBubble;

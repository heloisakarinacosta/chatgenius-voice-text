
import React from "react";
import { Message } from "../contexts/ChatContext";
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === "user";
  const time = message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={cn(
        "flex w-full mb-4 message-appear",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] px-4 py-2 rounded-xl",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-none"
            : "bg-muted text-muted-foreground rounded-tl-none"
        )}
      >
        <p className="text-sm md:text-base whitespace-pre-wrap break-words">{message.content}</p>
        <span className="text-xs opacity-70 block text-right mt-1">{time}</span>
      </div>
    </div>
  );
};

export default ChatBubble;

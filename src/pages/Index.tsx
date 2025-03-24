
import React from "react";
import { Link } from "react-router-dom";
import ChatWidget from "@/components/ChatWidget";
import { useChat } from "@/contexts/ChatContext";
import { Button } from "@/components/ui/button";
import { MessageCircle, Settings, Mic, Volume2 } from "lucide-react";

interface IndexProps {
  apiKey: string;
}

const Index: React.FC<IndexProps> = ({ apiKey }) => {
  const { setIsWidgetOpen, widgetConfig, agentConfig } = useChat();
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b sticky top-0 z-10 bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="font-bold text-xl flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />
            <span>AI Chat Widget</span>
          </Link>
          
          <Link to="/admin">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Admin Panel
            </Button>
          </Link>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 container py-8 md:py-16">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Multimodal Conversational AI Chat Widget
          </h1>
          
          <p className="text-xl text-muted-foreground">
            A powerful chat widget that combines text and voice capabilities for seamless customer interactions.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button 
              size="lg" 
              onClick={() => setIsWidgetOpen(true)}
              style={{ backgroundColor: widgetConfig.primaryColor }}
              className="rounded-full px-8"
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              Open Chat
            </Button>
            
            <Link to="/admin">
              <Button size="lg" variant="outline" className="rounded-full px-8">
                <Settings className="h-5 w-5 mr-2" />
                Configure
              </Button>
            </Link>
          </div>
          
          {agentConfig.voice.enabled && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span>Texto</span>
              </div>
              <span>&</span>
              <div className="flex items-center gap-1">
                <Mic className="h-4 w-4" />
                <span>Voz</span>
              </div>
              <span>disponíveis no chat!</span>
            </div>
          )}
        </div>
        
        <div className="mt-16 md:mt-24 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-secondary/50 rounded-lg text-center space-y-3">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-medium">Text Chat</h3>
              <p className="text-muted-foreground">
                Engage with users through a clean and intuitive text interface with real-time responses.
              </p>
            </div>
            
            <div className="p-6 bg-secondary/50 rounded-lg text-center space-y-3">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Mic className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-medium">Voice Interactions</h3>
              <p className="text-muted-foreground">
                Allow users to speak naturally with your AI assistant using high-quality voice streaming.
              </p>
            </div>
            
            <div className="p-6 bg-secondary/50 rounded-lg text-center space-y-3">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="h-6 w-6 text-primary"
                >
                  <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                  <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
                  <path d="M10 13l-1 2l1 2" />
                  <path d="M14 13l1 2l-1 2" />
                </svg>
              </div>
              <h3 className="text-xl font-medium">Custom Functions</h3>
              <p className="text-muted-foreground">
                Extend your chat with webhook functions for appointment booking, data retrieval, and more.
              </p>
            </div>
          </div>
          
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <h2 className="text-2xl font-bold">Easy to Integrate</h2>
            <p className="text-muted-foreground">
              Add the widget to your website with a simple code snippet. 
              Customize the appearance and behavior to match your brand.
            </p>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t py-6 bg-muted/40">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} AI Chat Widget. All rights reserved.
          </p>
          
          <nav className="flex items-center gap-4">
            <Link to="/" className="text-sm text-muted-foreground hover:underline">
              Home
            </Link>
            <Link to="/admin" className="text-sm text-muted-foreground hover:underline">
              Admin
            </Link>
          </nav>
        </div>
      </footer>
      
      {/* Chat Widget */}
      <ChatWidget apiKey={apiKey} />
    </div>
  );
};

export default Index;

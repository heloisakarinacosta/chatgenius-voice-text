
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
            <span>Chat AI</span>
          </Link>
          
          <Link to="/admin">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Painel Admin
            </Button>
          </Link>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 container py-8 md:py-16">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Widget de Chat AI Multimodal
          </h1>
          
          <p className="text-xl text-muted-foreground">
            Um poderoso widget de chat que combina recursos de texto e voz para interações perfeitas com os clientes.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button 
              size="lg" 
              onClick={() => setIsWidgetOpen(true)}
              style={{ backgroundColor: widgetConfig.primaryColor }}
              className="rounded-full px-8"
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              Abrir Chat
            </Button>
            
            <Link to="/admin">
              <Button size="lg" variant="outline" className="rounded-full px-8">
                <Settings className="h-5 w-5 mr-2" />
                Configurar
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
              <h3 className="text-xl font-medium">Chat por Texto</h3>
              <p className="text-muted-foreground">
                Interaja com os usuários através de uma interface de texto limpa e intuitiva com respostas em tempo real.
              </p>
            </div>
            
            <div className="p-6 bg-secondary/50 rounded-lg text-center space-y-3">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Mic className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-medium">Interações por Voz</h3>
              <p className="text-muted-foreground">
                Permita que os usuários conversem naturalmente com seu assistente AI usando streaming de voz de alta qualidade.
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
              <h3 className="text-xl font-medium">Funções Personalizadas</h3>
              <p className="text-muted-foreground">
                Estenda seu chat com funções de webhook para agendamento, recuperação de dados e muito mais.
              </p>
            </div>
          </div>
          
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <h2 className="text-2xl font-bold">Fácil de Integrar</h2>
            <p className="text-muted-foreground">
              Adicione o widget ao seu site com um simples trecho de código.
              Personalize a aparência e o comportamento para combinar com sua marca.
            </p>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t py-6 bg-muted/40">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Widget de Chat AI. Todos os direitos reservados.
          </p>
          
          <nav className="flex items-center gap-4">
            <Link to="/" className="text-sm text-muted-foreground hover:underline">
              Início
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

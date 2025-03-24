
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SHA256 } from "crypto-js";
import LoginForm from "@/components/LoginForm";
import AdminPanel from "@/components/AdminPanel";
import { useChat } from "@/contexts/ChatContext";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [loginAttempts, setLoginAttempts] = useState(0);
  const { adminConfig, loadData, isDbConnected } = useChat();
  const navigate = useNavigate();

  // Initialize and check for API key
  useEffect(() => {
    const initializeData = async () => {
      try {
        console.log('Initializing admin page...');
        
        // Load all data to ensure we have the latest
        if (loadData) {
          await loadData();
        }
        
        // Set API key from admin config
        if (adminConfig && adminConfig.apiKey) {
          console.log('Found API key in admin config');
          setApiKey(adminConfig.apiKey);
        } else {
          console.log('No API key found in admin config');
        }
        
      } catch (error) {
        console.error('Error initializing admin page:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeData();
  }, [loadData, adminConfig]);

  // Refresh page to check connection status
  const refreshPage = () => {
    window.location.reload();
  };

  const handleLogin = (username: string, password: string) => {
    if (!adminConfig) {
      toast.error("Erro ao carregar configurações de admin");
      return;
    }

    const passwordHash = SHA256(password).toString();
    
    if (username === adminConfig.username && passwordHash === adminConfig.passwordHash) {
      setIsAuthenticated(true);
      setLoginAttempts(0);
      toast.success("Login bem-sucedido!");
    } else {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      
      if (newAttempts >= 3) {
        toast.error("Muitas tentativas de login. Redirecionando para a página inicial...");
        setTimeout(() => navigate("/"), 2000);
      } else {
        toast.error("Nome de usuário ou senha incorretos");
      }
    }
  };

  const handleApiKeySave = (key: string) => {
    setApiKey(key);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-2">Carregando configurações...</p>
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {!isDbConnected && (
        <Alert variant="destructive" className="max-w-4xl mx-auto mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex flex-col gap-2">
              <p>
                Não foi possível conectar ao servidor de banco de dados. 
                O aplicativo está usando armazenamento local como fallback.
              </p>
              <div className="flex gap-2 mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.open('http://localhost:3001/api/health', '_blank')}
                >
                  Verificar API
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={refreshPage}
                >
                  Tentar novamente
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {!isAuthenticated ? (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <h1 className="text-2xl font-bold mb-6 text-center">Admin Login</h1>
            <LoginForm onLogin={handleLogin} />
            <div className="mt-4 text-center text-sm text-muted-foreground">
              <p>Login padrão: admin / admin</p>
              <p className="mt-1">
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-sm" 
                  onClick={() => navigate("/")}
                >
                  Voltar para o chat
                </Button>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <AdminPanel 
          apiKey={apiKey} 
          setApiKey={handleApiKeySave} 
          isAuthenticated={isAuthenticated} 
        />
      )}
    </div>
  );
};

export default Admin;


import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { SHA256 } from "crypto-js";
import LoginForm from "@/components/LoginForm";
import AdminPanel from "@/components/AdminPanel";
import { useChat } from "@/contexts/ChatContext";
import { AlertTriangle, Database, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as databaseService from "@/services/databaseService";

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>(null);
  const { adminConfig, loadData, isDbConnected } = useChat();
  const navigate = useNavigate();
  
  // Use refs to track initialization state
  const initializationDone = useRef(false);

  // Initialize and check for API key - with safeguards against re-runs
  useEffect(() => {
    // Prevent multiple initializations
    if (initializationDone.current) return;
    
    const initializeData = async () => {
      if (initializationDone.current) return;
      
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
        
        // Check database connection health
        await checkDatabaseHealth();
        
        initializationDone.current = true;
      } catch (error) {
        console.error('Error initializing admin page:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeData();
    
    // Cleanup function
    return () => {
      initializationDone.current = true;
    };
  }, []); // Empty dependency array to run only once
  
  // Update API key when adminConfig changes, but only after initial load
  useEffect(() => {
    if (!isLoading && adminConfig && adminConfig.apiKey) {
      setApiKey(adminConfig.apiKey);
    }
  }, [adminConfig, isLoading]);

  // Get API URL for health check based on environment
  const getApiHealthUrl = () => {
    // Use the proxy URL to ensure we're going through the same path as the app uses
    return '/api/health';
  };

  // Check database health and get diagnostic information
  const checkDatabaseHealth = async () => {
    try {
      const response = await fetch(`${getApiHealthUrl()}?_=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Health check response:', data);
        setDiagnosticInfo(data);
        return data;
      } else {
        console.error('Health check failed:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error checking database health:', error);
      return null;
    }
  };

  // Refresh page to check connection status
  const refreshPage = () => {
    window.location.reload();
  };
  
  // Force reconnect to database
  const forceReconnect = async () => {
    setIsConnecting(true);
    try {
      // First check the health of the API
      const healthData = await checkDatabaseHealth();
      
      if (healthData) {
        // API is responsive, now try to reconnect to database
        const dbStatus = await databaseService.getDbConnection();
        if (loadData) {
          await loadData();
          
          // Final check to see if we're connected
          const finalHealth = await checkDatabaseHealth();
          
          if (finalHealth && finalHealth.dbConnected) {
            toast.success("Conexão reestabelecida com sucesso!");
            setTimeout(() => window.location.reload(), 1000);
          } else {
            // Show diagnostic info
            toast.error("Erro ao reconectar ao banco de dados", {
              description: finalHealth?.dbError?.message || "Verifique a configuração do banco de dados"
            });
          }
        }
      } else {
        toast.error("API do servidor não está respondendo", {
          description: "Verifique se o servidor backend está em execução"
        });
      }
    } catch (error) {
      console.error("Erro ao reconectar:", error);
      toast.error("Erro ao reconectar", {
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
    } finally {
      setIsConnecting(false);
    }
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
          <AlertTitle>Problema de Conexão</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col gap-2">
              <p>
                Não foi possível conectar ao servidor de banco de dados. 
                O aplicativo está usando armazenamento local como fallback.
              </p>
              
              {diagnosticInfo && diagnosticInfo.dbError && (
                <div className="mt-2 p-3 bg-destructive/10 rounded text-sm">
                  <p className="font-semibold">Erro de conexão:</p>
                  <p>{diagnosticInfo.dbError.message}</p>
                  {diagnosticInfo.dbError.code && (
                    <p className="mt-1"><span className="font-semibold">Código:</span> {diagnosticInfo.dbError.code}</p>
                  )}
                  {diagnosticInfo.dbConfig && (
                    <div className="mt-2">
                      <p className="font-semibold">Configuração:</p>
                      <p>Host: {diagnosticInfo.dbConfig.host}</p>
                      <p>DB: {diagnosticInfo.dbConfig.database}</p>
                      <p>Usuário: {diagnosticInfo.dbConfig.user}</p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-2 mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.open(getApiHealthUrl(), '_blank')}
                >
                  Verificar API
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={refreshPage}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Atualizar página
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={forceReconnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Reconectando...
                    </span>
                  ) : (
                    <>
                      <Database className="h-3.5 w-3.5 mr-1.5" />
                      Forçar reconexão
                    </>
                  )}
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
          diagnosticInfo={diagnosticInfo}
        />
      )}
    </div>
  );
};

export default Admin;

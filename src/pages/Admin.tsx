
import React, { useState, useEffect } from "react";
import { useChat } from "@/contexts/ChatContext";
import AdminPanel from "@/components/AdminPanel";
import LoginForm from "@/components/LoginForm";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, BookOpen, Terminal, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initDatabase } from "@/services/databaseService";

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [backendError, setBackendError] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { adminConfig, updateAdminConfig, isDbConnected, setIsDbConnected } = useChat();

  // Inicializar conexão com o banco de dados
  useEffect(() => {
    const connectToDb = async () => {
      try {
        console.log("Attempting to initialize database connection...");
        setIsConnecting(true);
        const connected = await initDatabase();
        console.log("Database connection result:", connected);
        setIsDbConnected(connected);
      } catch (error) {
        console.error("Error initializing database:", error);
        setIsDbConnected(false);
      } finally {
        setIsConnecting(false);
      }
    };
    
    connectToDb();
  }, [setIsDbConnected]);

  // Get API key from backend/local storage
  const { data: adminData, isLoading, error } = useQuery({
    queryKey: ['adminConfig'],
    queryFn: async () => {
      try {
        console.log('Fetching admin config from backend...');
        const response = await fetch('http://localhost:3001/api/admin');
        
        if (!response.ok) {
          console.error('Failed to fetch admin data:', response.status, response.statusText);
          throw new Error(`Failed to fetch admin data: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Admin config fetched successfully:', data);
        return data;
      } catch (error) {
        console.error('Error fetching admin config:', error);
        
        // Check if error is due to backend server not running
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          setBackendError(true);
          toast.error("Backend server não está rodando", {
            description: "Configure a API Key diretamente no app",
            duration: 10000,
          });
        }
        
        console.log('Using cached admin config from context:', adminConfig);
        return adminConfig; // Use cached data from context if available
      }
    },
    retry: 1, // Only retry once
    enabled: true // Always run query
  });

  useEffect(() => {
    if (adminData && adminData.apiKey !== undefined) {
      console.log('Setting API key from adminData');
      setApiKey(adminData.apiKey);
    } else if (adminConfig && adminConfig.apiKey !== undefined) {
      console.log('Setting API key from adminConfig');
      setApiKey(adminConfig.apiKey);
    }
  }, [adminData, adminConfig]);

  const handleSetApiKey = async (key: string) => {
    try {
      console.log('Saving API key...');
      setApiKey(key);
      
      // Update admin config with new API key
      const updatedConfig = {
        ...adminConfig,
        apiKey: key
      };
      
      console.log('Updating admin config with new API key');
      const success = await updateAdminConfig(updatedConfig);
      
      if (!success) {
        throw new Error('Failed to update API key');
      }
      
      toast.success("API key configurada com sucesso");
    } catch (error) {
      console.error('Error updating API key:', error);
      toast.error("Falha ao salvar API key", {
        description: "Tente novamente ou verifique sua conexão."
      });
    }
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleRetryConnection = async () => {
    try {
      setIsConnecting(true);
      const connected = await initDatabase();
      setIsDbConnected(connected);
      
      if (connected) {
        toast.success("Conexão com o banco de dados estabelecida com sucesso!");
      } else {
        toast.error("Não foi possível conectar ao banco de dados");
      }
    } catch (error) {
      console.error("Error during connection retry:", error);
      toast.error("Erro ao tentar reconectar");
    } finally {
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {backendError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro de Conexão</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              O servidor backend não está rodando ou não está acessível na porta 3001. 
              Você pode continuar usando o aplicativo em modo offline, 
              mas os dados serão armazenados apenas localmente.
            </p>
            <div className="mt-2">
              <p className="font-semibold">Para iniciar o servidor backend:</p>
              <ol className="list-decimal pl-5 space-y-1 mt-1">
                <li>Abra um terminal na pasta do projeto</li>
                <li>Navegue até a pasta backend: <code className="bg-gray-100 px-1">cd backend</code></li>
                <li>Instale as dependências: <code className="bg-gray-100 px-1">npm install</code></li>
                <li>Inicie o servidor: <code className="bg-gray-100 px-1">node server.js</code></li>
              </ol>
            </div>
            <div className="flex gap-2 mt-2">
              <Button 
                variant="outline" 
                className="self-start" 
                onClick={() => window.open('/backend/README.md', '_blank')}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Ver Documentação do Backend
              </Button>
              <Button
                variant="default"
                className="self-start"
                onClick={handleRetryConnection}
                disabled={isConnecting}
              >
                <Terminal className="h-4 w-4 mr-2" />
                {isConnecting ? "Reconectando..." : "Tentar Reconectar"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {!backendError && !isDbConnected && (
        <Alert variant="warning" className="mb-6 bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
          <Database className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-700">Usando Armazenamento Local</AlertTitle>
          <AlertDescription className="text-yellow-600 flex flex-col gap-2">
            <p>
              O aplicativo está conectado ao backend, mas o banco de dados MariaDB não está configurado corretamente.
              Os dados estão sendo armazenados localmente.
            </p>
            <div className="mt-2">
              <p className="font-semibold">Verificações sugeridas:</p>
              <ol className="list-decimal pl-5 space-y-1 mt-1">
                <li>Verifique se o MySQL/MariaDB está instalado e rodando</li>
                <li>Verifique se as credenciais do banco no arquivo <code className="bg-gray-100 px-1">.env</code> estão corretas</li>
                <li>Verifique se o banco de dados <code className="bg-gray-100 px-1">chat_assistant</code> existe</li>
              </ol>
            </div>
            <Button
              variant="outline"
              className="self-start mt-2"
              onClick={handleRetryConnection}
              disabled={isConnecting}
            >
              <Database className="h-4 w-4 mr-2" />
              {isConnecting ? "Verificando conexão..." : "Verificar Conexão com o Banco"}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {isAuthenticated ? (
        <AdminPanel
          apiKey={apiKey}
          setApiKey={handleSetApiKey}
          isAuthenticated={isAuthenticated}
        />
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </div>
  );
};

export default Admin;

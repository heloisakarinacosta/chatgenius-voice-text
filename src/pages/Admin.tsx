
import React, { useState, useEffect } from "react";
import { useChat } from "@/contexts/ChatContext";
import AdminPanel from "@/components/AdminPanel";
import LoginForm from "@/components/LoginForm";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [backendError, setBackendError] = useState(false);
  const { adminConfig, updateAdminConfig, isDbConnected } = useChat();

  // Get API key from backend/local storage
  const { data: adminData, isLoading, error } = useQuery({
    queryKey: ['adminConfig'],
    queryFn: async () => {
      try {
        const response = await fetch('http://localhost:3001/api/admin');
        if (!response.ok) {
          throw new Error('Failed to fetch admin data');
        }
        return response.json();
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
        
        return adminConfig; // Use cached data from context if available
      }
    },
    retry: 1, // Only retry once
    enabled: true // Always run query
  });

  useEffect(() => {
    if (adminData && adminData.apiKey !== undefined) {
      setApiKey(adminData.apiKey);
    } else if (adminConfig && adminConfig.apiKey !== undefined) {
      setApiKey(adminConfig.apiKey);
    }
  }, [adminData, adminConfig]);

  const handleSetApiKey = async (key: string) => {
    try {
      setApiKey(key);
      
      // Update admin config with new API key
      const updatedConfig = {
        ...adminConfig,
        apiKey: key
      };
      
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
              O servidor backend não está rodando. Você pode continuar usando o aplicativo 
              em modo offline, mas os dados serão armazenados apenas localmente.
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
            <Button variant="outline" className="mt-2 self-start" onClick={() => window.open('/backend/README.md', '_blank')}>
              <BookOpen className="h-4 w-4 mr-2" />
              Ver Documentação do Backend
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

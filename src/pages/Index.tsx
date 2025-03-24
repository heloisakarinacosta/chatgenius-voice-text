
import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@/contexts/ChatContext";
import ChatWidget from "@/components/ChatWidget";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Index = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const { adminConfig } = useChat();
  const [backendError, setBackendError] = useState(false);

  // Fetch API key from backend
  const { data: apiKeyData, isLoading: isApiKeyLoading } = useQuery({
    queryKey: ['apiKey'],
    queryFn: async () => {
      try {
        // Primeiro tentamos buscar do backend
        console.log("Attempting to fetch API key from backend...");
        const response = await fetch('http://localhost:3001/api/admin/api-key');
        
        if (!response.ok) {
          if (response.status === 404) {
            console.log('API key not found on server, using from context');
            // Se não encontrar no backend, use o valor do contexto
            return { apiKey: adminConfig?.apiKey || null };
          }
          throw new Error(`Failed to fetch API key: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Successfully retrieved API key from backend");
        return data;
      } catch (error) {
        console.error('Error fetching API key:', error);
        console.log("Falling back to context API key:", adminConfig?.apiKey);
        
        // Check if error is due to backend server not running
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          setBackendError(true);
          toast.error("Backend server não está rodando", {
            description: "Verifique se o servidor backend está em execução em localhost:3001",
            duration: 10000,
          });
        }
        
        // Em caso de erro, use o valor do contexto
        return { apiKey: adminConfig?.apiKey || null };
      }
    },
    retry: 1, // Only retry once to avoid too many failed requests
  });

  useEffect(() => {
    if (apiKeyData) {
      console.log("Setting API key from data:", apiKeyData.apiKey ? "API key exists" : "API key is null");
      setApiKey(apiKeyData.apiKey);
    }
  }, [apiKeyData]);

  if (isApiKeyLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {backendError && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 fixed top-0 left-0 right-0 z-50">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Backend server não está rodando. Certifique-se de iniciar o servidor backend antes de usar o aplicativo.
              </p>
            </div>
            <div className="ml-auto pl-3">
              <Link to="/admin">
                <Button variant="outline" size="sm">
                  Configurar API Key
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
      <ChatWidget apiKey={apiKey} />
    </div>
  );
};

export default Index;

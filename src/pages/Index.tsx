
import React, { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@/contexts/ChatContext";
import ChatWidget from "@/components/ChatWidget";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";

const Index = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const { adminConfig, updateAdminConfig } = useChat();
  const [backendError, setBackendError] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");
  const [apiCheckInProgress, setApiCheckInProgress] = useState(false);

  // Determine the current API URL based on environment
  const devApiPort = process.env.DEV_API_PORT || 3030;
  const apiBaseUrl = process.env.NODE_ENV === 'production' 
    ? '' // Use relative URL in production 
    : `http://localhost:${devApiPort}`; 

  // Log the API base URL to help with debugging
  console.log(`Index component using API base URL: ${apiBaseUrl || '(relative)'} (${process.env.NODE_ENV} environment)`);

  // Function to fetch API key with retry limits and backoff
  const fetchApiKey = useCallback(async () => {
    if (apiCheckInProgress) return { apiKey: adminConfig?.apiKey || null };
    
    try {
      setApiCheckInProgress(true);
      console.log("Tentando buscar chave de API do backend...");
      console.log("Attempting to connect to backend API at:", apiBaseUrl);
      // Add cache busting to prevent browser caching
      const cacheBuster = new Date().getTime();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 3000)
      );
      
      // Use the dynamic API URL based on environment
      const fetchPromise = fetch(`${apiBaseUrl}/api/admin/api-key?_=${cacheBuster}`, {
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });
      
      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Chave de API não encontrada no servidor, usando do contexto');
          return { apiKey: adminConfig?.apiKey || null };
        }
        throw new Error(`Falha ao buscar chave de API: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Chave de API obtida com sucesso do backend");
      return data;
    } catch (error) {
      console.error('Erro ao buscar chave de API:', error);
      console.log("Usando chave de API do contexto:", adminConfig?.apiKey ? "existe" : "não definida");
      
      // Check if error is due to backend server not running
      if (error instanceof TypeError && error.message.includes('Failed to fetch') ||
          error.message === 'Request timeout') {
        setBackendError(true);
        
        // Only show toast once
        if (!backendError) {
          toast.error("Servidor backend não está em execução", {
            description: "Configure a chave de API diretamente no aplicativo",
            duration: 10000,
          });
          
          // If we don't have an API key and the backend isn't working, show dialog
          if (!adminConfig?.apiKey) {
            setShowSetupDialog(true);
          }
        }
      }
      
      // In case of error, use the value from context
      return { apiKey: adminConfig?.apiKey || null };
    } finally {
      setApiCheckInProgress(false);
    }
  }, [adminConfig, backendError, apiCheckInProgress, apiBaseUrl]);

  // Fetch API key from backend, with reduced stale time and cache time
  // Updated to use gcTime instead of cacheTime for React Query v5+
  const { data: apiKeyData, isLoading: isApiKeyLoading } = useQuery({
    queryKey: ['apiKey'],
    queryFn: fetchApiKey,
    retry: 1, // Only retry once to avoid too many failed requests
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 60000, // Cache for 1 minute only (previously cacheTime)
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch when component mounts
  });

  useEffect(() => {
    if (apiKeyData) {
      console.log("Definindo chave de API a partir dos dados:", apiKeyData.apiKey ? "Chave de API existe" : "Chave de API é nula");
      setApiKey(apiKeyData.apiKey);
    }
  }, [apiKeyData]);

  const handleSaveApiKey = async () => {
    if (!tempApiKey.trim()) {
      toast.error("Por favor, insira uma chave de API válida");
      return;
    }

    try {
      // Update API key in context
      const updatedConfig = {
        ...adminConfig,
        apiKey: tempApiKey.trim()
      };
      
      const success = await updateAdminConfig(updatedConfig);
      
      if (success) {
        setApiKey(tempApiKey.trim());
        setShowSetupDialog(false);
        toast.success("Chave de API configurada com sucesso");
      } else {
        throw new Error('Falha ao salvar chave de API');
      }
    } catch (error) {
      console.error('Erro ao salvar chave de API:', error);
      toast.error("Falha ao salvar chave de API", {
        description: "Tente novamente ou verifique sua conexão"
      });
    }
  };

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
                O servidor backend não está em execução. Você pode configurar a chave de API diretamente no aplicativo ou acessar a página de administração.
              </p>
            </div>
            <div className="ml-auto pl-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSetupDialog(true)}>
                Configurar Chave API
              </Button>
              <Link to="/admin">
                <Button variant="default" size="sm">
                  Ir para Admin
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Chave de API OpenAI</DialogTitle>
            <DialogDescription>
              Insira sua chave de API OpenAI para usar o assistente de chat.
              Esta chave será armazenada localmente no seu navegador.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4">
            <input
              type="password"
              className="w-full p-2 border rounded"
              placeholder="sk-..."
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
            />
            <p className="text-sm text-gray-500 mt-2">
              Você pode obter sua chave de API em
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-blue-500 ml-1">
                platform.openai.com/api-keys
              </a>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveApiKey}>Salvar Chave API</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChatWidget apiKey={apiKey} />
    </div>
  );
};

export default Index;


import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@/contexts/ChatContext";
import ChatWidget from "@/components/ChatWidget";

const Index = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const { adminConfig } = useChat();

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
        // Em caso de erro, use o valor do contexto
        return { apiKey: adminConfig?.apiKey || null };
      }
    }
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
      <ChatWidget apiKey={apiKey} />
    </div>
  );
};

export default Index;

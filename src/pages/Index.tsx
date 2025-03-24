
import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@/contexts/ChatContext";
import ChatWidget from "@/components/ChatWidget";

const Index = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Fetch API key from backend
  const { data: apiKeyData, isLoading: isApiKeyLoading } = useQuery({
    queryKey: ['apiKey'],
    queryFn: async () => {
      try {
        const response = await fetch('http://localhost:3001/api/admin/api-key');
        if (!response.ok) {
          if (response.status === 404) {
            return { apiKey: null };
          }
          throw new Error('Failed to fetch API key');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching API key:', error);
        return { apiKey: null };
      }
    }
  });

  useEffect(() => {
    if (apiKeyData) {
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

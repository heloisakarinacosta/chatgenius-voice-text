
import React, { useState, useEffect } from "react";
import { useChat } from "@/contexts/ChatContext";
import AdminPanel from "@/components/AdminPanel";
import LoginForm from "@/components/LoginForm";
import { useQuery } from "@tanstack/react-query";

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const { isDbConnected } = useChat();

  // Get API key from backend/local storage
  const { data: adminData, isLoading } = useQuery({
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
        return null;
      }
    }
  });

  useEffect(() => {
    if (adminData && adminData.apiKey) {
      setApiKey(adminData.apiKey);
    }
  }, [adminData]);

  const handleSetApiKey = async (key: string) => {
    try {
      if (isDbConnected) {
        const response = await fetch('http://localhost:3001/api/admin', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...adminData,
            apiKey: key,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update API key');
        }
      }
      setApiKey(key);
    } catch (error) {
      console.error('Error updating API key:', error);
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

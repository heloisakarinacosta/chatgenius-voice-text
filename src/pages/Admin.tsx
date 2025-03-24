
import React, { useState, useEffect } from "react";
import { useChat } from "@/contexts/ChatContext";
import AdminPanel from "@/components/AdminPanel";
import LoginForm from "@/components/LoginForm";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState("");
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
        return adminConfig; // Use cached data from context if available
      }
    },
    enabled: isDbConnected // Only run query if DB is connected
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
      
      toast.success("API key saved successfully");
    } catch (error) {
      console.error('Error updating API key:', error);
      toast.error("Failed to save API key", {
        description: "Please try again or check your connection."
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

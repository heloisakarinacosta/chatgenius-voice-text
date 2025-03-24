
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import LoginForm from "@/components/LoginForm";
import AdminPanel from "@/components/AdminPanel";
import { Button } from "@/components/ui/button";
import { MessageCircle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";

const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState("");
  
  // Check if user was previously authenticated 
  useEffect(() => {
    const authStatus = localStorage.getItem("admin_auth");
    if (authStatus === "true") {
      setIsAuthenticated(true);
    }
  }, []);
  
  // Update localStorage when authentication status changes
  useEffect(() => {
    localStorage.setItem("admin_auth", isAuthenticated ? "true" : "false");
  }, [isAuthenticated]);
  
  // Fetch admin config (including API key)
  const { data: adminConfig, isLoading, error } = useQuery({
    queryKey: ['adminConfig'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3001/api/admin');
      if (!response.ok) {
        throw new Error('Failed to fetch admin configuration');
      }
      return response.json();
    },
    enabled: isAuthenticated,
    onSuccess: (data) => {
      if (data && data.apiKey) {
        setApiKey(data.apiKey);
      }
    }
  });
  
  // Update API key mutation
  const updateApiKeyMutation = useMutation({
    mutationFn: async (newApiKey: string) => {
      const response = await fetch('http://localhost:3001/api/admin', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: adminConfig?.username || "admin",
          passwordHash: adminConfig?.passwordHash || "",
          apiKey: newApiKey
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update API key');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast.success("API key updated successfully");
      setApiKey(apiKey);
    },
    onError: (error) => {
      toast.error("Failed to update API key", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  const handleUpdateApiKey = (newApiKey: string) => {
    updateApiKeyMutation.mutate(newApiKey);
  };
  
  const handleLogin = () => {
    setIsAuthenticated(true);
  };
  
  const handleLogout = () => {
    setIsAuthenticated(false);
    toast.success("Logged out successfully");
  };
  
  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h2 className="text-xl font-bold text-red-500 mb-4">Error loading admin settings</h2>
        <p className="text-gray-500 mb-4">{error instanceof Error ? error.message : "Unknown error"}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b sticky top-0 z-10 bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="font-bold text-xl flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />
            <span>AI Chat Widget</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                View Website
              </Button>
            </Link>
            
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      
      {/* Admin Panel */}
      <AdminPanel 
        apiKey={apiKey} 
        setApiKey={handleUpdateApiKey} 
        isAuthenticated={isAuthenticated} 
      />
      
      {/* Footer */}
      <footer className="border-t py-6 bg-muted/40 mt-auto">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} AI Chat Widget. All rights reserved.
          </p>
          
          <nav className="flex items-center gap-4">
            <Link to="/" className="text-sm text-muted-foreground hover:underline">
              Home
            </Link>
            <Link to="/admin" className="text-sm text-muted-foreground hover:underline">
              Admin
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Admin;

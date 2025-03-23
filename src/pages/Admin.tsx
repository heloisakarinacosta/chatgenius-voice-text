
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import LoginForm from "@/components/LoginForm";
import AdminPanel from "@/components/AdminPanel";
import { Button } from "@/components/ui/button";
import { MessageCircle, LogOut } from "lucide-react";
import { toast } from "sonner";

interface AdminProps {
  apiKey: string;
  setApiKey: (key: string) => void;
}

const Admin: React.FC<AdminProps> = ({ apiKey, setApiKey }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
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
        setApiKey={setApiKey} 
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

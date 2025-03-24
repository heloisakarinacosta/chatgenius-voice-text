
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ChatWidget from "@/components/ChatWidget";
import { Button } from "@/components/ui/button";
import { MessageCircle, Settings } from "lucide-react";

const Index: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>("");
  
  // Fetch API key from the server
  const { data, isLoading, error } = useQuery({
    queryKey: ['apiKey'],
    queryFn: async () => {
      try {
        const response = await fetch('http://localhost:3001/api/admin/api-key');
        if (!response.ok) {
          if (response.status === 404) {
            return { apiKey: "" };
          }
          throw new Error('Failed to fetch API key');
        }
        return response.json();
      } catch (error) {
        console.error('Error fetching API key:', error);
        return { apiKey: "" };
      }
    },
    onSuccess: (data) => {
      if (data && data.apiKey) {
        setApiKey(data.apiKey);
      }
    }
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="font-bold text-xl flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />
            <span>AI Chat Widget</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link to="/admin">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Admin Panel
              </Button>
            </Link>
          </div>
        </div>
      </header>
      
      <main className="flex-1 container py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">AI Chat Widget Demo</h1>
          <p className="text-muted-foreground mb-8">
            This demonstrates how the chat widget would appear on your website. 
            Use the button in the bottom right to start a conversation.
          </p>
          
          {error && (
            <div className="rounded-lg border bg-yellow-50 p-4 mb-8">
              <h3 className="text-lg font-medium">API Connection Error</h3>
              <p className="text-sm text-muted-foreground mt-1">
                There was an error connecting to the backend API. The widget will use local storage as a fallback.
              </p>
            </div>
          )}
          
          {isLoading ? (
            <div className="text-center py-4">Loading configuration...</div>
          ) : !apiKey ? (
            <div className="rounded-lg border bg-red-50 p-4 mb-8">
              <h3 className="text-lg font-medium">OpenAI API Key Not Configured</h3>
              <p className="text-sm text-muted-foreground mt-1">
                The admin needs to configure an OpenAI API key from the admin panel for the chat widget to function.
              </p>
              <Link to="/admin" className="mt-2 inline-block">
                <Button variant="default" size="sm">
                  Go to Admin Panel
                </Button>
              </Link>
            </div>
          ) : null}
          
          <div className="rounded-lg border p-6 bg-muted/40">
            <h2 className="text-xl font-medium mb-4">Integration Instructions</h2>
            <p className="mb-4">
              To add this chat widget to your website, add the following script to your HTML:
            </p>
            <div className="bg-muted rounded-md p-4 mb-4 overflow-x-auto">
              <code className="text-sm">
                {`<script src="https://your-widget-url.com/widget.js"></script>
<script>
  initChatWidget();
</script>`}
              </code>
            </div>
            <p className="text-sm text-muted-foreground">
              The widget will automatically load and display in the position set in the admin panel.
            </p>
          </div>
        </div>
      </main>
      
      <footer className="border-t py-6 bg-muted/40">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} AI Chat Widget. All rights reserved.
          </p>
          
          <nav className="flex items-center gap-4">
            <a href="#features" className="text-sm text-muted-foreground hover:underline">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:underline">
              Pricing
            </a>
            <Link to="/admin" className="text-sm text-muted-foreground hover:underline">
              Admin
            </Link>
          </nav>
        </div>
      </footer>
      
      {/* The Chat Widget */}
      <ChatWidget apiKey={apiKey} />
    </div>
  );
};

export default Index;


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

  // Function to fetch API key with retry limits and backoff
  const fetchApiKey = useCallback(async () => {
    if (apiCheckInProgress) return { apiKey: adminConfig?.apiKey || null };
    
    try {
      setApiCheckInProgress(true);
      console.log("Attempting to fetch API key from backend...");
      // Add cache busting to prevent browser caching
      const cacheBuster = new Date().getTime();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 3000)
      );
      
      const fetchPromise = fetch(`http://localhost:3001/api/admin/api-key?_=${cacheBuster}`, {
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
          console.log('API key not found on server, using from context');
          return { apiKey: adminConfig?.apiKey || null };
        }
        throw new Error(`Failed to fetch API key: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Successfully retrieved API key from backend");
      return data;
    } catch (error) {
      console.error('Error fetching API key:', error);
      console.log("Falling back to context API key:", adminConfig?.apiKey ? "exists" : "not set");
      
      // Check if error is due to backend server not running
      if (error instanceof TypeError && error.message.includes('Failed to fetch') ||
          error.message === 'Request timeout') {
        setBackendError(true);
        
        // Only show toast once
        if (!backendError) {
          toast.error("Backend server is not running", {
            description: "Configure the API Key directly in the app",
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
  }, [adminConfig, backendError, apiCheckInProgress]);

  // Fetch API key from backend, with reduced stale time and cache time
  // Updated to use gcTime instead of cacheTime for React Query v5+
  const { data: apiKeyData, isLoading: isApiKeyLoading, error: apiKeyError } = useQuery({
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
      console.log("Setting API key from data:", apiKeyData.apiKey ? "API key exists" : "API key is null");
      setApiKey(apiKeyData.apiKey);
    }
  }, [apiKeyData]);

  const handleSaveApiKey = async () => {
    if (!tempApiKey.trim()) {
      toast.error("Please enter a valid API key");
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
        toast.success("API key configured successfully");
      } else {
        throw new Error('Failed to save API key');
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      toast.error("Failed to save API key", {
        description: "Try again or check your connection"
      });
    }
  };

  if (isApiKeyLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
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
                Backend server is not running. You can configure the API key directly in the application or access the admin page.
              </p>
            </div>
            <div className="ml-auto pl-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSetupDialog(true)}>
                Configure API Key
              </Button>
              <Link to="/admin">
                <Button variant="default" size="sm">
                  Go to Admin
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure OpenAI API Key</DialogTitle>
            <DialogDescription>
              Enter your OpenAI API key to use the chat assistant.
              This key will be stored locally in your browser.
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
              You can get your API key at
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-blue-500 ml-1">
                platform.openai.com/api-keys
              </a>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveApiKey}>Save API Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {apiKeyError && (
        <div className="p-4 text-sm text-red-500 bg-red-50 rounded m-4">
          Error loading API key: {apiKeyError.toString()}
        </div>
      )}

      <ChatWidget apiKey={apiKey} />
    </div>
  );
};

export default Index;

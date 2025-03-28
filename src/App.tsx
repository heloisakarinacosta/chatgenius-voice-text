
import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChatProvider } from "./contexts/ChatContext";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { toast } from "sonner";

// Create a custom error handler for unhandled promise rejections
const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  console.error("Unhandled promise rejection:", event.reason);
  
  // Show a user-friendly toast notification without revealing internal details
  toast.error("Ocorreu um erro na aplicação", {
    description: "Algumas funcionalidades podem não funcionar corretamente. Por favor, tente novamente."
  });
  
  // Prevent the default browser error handling
  event.preventDefault();
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 1000,
      staleTime: 30000,
      gcTime: 60000,
      refetchOnWindowFocus: false
    }
  }
});

const App = () => {
  useEffect(() => {
    // Add unhandled rejection listener
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    // Clean up the listener when the component is unmounted
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ChatProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ChatProvider>
    </QueryClientProvider>
  );
};

export default App;

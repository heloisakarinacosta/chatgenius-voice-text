
import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useChat } from "@/contexts/ChatContext";

interface ApiKeySectionProps {
  apiKey: string;
  setApiKey: (key: string) => void;
}

const ApiKeySection: React.FC<ApiKeySectionProps> = ({ apiKey, setApiKey }) => {
  const [keyInput, setKeyInput] = useState(apiKey);
  const [isSaved, setIsSaved] = useState(Boolean(apiKey));
  const [isSaving, setIsSaving] = useState(false);
  const { updateAdminConfig, adminConfig, isDbConnected } = useChat();

  // Synchronize local state when the apiKey prop changes
  useEffect(() => {
    setKeyInput(apiKey);
    setIsSaved(Boolean(apiKey));
  }, [apiKey]);

  const handleSaveKey = async () => {
    if (!keyInput.trim()) {
      toast.error("Por favor, insira uma chave API válida");
      return;
    }

    try {
      setIsSaving(true);
      console.log('Attempting to save API key...');
      
      // Update in context and database/localStorage
      if (!adminConfig) {
        throw new Error('Admin configuration not loaded');
      }
      
      const updatedConfig = {
        ...adminConfig,
        apiKey: keyInput.trim()
      };
      
      const success = await updateAdminConfig(updatedConfig);
      
      if (success) {
        // Update the key through the function provided by the parent component
        setApiKey(keyInput.trim());
        toast.success("Chave API salva com sucesso");
        setIsSaved(true);
        console.log('API key saved successfully');
      } else {
        throw new Error('Falha ao salvar a chave API');
      }
    } catch (error) {
      console.error("Erro ao salvar a chave API:", error);
      toast.error("Erro ao salvar a chave API", {
        description: "Houve um problema ao atualizar a chave API. Por favor, tente novamente."
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mb-6">
      <Label htmlFor="apiKey" className="text-base font-medium">OpenAI API Key</Label>
      <div className="flex items-center gap-2 mt-2">
        <Input
          id="apiKey"
          type="password"
          value={keyInput}
          onChange={(e) => {
            setKeyInput(e.target.value);
            if (isSaved) setIsSaved(false);
          }}
          placeholder="sk-..."
          className="flex-1"
          disabled={isSaving}
        />
        <Button 
          variant={keyInput ? "default" : "destructive"}
          disabled={!keyInput || (keyInput === apiKey && isSaved) || isSaving}
          onClick={handleSaveKey}
          type="button"
        >
          {isSaving ? (
            <span className="animate-pulse">Salvando...</span>
          ) : isSaved ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Chave Salva
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Chave
            </>
          )}
        </Button>
      </div>
      <div className="flex items-center mt-1">
        <p className="text-sm text-muted-foreground">
          {isDbConnected 
            ? "A chave API é armazenada no servidor e usada apenas para comunicações com a OpenAI."
            : "A chave API é armazenada localmente no seu navegador."}
        </p>
        {!isDbConnected && (
          <AlertCircle size={14} className="text-yellow-500 ml-1" />
        )}
      </div>
    </div>
  );
};

export default ApiKeySection;

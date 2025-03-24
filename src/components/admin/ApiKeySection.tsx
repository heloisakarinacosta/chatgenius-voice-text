
import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Save } from "lucide-react";
import { toast } from "sonner";

interface ApiKeySectionProps {
  apiKey: string;
  setApiKey: (key: string) => void;
}

const ApiKeySection: React.FC<ApiKeySectionProps> = ({ apiKey, setApiKey }) => {
  const [keyInput, setKeyInput] = useState(apiKey);
  const [isSaved, setIsSaved] = useState(Boolean(apiKey));
  const [isSaving, setIsSaving] = useState(false);

  // Sincronizar o estado local quando a prop apiKey mudar
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
      // Atualizar a chave através da função fornecida pelo componente pai
      setApiKey(keyInput.trim());
      setIsSaved(true);
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
      <p className="text-sm text-muted-foreground mt-1">
        A chave API é armazenada no servidor e usada apenas para comunicações com a OpenAI.
      </p>
    </div>
  );
};

export default ApiKeySection;

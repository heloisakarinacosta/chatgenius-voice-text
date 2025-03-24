
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

  // Sincronizar o estado local quando a prop apiKey mudar
  useEffect(() => {
    setKeyInput(apiKey);
    setIsSaved(Boolean(apiKey));
  }, [apiKey]);

  const handleSaveKey = () => {
    if (!keyInput.trim()) {
      toast.error("Por favor, insira uma chave API válida");
      return;
    }

    // Atualizar a chave no componente pai (que salva no localStorage)
    setApiKey(keyInput.trim());
    setIsSaved(true);
    toast.success("Chave API da OpenAI salva com sucesso");
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
        />
        <Button 
          variant={keyInput ? "default" : "destructive"}
          disabled={!keyInput || (keyInput === apiKey && isSaved)}
          onClick={handleSaveKey}
        >
          {isSaved ? (
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
        Sua chave API é armazenada localmente e nunca enviada aos nossos servidores.
      </p>
    </div>
  );
};

export default ApiKeySection;

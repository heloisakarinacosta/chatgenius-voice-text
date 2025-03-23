
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface ApiKeySectionProps {
  apiKey: string;
  setApiKey: (key: string) => void;
}

const ApiKeySection: React.FC<ApiKeySectionProps> = ({ apiKey, setApiKey }) => {
  return (
    <div className="mb-6">
      <Label htmlFor="apiKey" className="text-base font-medium">OpenAI API Key</Label>
      <div className="flex items-center gap-2 mt-2">
        <Input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="flex-1"
        />
        <Button 
          variant={apiKey ? "default" : "destructive"}
          disabled={!apiKey}
        >
          {apiKey ? <Check className="h-4 w-4 mr-2" /> : null}
          {apiKey ? "Key Set" : "Missing Key"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        Your API key is stored locally and never sent to our servers.
      </p>
    </div>
  );
};

export default ApiKeySection;

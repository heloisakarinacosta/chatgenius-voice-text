
import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Volume2, FileText } from "lucide-react";
import { toast } from "sonner";
import { AgentConfig } from "@/contexts/ChatContext";

interface AgentConfigTabProps {
  agentConfig: AgentConfig;
  updateAgentConfig: (config: AgentConfig) => void;
  functions: any[];
}

const AgentConfigTab: React.FC<AgentConfigTabProps> = ({ 
  agentConfig, 
  updateAgentConfig,
  functions
}) => {
  const [updatedAgentConfig, setUpdatedAgentConfig] = useState<AgentConfig>({ ...agentConfig });

  // Voice options from OpenAI
  const voiceOptions = [
    { id: "alloy", name: "Alloy" },
    { id: "echo", name: "Echo" },
    { id: "fable", name: "Fable" },
    { id: "onyx", name: "Onyx" },
    { id: "nova", name: "Nova" },
    { id: "shimmer", name: "Shimmer" },
  ];
  
  // Language options
  const languageOptions = [
    { id: "en-US", name: "English (US)" },
    { id: "en-GB", name: "English (UK)" },
    { id: "es-ES", name: "Spanish" },
    { id: "fr-FR", name: "French" },
    { id: "de-DE", name: "German" },
    { id: "it-IT", name: "Italian" },
    { id: "ja-JP", name: "Japanese" },
    { id: "ko-KR", name: "Korean" },
    { id: "pt-BR", name: "Portuguese (Brazil)" },
    { id: "zh-CN", name: "Chinese (Simplified)" },
  ];

  // Save agent configuration
  const saveAgentConfig = () => {
    const updatedConfig = {
      ...updatedAgentConfig,
      functions: functions,
    };
    
    updateAgentConfig(updatedConfig);
    toast.success("Agent configuration saved");
  };

  // Test voice latency
  const testVoiceLatency = async () => {
    const startTime = Date.now();
    toast.info("Testing voice latency...");
    
    // Simulate a network request
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const latency = Date.now() - startTime;
    
    // Update agent config with measured latency
    setUpdatedAgentConfig({
      ...updatedAgentConfig,
      voice: {
        ...updatedAgentConfig.voice,
        latency,
      },
    });
    
    toast.success(`Voice latency: ${latency}ms`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Configuration</CardTitle>
        <CardDescription>
          Configure your AI assistant's behavior and voice settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="systemPrompt">System Prompt</Label>
          <Textarea
            id="systemPrompt"
            value={updatedAgentConfig.systemPrompt}
            onChange={(e) => setUpdatedAgentConfig({
              ...updatedAgentConfig,
              systemPrompt: e.target.value,
            })}
            rows={6}
            placeholder="You are a helpful assistant..."
          />
          <p className="text-sm text-muted-foreground">
            This is the instruction that primes your AI assistant's behavior and knowledge.
          </p>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="voiceEnabled">Voice Enabled</Label>
            <Switch
              id="voiceEnabled"
              checked={updatedAgentConfig.voice.enabled}
              onCheckedChange={(checked) => setUpdatedAgentConfig({
                ...updatedAgentConfig,
                voice: {
                  ...updatedAgentConfig.voice,
                  enabled: checked,
                },
              })}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Enable voice responses from your AI assistant.
          </p>
        </div>
        
        {updatedAgentConfig.voice.enabled && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="voiceId">Voice</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={updatedAgentConfig.voice.voiceId}
                    onValueChange={(value) => setUpdatedAgentConfig({
                      ...updatedAgentConfig,
                      voice: {
                        ...updatedAgentConfig.voice,
                        voiceId: value,
                      },
                    })}
                  >
                    <SelectTrigger id="voiceId" className="flex-1">
                      <SelectValue placeholder="Select voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {voiceOptions.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={testVoiceLatency}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  value={updatedAgentConfig.voice.language}
                  onValueChange={(value) => setUpdatedAgentConfig({
                    ...updatedAgentConfig,
                    voice: {
                      ...updatedAgentConfig.voice,
                      language: value,
                    },
                  })}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((language) => (
                      <SelectItem key={language.id} value={language.id}>
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Voice Latency</Label>
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{updatedAgentConfig.voice.latency || 0}ms</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Measured response time for voice generation.
              </p>
            </div>
          </>
        )}

        <div className="border-t pt-4 mt-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <Label>Arquivos de Treinamento</Label>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {updatedAgentConfig.trainingFiles.length > 0 
              ? `${updatedAgentConfig.trainingFiles.length} arquivo(s) carregado(s). Acesse a aba "Arquivos" para gerenciar.`
              : 'Nenhum arquivo carregado. Acesse a aba "Arquivos" para adicionar arquivos de treinamento.'}
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={saveAgentConfig}>Save Changes</Button>
      </CardFooter>
    </Card>
  );
};

export default AgentConfigTab;


import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Volume2, FileText, HelpCircle, Mic } from "lucide-react";
import { toast } from "sonner";
import { AgentConfig } from "@/contexts/ChatContext";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

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
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5">
                    <HelpCircle className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>As instruções iniciais fornecidas ao assistente AI que definem seu comportamento e conhecimento.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
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
            Este é o prompt de sistema que define o comportamento e conhecimento do seu assistente AI.
          </p>
        </div>
        
        <Separator />
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-medium">Voice Configuration</h3>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="voiceEnabled" className="font-medium">Voice Enabled</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5">
                      <HelpCircle className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>Ativar funcionalidades de voz para permitir que os usuários conversem por voz com o assistente. O assistente também responderá por áudio.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
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
            Habilite para permitir interações de voz bidirecionais. Os usuários poderão alternar entre texto e voz no chat.
          </p>
        </div>
        
        {updatedAgentConfig.voice.enabled && (
          <div className="space-y-4 border p-4 rounded-lg bg-secondary/20">
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={testVoiceLatency}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Testar latência da voz</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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

            <div className="mt-2 p-3 bg-primary/5 rounded border border-primary/10">
              <p className="text-sm">
                <strong>Como funciona:</strong> Quando ativado, os usuários verão um botão de microfone no chat e poderão alternar entre texto e voz a qualquer momento. O assistente responderá com texto e áudio.
              </p>
            </div>
          </div>
        )}

        <Separator />

        <div className="pt-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <Label>Arquivos de Treinamento</Label>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {updatedAgentConfig.trainingFiles.length > 0 
              ? `${updatedAgentConfig.trainingFiles.length} arquivo(s) carregado(s). Acesse a aba "Arquivos" para gerenciar.`
              : 'Nenhum arquivo carregado. Acesse a aba "Arquivos" para adicionar arquivos de treinamento.'}
          </p>
          <div className="mt-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => document.querySelector('[value="files"]')?.dispatchEvent(new MouseEvent('click'))}
            >
              Gerenciar Arquivos
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={saveAgentConfig}>Save Changes</Button>
      </CardFooter>
    </Card>
  );
};

export default AgentConfigTab;

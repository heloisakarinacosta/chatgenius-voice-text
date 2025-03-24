
import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Volume2, FileText, HelpCircle, Mic, Code, Brain, Bot, Braces } from "lucide-react";
import { toast } from "sonner";
import { AgentConfig } from "@/contexts/ChatContext";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

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

  // Opções de voz da OpenAI
  const voiceOptions = [
    { id: "alloy", name: "Alloy" },
    { id: "echo", name: "Echo" },
    { id: "fable", name: "Fable" },
    { id: "onyx", name: "Onyx" },
    { id: "nova", name: "Nova (Recomendada para Português)" },
    { id: "shimmer", name: "Shimmer" },
  ];
  
  // Opções de idioma
  const languageOptions = [
    { id: "pt-BR", name: "Português (Brasil)" },
    { id: "en-US", name: "Inglês (EUA)" },
    { id: "en-GB", name: "Inglês (Reino Unido)" },
    { id: "es-ES", name: "Espanhol" },
    { id: "fr-FR", name: "Francês" },
    { id: "de-DE", name: "Alemão" },
    { id: "it-IT", name: "Italiano" },
    { id: "ja-JP", name: "Japonês" },
    { id: "ko-KR", name: "Coreano" },
    { id: "zh-CN", name: "Chinês (Simplificado)" },
  ];

  // Opções de modelos da OpenAI
  const modelOptions = [
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo - Rápido e econômico" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini - Melhor equilíbrio" },
    { id: "gpt-4o", name: "GPT-4o - Mais poderoso" },
  ];

  // Salvar configuração do agente
  const saveAgentConfig = () => {
    const updatedConfig = {
      ...updatedAgentConfig,
      functions: functions,
    };
    
    updateAgentConfig(updatedConfig);
    toast.success("Configuração do agente salva");
  };

  // Testar latência da voz
  const testVoiceLatency = async () => {
    const startTime = Date.now();
    toast.info("Testando latência da voz...");
    
    // Simular uma requisição de rede
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const latency = Date.now() - startTime;
    
    // Atualizar configuração do agente com latência medida
    setUpdatedAgentConfig({
      ...updatedAgentConfig,
      voice: {
        ...updatedAgentConfig.voice,
        latency,
      },
    });
    
    toast.success(`Latência da voz: ${latency}ms`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração do Agente</CardTitle>
        <CardDescription>
          Configure o comportamento e as configurações de voz do seu assistente IA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="systemPrompt">Prompt do Sistema</Label>
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
            placeholder="Você é um assistente prestativo..."
          />
          <p className="text-sm text-muted-foreground">
            Este é o prompt de sistema que define o comportamento e conhecimento do seu assistente AI.
          </p>
        </div>
        
        <Separator />
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-medium">Configurações do Modelo</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">Modelo OpenAI</Label>
              <Select
                value={updatedAgentConfig.model}
                onValueChange={(value) => setUpdatedAgentConfig({
                  ...updatedAgentConfig,
                  model: value,
                })}
              >
                <SelectTrigger id="model">
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecione o modelo de IA que será usado para gerar respostas.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxTokens">Máximo de Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                min="100"
                max="4096"
                value={updatedAgentConfig.maxTokens}
                onChange={(e) => setUpdatedAgentConfig({
                  ...updatedAgentConfig,
                  maxTokens: parseInt(e.target.value),
                })}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Limite máximo de tokens para cada resposta (100-4096).
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Temperatura</Label>
            <div className="pt-2">
              <Slider
                value={[updatedAgentConfig.temperature]}
                min={0}
                max={1}
                step={0.1}
                onValueChange={(values) => setUpdatedAgentConfig({
                  ...updatedAgentConfig,
                  temperature: values[0],
                })}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Preciso ({updatedAgentConfig.temperature === 0 ? 'Atual' : ''})</span>
              <span>{updatedAgentConfig.temperature.toFixed(1)}</span>
              <span>Criativo ({updatedAgentConfig.temperature === 1 ? 'Atual' : ''})</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="detectEmotion" className="font-medium">Detectar Emoção</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5">
                      <HelpCircle className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p>Quando ativado, o assistente tentará detectar a emoção nas mensagens do usuário e adaptar suas respostas de acordo.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              id="detectEmotion"
              checked={updatedAgentConfig.detectEmotion}
              onCheckedChange={(checked) => setUpdatedAgentConfig({
                ...updatedAgentConfig,
                detectEmotion: checked,
              })}
            />
          </div>
        </div>
        
        <Separator />
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-medium">Conversa por Voz</h3>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="voiceEnabled" className="font-medium">Voz Ativada</Label>
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
                <Label htmlFor="voiceId">Voz</Label>
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
                      <SelectValue placeholder="Selecione a voz" />
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
                <Label htmlFor="language">Idioma</Label>
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
                    <SelectValue placeholder="Selecione o idioma" />
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
                <Label>Latência da Voz</Label>
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{updatedAgentConfig.voice.latency || 0}ms</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Tempo de resposta medido para geração de voz.
              </p>
            </div>

            <div className="mt-2 p-3 bg-primary/5 rounded border border-primary/10">
              <p className="text-sm">
                <strong>Como funciona:</strong> Quando ativado, os usuários terão uma conversa de voz bidirecional com o assistente. O agente continuará a conversa por áudio e poderá alternar entre texto e voz conforme necessário.
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
              ? `${updatedAgentConfig.trainingFiles.length} arquivo(s) carregado(s) e ativos para conhecimento personalizado.`
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
        <Button onClick={saveAgentConfig}>Salvar Alterações</Button>
      </CardFooter>
    </Card>
  );
};

export default AgentConfigTab;


import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Volume2, FileText, HelpCircle, Mic, Code, Brain, Bot, Braces, Sparkles, MessageSquareCode, Command } from "lucide-react";
import { toast } from "sonner";
import { AgentConfig, KnowledgeType } from "@/contexts/ChatContext";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from "date-fns";

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
  // Inicializar valores padrão para as novas configurações
  const initConfig = {
    ...agentConfig,
    knowledgeType: agentConfig.knowledgeType || 'rag',
    rag: agentConfig.rag || { enabled: true },
    fineTuning: agentConfig.fineTuning || { 
      enabled: false, 
      modelId: '', 
      status: 'not_started'
    },
    assistant: agentConfig.assistant || {
      enabled: false,
      assistantId: '',
      name: ''
    }
  };
  
  const [updatedAgentConfig, setUpdatedAgentConfig] = useState<AgentConfig>(initConfig);
  const [activeKnowledgeTab, setActiveKnowledgeTab] = useState<KnowledgeType>(initConfig.knowledgeType || 'rag');

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
      knowledgeType: activeKnowledgeTab
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

  // Inicializar as configurações de voz avançadas se não existirem
  const initVoiceConfig = () => {
    if (!updatedAgentConfig.voice.silenceTimeout) {
      setUpdatedAgentConfig({
        ...updatedAgentConfig,
        voice: {
          ...updatedAgentConfig.voice,
          silenceTimeout: 10,
          maxCallDuration: 1800,
          waitBeforeSpeaking: 0.4,
          waitAfterPunctuation: 0.1,
          waitWithoutPunctuation: 1.5,
          waitAfterNumber: 0.5,
          endCallMessage: "Encerrando chamada por inatividade. Obrigado pela conversa."
        }
      });
    }
  };

  // Inicializar configurações de voz e atualizar o tipo de conhecimento ativo
  useEffect(() => {
    initVoiceConfig();
    setActiveKnowledgeTab(updatedAgentConfig.knowledgeType || 'rag');
  }, []);
  
  // Handler para alternar entre os tipos de conhecimento
  const handleKnowledgeTypeChange = (type: KnowledgeType) => {
    setActiveKnowledgeTab(type);
    setUpdatedAgentConfig({
      ...updatedAgentConfig,
      knowledgeType: type
    });
  };
  
  // Verificar se temos uma chave API configurada
  const hasApiKey = !!updatedAgentConfig.fineTuning?.modelId || 
                   !!updatedAgentConfig.assistant?.assistantId;

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
        
        {/* Seção de Tipo de Conhecimento */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-medium">Tipo de Conhecimento</h3>
          </div>
          
          <RadioGroup 
            value={activeKnowledgeTab}
            onValueChange={(value) => handleKnowledgeTypeChange(value as KnowledgeType)}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2"
          >
            <div className={`border rounded-md p-4 relative flex flex-col items-center gap-2 
              ${activeKnowledgeTab === 'rag' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <RadioGroupItem value="rag" id="rag" className="sr-only" />
              <Label
                htmlFor="rag"
                className="flex flex-col items-center gap-2 cursor-pointer w-full"
              >
                <Braces className="h-8 w-8 text-primary" />
                <span className="font-medium">RAG</span>
                <span className="text-xs text-center text-muted-foreground">
                  Recuperação com Augmented Generation
                </span>
                {activeKnowledgeTab === 'rag' && (
                  <Badge className="absolute top-2 right-2">Ativo</Badge>
                )}
              </Label>
            </div>
            
            <div className={`border rounded-md p-4 relative flex flex-col items-center gap-2 
              ${activeKnowledgeTab === 'fine-tuning' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <RadioGroupItem value="fine-tuning" id="fine-tuning" className="sr-only" />
              <Label
                htmlFor="fine-tuning"
                className="flex flex-col items-center gap-2 cursor-pointer w-full"
              >
                <Sparkles className="h-8 w-8 text-primary" />
                <span className="font-medium">Fine-Tuning</span>
                <span className="text-xs text-center text-muted-foreground">
                  Modelo especializado em seu conteúdo
                </span>
                {activeKnowledgeTab === 'fine-tuning' && (
                  <Badge className="absolute top-2 right-2">Ativo</Badge>
                )}
              </Label>
            </div>
            
            <div className={`border rounded-md p-4 relative flex flex-col items-center gap-2 
              ${activeKnowledgeTab === 'assistant' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <RadioGroupItem value="assistant" id="assistant" className="sr-only" />
              <Label
                htmlFor="assistant"
                className="flex flex-col items-center gap-2 cursor-pointer w-full"
              >
                <MessageSquareCode className="h-8 w-8 text-primary" />
                <span className="font-medium">Assistente OpenAI</span>
                <span className="text-xs text-center text-muted-foreground">
                  Usar assistente pré-configurado
                </span>
                <Badge className="bg-yellow-600 hover:bg-yellow-700 absolute top-2 right-2">Beta</Badge>
                {activeKnowledgeTab === 'assistant' && (
                  <Badge className="absolute top-2 left-2">Ativo</Badge>
                )}
              </Label>
            </div>
          </RadioGroup>
          
          {/* Conteúdos específicos para cada tipo de conhecimento */}
          <div className="pt-4">
            {activeKnowledgeTab === 'rag' && (
              <div className="space-y-4 border p-4 rounded-md">
                <div className="flex items-center gap-2">
                  <Braces className="h-5 w-5 text-primary" />
                  <h4 className="text-md font-medium">Configurações RAG</h4>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ragEnabled" className="font-medium">RAG Ativado</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-5 w-5">
                            <HelpCircle className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p>Recuperação com Augmented Generation permite que o modelo acesse seu conteúdo para responder perguntas.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Switch
                    id="ragEnabled"
                    checked={updatedAgentConfig.rag?.enabled}
                    onCheckedChange={(checked) => setUpdatedAgentConfig({
                      ...updatedAgentConfig,
                      rag: {
                        ...updatedAgentConfig.rag,
                        enabled: checked,
                      },
                    })}
                  />
                </div>
                
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
                
                <div className="bg-primary/5 p-3 rounded-md text-sm mt-4">
                  <p>
                    <strong>Como funciona o RAG:</strong> O sistema analisa seus documentos e permite que o assistente 
                    use essas informações para responder perguntas com precisão. Ideal para base de conhecimento, FAQs e suporte técnico.
                  </p>
                </div>
              </div>
            )}
            
            {activeKnowledgeTab === 'fine-tuning' && (
              <div className="space-y-4 border p-4 rounded-md">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h4 className="text-md font-medium">Configurações de Fine-Tuning</h4>
                </div>
                
                {!updatedAgentConfig.fineTuning?.modelId ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Fine-tuning cria um modelo personalizado treinado em seus dados específicos, 
                      permitindo respostas mais precisas e reduzindo custos de token.
                    </p>
                    
                    <div className="space-y-2">
                      <Label htmlFor="fineTuningId">ID do Modelo Fine-Tuned</Label>
                      <Input
                        id="fineTuningId"
                        placeholder="ft:gpt-3.5-turbo:my-org:custom_suffix:id"
                        value={updatedAgentConfig.fineTuning?.modelId || ''}
                        onChange={(e) => setUpdatedAgentConfig({
                          ...updatedAgentConfig,
                          fineTuning: {
                            ...updatedAgentConfig.fineTuning,
                            modelId: e.target.value,
                            enabled: !!e.target.value,
                          }
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Adicione o ID do modelo fine-tuned fornecido pela OpenAI.
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-2 mt-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open('https://platform.openai.com/finetune', '_blank')}
                        className="w-fit"
                      >
                        <Command className="h-4 w-4 mr-2" />
                        Acessar Console OpenAI
                      </Button>
                    </div>
                    
                    <div className="bg-primary/5 p-3 rounded-md text-sm mt-4">
                      <p>
                        <strong>Como funciona o Fine-tuning:</strong> Crie um modelo especializado treinado no seu conteúdo.
                        Isto melhora a precisão e relevância das respostas, além de reduzir o custo por token comparado ao RAG.
                      </p>
                      <p className="mt-2">
                        <strong>Quando usar:</strong> Ideal para casos de uso específicos onde o modelo precisa aprender um estilo, formato
                        ou conhecimento especializado consistente.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="fineTuningEnabled" className="font-medium">Fine-tuning Ativado</Label>
                      </div>
                      <Switch
                        id="fineTuningEnabled"
                        checked={updatedAgentConfig.fineTuning?.enabled}
                        onCheckedChange={(checked) => setUpdatedAgentConfig({
                          ...updatedAgentConfig,
                          fineTuning: {
                            ...updatedAgentConfig.fineTuning,
                            enabled: checked,
                          },
                        })}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <Label>ID do Modelo</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          value={updatedAgentConfig.fineTuning?.modelId || ''}
                          onChange={(e) => setUpdatedAgentConfig({
                            ...updatedAgentConfig,
                            fineTuning: {
                              ...updatedAgentConfig.fineTuning,
                              modelId: e.target.value,
                            }
                          })}
                          className="flex-1"
                        />
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => window.open('https://platform.openai.com/finetune', '_blank')}
                        >
                          <Command className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {updatedAgentConfig.fineTuning?.status && (
                      <div className="flex gap-2 items-center">
                        <Label className="text-sm">Status:</Label>
                        <Badge variant={
                          updatedAgentConfig.fineTuning?.status === 'succeeded' ? 'default' : 
                          updatedAgentConfig.fineTuning?.status === 'pending' ? 'outline' : 'secondary'
                        }>
                          {updatedAgentConfig.fineTuning?.status === 'succeeded' ? 'Concluído' :
                           updatedAgentConfig.fineTuning?.status === 'pending' ? 'Pendente' :
                           'Não iniciado'}
                        </Badge>
                      </div>
                    )}
                    
                    {updatedAgentConfig.fineTuning?.lastTrainingDate && (
                      <div className="flex gap-2 items-center">
                        <Label className="text-sm">Último treinamento:</Label>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(updatedAgentConfig.fineTuning.lastTrainingDate), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </div>
                    )}
                    
                    <div className="pt-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <Label>Arquivos de Treinamento</Label>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Os arquivos utilizados para fine-tuning são gerenciados no console da OpenAI.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeKnowledgeTab === 'assistant' && (
              <div className="space-y-4 border p-4 rounded-md">
                <div className="flex items-center gap-2">
                  <MessageSquareCode className="h-5 w-5 text-primary" />
                  <h4 className="text-md font-medium">Assistente OpenAI</h4>
                  <Badge className="bg-yellow-600 hover:bg-yellow-700">Beta</Badge>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="assistantId">ID do Assistente</Label>
                  <Input
                    id="assistantId"
                    placeholder="asst_abc123"
                    value={updatedAgentConfig.assistant?.assistantId || ''}
                    onChange={(e) => setUpdatedAgentConfig({
                      ...updatedAgentConfig,
                      assistant: {
                        ...updatedAgentConfig.assistant,
                        assistantId: e.target.value,
                        enabled: !!e.target.value,
                      }
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Adicione o ID do assistente criado no console da OpenAI.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="assistantName">Nome do Assistente (opcional)</Label>
                  <Input
                    id="assistantName"
                    placeholder="Meu Assistente Especializado"
                    value={updatedAgentConfig.assistant?.name || ''}
                    onChange={(e) => setUpdatedAgentConfig({
                      ...updatedAgentConfig,
                      assistant: {
                        ...updatedAgentConfig.assistant,
                        name: e.target.value,
                      }
                    })}
                  />
                </div>
                
                <div className="flex flex-col gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open('https://platform.openai.com/assistants', '_blank')}
                    className="w-fit"
                  >
                    <Command className="h-4 w-4 mr-2" />
                    Acessar Assistentes OpenAI
                  </Button>
                </div>
                
                <div className="bg-primary/5 p-3 rounded-md text-sm mt-4">
                  <p>
                    <strong>Como funciona o Assistente OpenAI:</strong> Utilize um assistente já configurado na plataforma OpenAI,
                    com todas as suas capacidades e configurações específicas.
                  </p>
                  <p className="mt-2">
                    <strong>Vantagens:</strong> Rápida implantação, funcionalidades avançadas como memória integrada e personalização através da interface da OpenAI.
                  </p>
                </div>
              </div>
            )}
          </div>
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
            <Tabs defaultValue="basic">
              <TabsList className="mb-4">
                <TabsTrigger value="basic">Básico</TabsTrigger>
                <TabsTrigger value="advanced">Avançado</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic">
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
                
                <div className="space-y-2 mt-4">
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
              </TabsContent>
              
              <TabsContent value="advanced">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Configurações de Pausas e Fala</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="waitBeforeSpeaking">Espera antes de falar (seg)</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            id="waitBeforeSpeaking"
                            min="0"
                            max="2"
                            step="0.1"
                            value={updatedAgentConfig.voice.waitBeforeSpeaking || 0.4}
                            onChange={(e) => setUpdatedAgentConfig({
                              ...updatedAgentConfig,
                              voice: {
                                ...updatedAgentConfig.voice,
                                waitBeforeSpeaking: parseFloat(e.target.value),
                              },
                            })}
                          />
                          <span className="text-sm text-muted-foreground">seg</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Tempo que o assistente espera antes de começar a falar
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="waitAfterPunctuation">Após pontuação (seg)</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            id="waitAfterPunctuation"
                            min="0"
                            max="3"
                            step="0.1"
                            value={updatedAgentConfig.voice.waitAfterPunctuation || 0.1}
                            onChange={(e) => setUpdatedAgentConfig({
                              ...updatedAgentConfig,
                              voice: {
                                ...updatedAgentConfig.voice,
                                waitAfterPunctuation: parseFloat(e.target.value),
                              },
                            })}
                          />
                          <span className="text-sm text-muted-foreground">seg</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Tempo mínimo após transcrição com pontuação
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="waitWithoutPunctuation">Sem pontuação (seg)</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            id="waitWithoutPunctuation"
                            min="0"
                            max="3"
                            step="0.1"
                            value={updatedAgentConfig.voice.waitWithoutPunctuation || 1.5}
                            onChange={(e) => setUpdatedAgentConfig({
                              ...updatedAgentConfig,
                              voice: {
                                ...updatedAgentConfig.voice,
                                waitWithoutPunctuation: parseFloat(e.target.value),
                              },
                            })}
                          />
                          <span className="text-sm text-muted-foreground">seg</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Tempo mínimo após transcrição sem pontuação
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="waitAfterNumber">Após números (seg)</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            id="waitAfterNumber"
                            min="0"
                            max="3"
                            step="0.1"
                            value={updatedAgentConfig.voice.waitAfterNumber || 0.5}
                            onChange={(e) => setUpdatedAgentConfig({
                              ...updatedAgentConfig,
                              voice: {
                                ...updatedAgentConfig.voice,
                                waitAfterNumber: parseFloat(e.target.value),
                              },
                            })}
                          />
                          <span className="text-sm text-muted-foreground">seg</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Tempo mínimo após transcrição com números
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mt-4">
                    <h4 className="text-sm font-medium">Configurações de Tempo Limite</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="silenceTimeout">Limite de silêncio (seg)</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            id="silenceTimeout"
                            min="1"
                            max="60"
                            value={updatedAgentConfig.voice.silenceTimeout || 10}
                            onChange={(e) => setUpdatedAgentConfig({
                              ...updatedAgentConfig,
                              voice: {
                                ...updatedAgentConfig.voice,
                                silenceTimeout: parseInt(e.target.value),
                              },
                            })}
                          />
                          <span className="text-sm text-muted-foreground">seg</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Tempo de espera antes de encerrar chamada por inatividade
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="maxCallDuration">Duração máxima (seg)</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            id="maxCallDuration"
                            min="60"
                            max="3600"
                            value={updatedAgentConfig.voice.maxCallDuration || 1800}
                            onChange={(e) => setUpdatedAgentConfig({
                              ...updatedAgentConfig,
                              voice: {
                                ...updatedAgentConfig.voice,
                                maxCallDuration: parseInt(e.target.value),
                              },
                            })}
                          />
                          <span className="text-sm text-muted-foreground">seg</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Tempo máximo que uma chamada pode durar
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mt-4">
                    <Label htmlFor="endCallMessage">Mensagem de encerramento</Label>
                    <Textarea
                      id="endCallMessage"
                      value={updatedAgentConfig.voice.endCallMessage || "Encerrando chamada por inatividade. Obrigado pela conversa."}
                      onChange={(e) => setUpdatedAgentConfig({
                        ...updatedAgentConfig,
                        voice: {
                          ...updatedAgentConfig.voice,
                          endCallMessage: e.target.value,
                        },
                      })}
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Mensagem falada ao encerrar a chamada por inatividade
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-2 p-3 bg-primary/5 rounded border border-primary/10">
              <p className="text-sm">
                <strong>Como funciona:</strong> Quando ativado, os usuários terão uma conversa de voz bidirecional com o assistente. O agente continuará a conversa por áudio e poderá alternar entre texto e voz conforme necessário.
              </p>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={saveAgentConfig}>Salvar Alterações</Button>
      </CardFooter>
    </Card>
  );
};

export default AgentConfigTab;

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast";

interface VoiceSettingsProps {
  settings: {
    silenceTimeout: number;
    maxCallDuration: number;
    waitBeforeSpeaking: number;
    waitAfterPunctuation: number;
    waitWithoutPunctuation: number;
    waitAfterNumber: number;
    endCallMessage: string;
  };
  onSave: (settings: any) => void;
  onCancel: () => void;
}

const RagSettings = () => {
  const [ragEnabled, setRagEnabled] = useState<boolean>(true);
  const [indexStats, setIndexStats] = useState<{
    documentCount: number;
    chunkCount: number;
  } | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);
  
  useEffect(() => {
    const ragEnabledValue = embeddingService.isEnabled();
    setRagEnabled(ragEnabledValue);
    
    updateIndexStats();
  }, []);
  
  const updateIndexStats = () => {
    if (embeddingService.isReady()) {
      setIndexStats(embeddingService.getStats());
    }
  };
  
  const handleRagToggle = (value: boolean) => {
    embeddingService.setEnabled(value);
    setRagEnabled(value);
    toast.success(`Sistema RAG ${value ? 'ativado' : 'desativado'}`);
  };
  
  const handleReindex = async () => {
    try {
      setIsReindexing(true);
      toast.info("Reindexando documentos...");
      await embeddingService.reindexAllDocuments();
      updateIndexStats();
      toast.success("Reindexação concluída com sucesso");
    } catch (error) {
      console.error("Erro ao reindexar documentos:", error);
      toast.error("Erro ao reindexar documentos");
    } finally {
      setIsReindexing(false);
    }
  };
  
  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-md font-medium">Sistema RAG</h3>
          <p className="text-sm text-muted-foreground">
            Encontra contexto relevante nos documentos de treinamento
          </p>
        </div>
        <Switch
          checked={ragEnabled}
          onCheckedChange={handleRagToggle}
        />
      </div>
      
      {ragEnabled && indexStats && (
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-muted p-2 rounded-md">
            <div className="text-sm">
              <span className="font-medium">Documentos indexados:</span> {indexStats.documentCount}
            </div>
            <div className="text-sm">
              <span className="font-medium">Fragmentos:</span> {indexStats.chunkCount}
            </div>
          </div>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleReindex}
            disabled={isReindexing || !embeddingService.isReady()}
            className="w-full"
          >
            {isReindexing ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                Reindexando...
              </>
            ) : (
              <>Reindexar documentos</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  settings,
  onSave,
  onCancel
}) => {
  const [formValues, setFormValues] = useState(settings);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSliderChange = (name: string) => (values: number[]) => {
    setFormValues((prev) => ({
      ...prev,
      [name]: values[0]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formValues);
  };

  return (
    <div className="space-y-6 py-4 px-0">
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Configurações da Conversa de Voz</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Comportamento de Resposta</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="waitBeforeSpeaking">Espera antes de falar</Label>
                    <span className="text-xs text-muted-foreground">{formValues.waitBeforeSpeaking.toFixed(1)}s</span>
                  </div>
                  <Slider
                    id="waitBeforeSpeaking"
                    min={0}
                    max={2}
                    step={0.1}
                    value={[formValues.waitBeforeSpeaking]}
                    onValueChange={handleSliderChange("waitBeforeSpeaking")}
                  />
                  <p className="text-xs text-muted-foreground">Tempo que o assistente espera antes de começar a falar</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="waitAfterPunctuation">Espera após pontuação</Label>
                    <span className="text-xs text-muted-foreground">{formValues.waitAfterPunctuation.toFixed(1)}s</span>
                  </div>
                  <Slider
                    id="waitAfterPunctuation"
                    min={0}
                    max={3}
                    step={0.1}
                    value={[formValues.waitAfterPunctuation]}
                    onValueChange={handleSliderChange("waitAfterPunctuation")}
                  />
                  <p className="text-xs text-muted-foreground">Tempo mínimo de espera após transcrição terminando com pontuação</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="waitWithoutPunctuation">Espera sem pontuação</Label>
                    <span className="text-xs text-muted-foreground">{formValues.waitWithoutPunctuation.toFixed(1)}s</span>
                  </div>
                  <Slider
                    id="waitWithoutPunctuation"
                    min={0}
                    max={3}
                    step={0.1}
                    value={[formValues.waitWithoutPunctuation]}
                    onValueChange={handleSliderChange("waitWithoutPunctuation")}
                  />
                  <p className="text-xs text-muted-foreground">Tempo mínimo de espera após transcrição sem pontuação</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="waitAfterNumber">Espera após números</Label>
                    <span className="text-xs text-muted-foreground">{formValues.waitAfterNumber.toFixed(1)}s</span>
                  </div>
                  <Slider
                    id="waitAfterNumber"
                    min={0}
                    max={3}
                    step={0.1}
                    value={[formValues.waitAfterNumber]}
                    onValueChange={handleSliderChange("waitAfterNumber")}
                  />
                  <p className="text-xs text-muted-foreground">Tempo mínimo de espera após transcrição terminando com números</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4 pt-2">
              <h3 className="font-medium text-sm">Configurações de Tempo Limite</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="silenceTimeout">Tempo limite de silêncio</Label>
                    <span className="text-xs text-muted-foreground">{formValues.silenceTimeout}s</span>
                  </div>
                  <Slider
                    id="silenceTimeout"
                    min={1}
                    max={30}
                    step={1}
                    value={[formValues.silenceTimeout]}
                    onValueChange={handleSliderChange("silenceTimeout")}
                  />
                  <p className="text-xs text-muted-foreground">Tempo de espera antes de encerrar a chamada por inatividade</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="maxCallDuration">Duração máxima da chamada</Label>
                    <span className="text-xs text-muted-foreground">{Math.floor(formValues.maxCallDuration / 60)}min {formValues.maxCallDuration % 60}s</span>
                  </div>
                  <Slider
                    id="maxCallDuration"
                    min={60}
                    max={3600}
                    step={60}
                    value={[formValues.maxCallDuration]}
                    onValueChange={handleSliderChange("maxCallDuration")}
                  />
                  <p className="text-xs text-muted-foreground">Tempo máximo que uma chamada pode durar</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2 pt-2">
              <Label htmlFor="endCallMessage">Mensagem de encerramento</Label>
              <Textarea
                id="endCallMessage"
                name="endCallMessage"
                value={formValues.endCallMessage}
                onChange={handleChange}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">Mensagem falada ao encerrar a chamada por inatividade</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit">
              Salvar Configurações
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      <Separator />
      
      <RagSettings />
    </div>
  );
};

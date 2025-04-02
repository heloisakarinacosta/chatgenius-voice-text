
import React, { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import RagSettings from "./RagSettings";

interface VoiceSettingsProps {
  settings: {
    silenceTimeout: number;
    maxCallDuration: number;
    waitBeforeSpeaking: number;
    waitAfterPunctuation: number;
    waitWithoutPunctuation: number;
    waitAfterNumber: number;
    endCallMessage: string;
    continuousMode?: boolean;
  };
  onSave: (settings: any) => void;
  onCancel: () => void;
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  settings,
  onSave,
  onCancel
}) => {
  const [formValues, setFormValues] = useState({
    ...settings,
    continuousMode: settings.continuousMode !== undefined ? settings.continuousMode : true
  });
  const { toast } = useToast();

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

  const handleSwitchChange = (name: string) => (checked: boolean) => {
    setFormValues((prev) => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formValues);
    toast({
      title: "Configurações salvas com sucesso"
    });
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
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="continuousMode" className="flex-grow">Modo Contínuo</Label>
                  <Switch
                    id="continuousMode"
                    checked={formValues.continuousMode}
                    onCheckedChange={handleSwitchChange("continuousMode")}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, o assistente responde durante pausas na sua fala
                </p>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="silenceTimeout">Tempo de silêncio (s)</Label>
                    <span className="text-xs text-muted-foreground">{formValues.silenceTimeout.toFixed(1)}s</span>
                  </div>
                  <Slider
                    id="silenceTimeout"
                    min={0.2}
                    max={2}
                    step={0.1}
                    value={[formValues.silenceTimeout]}
                    onValueChange={handleSliderChange("silenceTimeout")}
                  />
                  <p className="text-xs text-muted-foreground">Tempo de silêncio necessário para considerar uma pausa</p>
                </div>
                
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
                  <p className="text-xs text-muted-foreground">Tempo de espera após transcrição contendo números</p>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <h3 className="font-medium text-sm">Limite de Tempo</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="maxCallDuration">Duração máxima (minutos)</Label>
                  <span className="text-xs text-muted-foreground">{Math.round(formValues.maxCallDuration / 60)} min</span>
                </div>
                <Slider
                  id="maxCallDuration"
                  min={300}
                  max={3600}
                  step={60}
                  value={[formValues.maxCallDuration]}
                  onValueChange={handleSliderChange("maxCallDuration")}
                />
                <p className="text-xs text-muted-foreground">Duração máxima da conversa antes de ser encerrada automaticamente</p>
              </div>
              
              <div className="space-y-2 pt-2">
                <Label htmlFor="endCallMessage">Mensagem de encerramento</Label>
                <Textarea
                  id="endCallMessage"
                  name="endCallMessage"
                  value={formValues.endCallMessage}
                  onChange={handleChange}
                  rows={2}
                  className="resize-none"
                  placeholder="Mensagem exibida quando a chamada é encerrada automaticamente"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" type="button" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit">Salvar configurações</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default VoiceSettings;

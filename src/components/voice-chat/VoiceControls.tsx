
import React, { useState } from "react";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Settings, VolumeX, Volume1, Volume2, Clock, Database, RefreshCw, BookOpen, Mic } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { embeddingService } from "@/utils/embeddingService";

interface Voice {
  id: string;
  name: string;
}

interface VoiceControlsProps {
  volume: number;
  setVolume: (volume: number) => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  selectedVoice: string;
  setSelectedVoice: (voiceId: string) => void;
  voices: Voice[];
}

const brazilianVoiceLabels: Record<string, string> = {
  "alloy": "Alloy (Neutro)",
  "echo": "Echo (Masculina)",
  "fable": "Fable (Masculina, Suave)",
  "onyx": "Onyx (Masculina, Grave)",
  "nova": "Nova (Feminina, Energética)",
  "shimmer": "Shimmer (Feminina, Clara)"
};

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  volume,
  setVolume,
  playbackRate,
  setPlaybackRate,
  selectedVoice,
  setSelectedVoice,
  voices
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isRagEnabled, setIsRagEnabled] = useState(true);

  const VolumeIcon = volume === 0 
    ? VolumeX 
    : volume < 0.5 
      ? Volume1 
      : Volume2;
      
  const handleReindexDocuments = () => {
    try {
      embeddingService.reindexAllDocuments();
      toast.success("Base de conhecimento reindexada com sucesso", {
        description: "Melhorias de busca aplicadas a todos os documentos."
      });
    } catch (error) {
      console.error("Erro ao reindexar documentos:", error);
      toast.error("Erro ao reindexar documentos", {
        description: "Tente novamente ou contate o suporte."
      });
    }
  };

  const toggleRagSystem = (enabled: boolean) => {
    setIsRagEnabled(enabled);
    embeddingService.setEnabled(enabled);
    toast.success(enabled 
      ? "Sistema RAG ativado" 
      : "Sistema RAG desativado", {
      description: enabled 
        ? "As informações da base de conhecimento serão usadas nas respostas" 
        : "As respostas não usarão a base de conhecimento"
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-full w-8 h-8 p-0"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Configurações de Voz</h3>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground flex items-center gap-2">
                <VolumeIcon className="h-4 w-4" />
                Volume
              </label>
              <span className="text-xs text-muted-foreground">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <Slider
              value={[volume]}
              max={1}
              step={0.01}
              onValueChange={(val) => setVolume(val[0])}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Velocidade
              </label>
              <span className="text-xs text-muted-foreground">
                {playbackRate.toFixed(1)}x
              </span>
            </div>
            <Slider
              value={[playbackRate]}
              min={0.5}
              max={2}
              step={0.1}
              onValueChange={(val) => setPlaybackRate(val[0])}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground block">
              Voz
            </label>
            <Select
              value={selectedVoice}
              onValueChange={setSelectedVoice}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma voz" />
              </SelectTrigger>
              <SelectContent>
                {voices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {brazilianVoiceLabels[voice.id] || voice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="pt-2 border-t">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs flex items-center gap-1.5"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? "Ocultar opções avançadas" : "Mostrar opções avançadas"}
            </Button>
            
            {showAdvanced && (
              <div className="space-y-4 mt-2">
                <div className="flex items-center justify-between space-x-2">
                  <div className="flex items-center space-x-2">
                    <Mic className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="continuous-mode" className="text-sm text-muted-foreground">
                      Modo contínuo
                    </Label>
                  </div>
                  <Switch
                    id="continuous-mode"
                    checked={true}
                    defaultChecked={true}
                    aria-readonly={true}
                  />
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Permite que o assistente responda mesmo enquanto você está falando
                </p>
                
                <div className="flex items-center justify-between space-x-2">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="rag-toggle" className="text-sm text-muted-foreground">
                      Sistema RAG
                    </Label>
                  </div>
                  <Switch
                    id="rag-toggle"
                    checked={isRagEnabled}
                    onCheckedChange={toggleRagSystem}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5" />
                    Base de conhecimento
                  </p>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 flex items-center gap-1 text-xs"
                    onClick={handleReindexDocuments}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Reindexar
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground mt-1">
                  A reindexação melhora a precisão do sistema de busca com o algoritmo mais recente.
                </p>
                
                {embeddingService.isReady() && (
                  <div className="bg-muted/50 rounded p-2 text-xs text-muted-foreground">
                    <p>Status: {embeddingService.getStats().documentCount} documentos indexados</p>
                    <p>Chunks: {embeddingService.getStats().chunkCount} fragmentos</p>
                    <p>RAG: {isRagEnabled ? "Ativado" : "Desativado"}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

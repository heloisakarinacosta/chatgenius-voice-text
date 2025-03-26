
import React, { useState } from "react";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Settings, VolumeX, Volume1, Volume2, Clock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const VolumeIcon = volume === 0 
    ? VolumeX 
    : volume < 0.5 
      ? Volume1 
      : Volume2;

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
                    {voice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

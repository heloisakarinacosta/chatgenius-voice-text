
import { useState, useRef, useEffect } from "react";

export function useSpeechPlayer(defaultVoice: string = "alloy") {
  const [volume, setVolume] = useState<number>(0.8);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string>(defaultVoice);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueue = useRef<string[]>([]);
  const isProcessingQueue = useRef<boolean>(false);
  
  // Efeito para aplicar mudanças de volume e velocidade
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [volume, playbackRate]);
  
  // Efeito para inicializar o audio ref
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      
      audioRef.current.onplay = () => {
        setIsPlaying(true);
      };
      
      audioRef.current.onended = () => {
        setIsPlaying(false);
        // Processar próximo item na fila
        processQueue();
      };
      
      audioRef.current.onerror = (e) => {
        console.error("Erro ao reproduzir áudio:", e);
        setIsPlaying(false);
        // Tenta o próximo item na fila em caso de erro
        processQueue();
      };
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);
  
  // Processar a fila de áudios
  const processQueue = async () => {
    if (isProcessingQueue.current || audioQueue.current.length === 0) {
      return;
    }
    
    isProcessingQueue.current = true;
    
    try {
      const nextAudioUrl = audioQueue.current.shift();
      
      if (nextAudioUrl && audioRef.current) {
        audioRef.current.src = nextAudioUrl;
        audioRef.current.volume = volume;
        audioRef.current.playbackRate = playbackRate;
        
        try {
          await audioRef.current.play();
        } catch (error) {
          console.error("Erro ao reproduzir áudio da fila:", error);
        }
      }
    } finally {
      isProcessingQueue.current = false;
    }
  };
  
  // Função para reproduzir áudio
  const playAudio = (url: string) => {
    // Adiciona à fila
    audioQueue.current.push(url);
    
    // Se não está reproduzindo, inicia processamento da fila
    if (!isPlaying) {
      processQueue();
    }
  };
  
  // Parar a reprodução
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
    // Limpa a fila
    audioQueue.current = [];
  };
  
  return {
    audioRef,
    volume,
    setVolume,
    playbackRate,
    setPlaybackRate,
    selectedVoice,
    setSelectedVoice,
    isPlaying,
    playAudio,
    stopAudio
  };
}

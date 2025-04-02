import { useState, useRef, useEffect } from "react";

export function useSpeechPlayer(defaultVoice: string = "alloy") {
  const [volume, setVolume] = useState<number>(0.8);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string>(defaultVoice);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioData, setAudioData] = useState<number[]>(Array(30).fill(0));
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueue = useRef<string[]>([]);
  const isProcessingQueue = useRef<boolean>(false);
  const lastPlayedTextRef = useRef<string>("");
  const textChunksRef = useRef<string[]>([]);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Efeito para aplicar mudanças de volume e taxa de reprodução
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [volume, playbackRate]);
  
  // Efeito para inicializar a referência de áudio e limpar na desmontagem
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      
      audioRef.current.onplay = () => {
        setIsPlaying(true);
        startAudioVisualization();
      };
      
      audioRef.current.onended = () => {
        setIsPlaying(false);
        stopAudioVisualization();
        // Processar próximo item na fila
        processQueue();
      };
      
      audioRef.current.onerror = (e) => {
        console.error("Error playing audio:", e);
        setIsPlaying(false);
        stopAudioVisualization();
        // Tentar próximo item na fila em caso de erro
        processQueue();
      };
    }
    
    return () => {
      cleanupAudioResources();
    };
  }, []);

  const cleanupAudioResources = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    
    stopAudioVisualization();
    
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      } catch (e) {
        console.error("Error disconnecting audio source:", e);
      }
    }
    
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
        audioContextRef.current = null;
      } catch (e) {
        console.error("Error closing audio context:", e);
      }
    }
    
    analyzerRef.current = null;
  };
  
  const startAudioVisualization = () => {
    if (!audioRef.current) return;
    
    // Limpar contexto de áudio e analisador anteriores antes de criar novos
    if (analyzerRef.current || sourceNodeRef.current || audioContextRef.current) {
      stopAudioVisualization();
    }
    
    try {
      // Criar novo AudioContext se necessário
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
      }
      
      const analyzer = audioContextRef.current.createAnalyser();
      analyzer.fftSize = 256; // Menor para melhor desempenho
      analyzer.smoothingTimeConstant = 0.6; // Aumentado para transições mais suaves (0.5 para 0.6)
      
      analyzerRef.current = analyzer;
      
      const source = audioContextRef.current.createMediaElementSource(audioRef.current);
      sourceNodeRef.current = source;
      
      source.connect(analyzer);
      analyzer.connect(audioContextRef.current.destination);
      
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateAudioData = () => {
        if (!isPlaying || !analyzerRef.current) {
          stopAudioVisualization();
          return;
        }
        
        analyzerRef.current.getByteFrequencyData(dataArray);
        
        // Converter para 30 barras para visualização
        const levelCount = 30;
        const levelData = Array(levelCount).fill(0);
        
        for (let i = 0; i < levelCount; i++) {
          const start = Math.floor(i * bufferLength / levelCount);
          const end = Math.floor((i + 1) * bufferLength / levelCount);
          let sum = 0;
          
          for (let j = start; j < end; j++) {
            sum += dataArray[j];
          }
          
          // Amplificar os valores para melhor visualização
          const normalizedValue = (sum / (end - start)) / 256;
          levelData[i] = Math.min(1, normalizedValue * 4); // Amplificado o fator de 3 para 4
        }
        
        setAudioData(levelData);
        animationFrameRef.current = requestAnimationFrame(updateAudioData);
      };
      
      animationFrameRef.current = requestAnimationFrame(updateAudioData);
    } catch (error) {
      console.error("Error setting up audio visualization:", error);
    }
  };
  
  const stopAudioVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      } catch (e) {
        console.error("Error disconnecting source:", e);
      }
    }
    
    // Fade out da visualização de áudio menos drástico
    setAudioData(prev => prev.map(level => Math.max(0, level * 0.7))); // Aumentado de 0.5 para 0.7
  };
  
  // Processar audio queue
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
          console.error("Error playing queued audio:", error);
          // Se não for possível reproduzir, tentar o próximo item
          isProcessingQueue.current = false;
          processQueue();
        }
      }
    } finally {
      isProcessingQueue.current = false;
    }
  };
  
  // Função para detectar texto similar para evitar duplicatas de áudio
  const isDuplicateText = (text: string): boolean => {
    if (!text || text.length < 5) return false;
    
    // Verificar se o texto é muito similar ao último texto reproduzido
    const lastText = lastPlayedTextRef.current;
    if (lastText.includes(text) || text.includes(lastText)) {
      return true;
    }
    
    // Verificar se o texto está contido em qualquer um dos chunks anteriores
    return textChunksRef.current.some(chunk => 
      chunk.includes(text) || text.includes(chunk)
    );
  };
  
  // Função para reproduzir áudio
  const playAudio = (url: string, text?: string) => {
    // Verificar se este texto é uma duplicata do último texto reproduzido
    if (text && isDuplicateText(text)) {
      console.log("Skipping duplicate text:", text.substring(0, 30));
      return;
    }
    
    // Se texto for fornecido, atualizar o último texto reproduzido
    if (text) {
      lastPlayedTextRef.current = text;
      textChunksRef.current.push(text);
      
      // Manter apenas os últimos 10 chunks para economizar memória
      if (textChunksRef.current.length > 10) {
        textChunksRef.current.shift();
      }
    }
    
    // Adicionar à fila
    audioQueue.current.push(url);
    
    // Se não estiver reproduzindo, iniciar processamento da fila
    if (!isPlaying) {
      processQueue();
    }
  };
  
  // Função para reproduzir texto em streaming
  const playStreamingText = (url: string, text: string, isComplete: boolean = false) => {
    // Verificar se este texto é uma duplicata
    if (isDuplicateText(text)) {
      console.log("Skipping duplicate streaming text:", text.substring(0, 30));
      return;
    }
    
    // Para streaming, atualizar o último texto reproduzido apenas em mensagens completas
    if (isComplete) {
      lastPlayedTextRef.current = text;
    }
    
    // Adicionar texto à história
    textChunksRef.current.push(text);
    
    // Manter apenas os últimos 10 chunks para economizar memória
    if (textChunksRef.current.length > 10) {
      textChunksRef.current.shift();
    }
    
    // Adicionar à fila
    audioQueue.current.push(url);
    
    // Se não estiver reproduzindo, iniciar processamento da fila
    if (!isPlaying) {
      processQueue();
    }
  };
  
  // Parar reprodução
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      stopAudioVisualization();
    }
    // Limpar fila
    audioQueue.current = [];
    lastPlayedTextRef.current = "";
    textChunksRef.current = [];
  };
  
  // Pausar reprodução sem limpar a fila
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      stopAudioVisualization();
    }
  };
  
  // Retomar reprodução se pausada
  const resumeAudio = async () => {
    if (audioRef.current && !isPlaying && audioRef.current.src) {
      try {
        await audioRef.current.play();
      } catch (error) {
        console.error("Error resuming audio:", error);
      }
    } else if (!isPlaying) {
      // Se nada estiver carregado mas tem itens na fila
      processQueue();
    }
  };
  
  // Limpar história de texto reproduzido
  const clearTextHistory = () => {
    lastPlayedTextRef.current = "";
    textChunksRef.current = [];
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
    audioData,
    playAudio,
    playStreamingText,
    stopAudio,
    pauseAudio,
    resumeAudio,
    clearTextHistory
  };
}

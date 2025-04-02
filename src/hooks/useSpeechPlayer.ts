
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
  
  // Effect para aplicar volume e playback rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [volume, playbackRate]);
  
  // Effect para inicializar audio ref e limpar ao desmontar
  useEffect(() => {
    if (!audioRef.current) {
      console.log("Inicializando elemento de áudio");
      audioRef.current = new Audio();
      
      audioRef.current.onplay = () => {
        console.log("Áudio iniciou a reprodução");
        setIsPlaying(true);
        startAudioVisualization();
      };
      
      audioRef.current.onended = () => {
        console.log("Áudio terminou a reprodução");
        setIsPlaying(false);
        stopAudioVisualization();
        // Processar próximo item na fila
        processQueue();
      };
      
      audioRef.current.onerror = (e) => {
        console.error("Erro ao reproduzir áudio:", e);
        setIsPlaying(false);
        stopAudioVisualization();
        // Tentar próximo item na fila em caso de erro
        processQueue();
      };
    }
    
    return () => {
      console.log("Limpando recursos de áudio ao desmontar");
      cleanupAudioResources();
    };
  }, []);

  const cleanupAudioResources = () => {
    console.log("Executando limpeza de recursos de áudio");
    
    if (audioRef.current) {
      console.log("Pausando e limpando elemento de áudio");
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    
    if (animationFrameRef.current) {
      console.log("Cancelando animation frame");
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Importante: desconectar nós de áudio antes de fechar o contexto
    if (sourceNodeRef.current) {
      try {
        console.log("Desconectando nó de fonte de áudio");
        sourceNodeRef.current.disconnect();
      } catch (e) {
        console.error("Erro ao desconectar fonte de áudio:", e);
      }
      sourceNodeRef.current = null;
    }
    
    if (analyzerRef.current) {
      try {
        console.log("Desconectando analisador de áudio");
        analyzerRef.current.disconnect();
      } catch (e) {
        console.error("Erro ao desconectar analisador:", e);
      }
      analyzerRef.current = null;
    }
    
    if (audioContextRef.current) {
      try {
        console.log("Fechando contexto de áudio");
        audioContextRef.current.close();
      } catch (e) {
        console.error("Erro ao fechar contexto de áudio:", e);
      }
      audioContextRef.current = null;
    }
    
    // Limpar visualização
    setAudioData(Array(30).fill(0));
  };
  
  const startAudioVisualization = () => {
    if (!audioRef.current) {
      console.log("Elemento de áudio não disponível para visualização");
      return;
    }
    
    // Limpar recursos anteriores antes de criar novos
    if (sourceNodeRef.current || analyzerRef.current || audioContextRef.current) {
      console.log("Limpando recursos de áudio anteriores antes de iniciar nova visualização");
      stopAudioVisualization();
    }
    
    try {
      console.log("Iniciando visualização de áudio");
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      analyzer.smoothingTimeConstant = 0.2; // Valor reduzido para reação mais rápida
      
      audioContextRef.current = audioContext;
      analyzerRef.current = analyzer;
      
      const source = audioContext.createMediaElementSource(audioRef.current);
      sourceNodeRef.current = source;
      
      source.connect(analyzer);
      analyzer.connect(audioContext.destination);
      
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateAudioData = () => {
        if (!isPlaying || !analyzerRef.current) {
          console.log("Parando atualização de dados de áudio");
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
          
          // Amplificar valores para melhor visualização
          const normalizedValue = (sum / (end - start)) / 256;
          levelData[i] = Math.min(1, normalizedValue * 5); // Amplificação aumentada para 5x
        }
        
        setAudioData(levelData);
        animationFrameRef.current = requestAnimationFrame(updateAudioData);
      };
      
      animationFrameRef.current = requestAnimationFrame(updateAudioData);
      console.log("Visualização de áudio iniciada");
    } catch (error) {
      console.error("Erro ao configurar visualização de áudio:", error);
    }
  };
  
  const stopAudioVisualization = () => {
    console.log("Parando visualização de áudio");
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Desconectar fontes de áudio para evitar erros
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (e) {
        console.error("Erro ao desconectar fonte:", e);
      }
      sourceNodeRef.current = null;
    }
    
    if (analyzerRef.current) {
      try {
        analyzerRef.current.disconnect();
      } catch (e) {
        console.error("Erro ao desconectar analisador:", e);
      }
      analyzerRef.current = null;
    }
    
    // Fade out suave da visualização de áudio
    setAudioData(prev => prev.map(level => Math.max(0, level * 0.5)));
  };
  
  // Process audio queue
  const processQueue = async () => {
    if (isProcessingQueue.current || audioQueue.current.length === 0) {
      return;
    }
    
    isProcessingQueue.current = true;
    
    try {
      const nextAudioUrl = audioQueue.current.shift();
      
      if (nextAudioUrl && audioRef.current) {
        console.log("Reproduzindo próximo áudio da fila");
        audioRef.current.src = nextAudioUrl;
        audioRef.current.volume = volume;
        audioRef.current.playbackRate = playbackRate;
        
        try {
          await audioRef.current.play();
        } catch (error) {
          console.error("Erro ao reproduzir áudio da fila:", error);
          // Se não conseguir reproduzir, tentar o próximo item
          isProcessingQueue.current = false;
          processQueue();
        }
      }
    } finally {
      isProcessingQueue.current = false;
    }
  };
  
  // Função para detectar texto similar para evitar áudio duplicado
  const isDuplicateText = (text: string): boolean => {
    if (!text || text.length < 5) return false;
    
    // Verificar se o texto é muito similar ao último texto reproduzido
    const lastText = lastPlayedTextRef.current;
    if (lastText.includes(text) || text.includes(lastText)) {
      return true;
    }
    
    // Verificar se o texto está contido em algum chunk anterior
    return textChunksRef.current.some(chunk => 
      chunk.includes(text) || text.includes(chunk)
    );
  };
  
  // Função para reproduzir áudio
  const playAudio = (url: string, text?: string) => {
    // Verificar se é um duplicado do último texto reproduzido
    if (text && isDuplicateText(text)) {
      console.log("Pulando texto duplicado:", text.substring(0, 30));
      return;
    }
    
    // Se texto foi fornecido, atualizar o último texto reproduzido
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
    // Verificar se esse texto é um duplicado
    if (isDuplicateText(text)) {
      console.log("Pulando texto de streaming duplicado:", text.substring(0, 30));
      return;
    }
    
    // Para streaming, atualizar o último texto reproduzido apenas em mensagens completas
    if (isComplete) {
      lastPlayedTextRef.current = text;
    }
    
    // Adicionar texto ao histórico
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
    console.log("Parando reprodução de áudio");
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
  
  // Pausar reprodução sem limpar fila
  const pauseAudio = () => {
    console.log("Pausando reprodução de áudio");
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      stopAudioVisualization();
    }
  };
  
  // Retomar reprodução se pausado
  const resumeAudio = async () => {
    console.log("Retomando reprodução de áudio");
    if (audioRef.current && !isPlaying && audioRef.current.src) {
      try {
        await audioRef.current.play();
      } catch (error) {
        console.error("Erro ao retomar áudio:", error);
      }
    } else if (!isPlaying) {
      // Se nada estiver carregado mas temos itens na fila
      processQueue();
    }
  };
  
  // Limpar histórico de texto reproduzido
  const clearTextHistory = () => {
    console.log("Limpando histórico de texto");
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

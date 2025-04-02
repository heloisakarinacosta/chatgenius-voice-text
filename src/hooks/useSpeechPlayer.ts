
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
  
  // Effect for applying volume and playback rate changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [volume, playbackRate]);
  
  // Effect to initialize audio ref and clean up on unmount
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
        // Process next item in queue
        processQueue();
      };
      
      audioRef.current.onerror = (e) => {
        console.error("Error playing audio:", e);
        setIsPlaying(false);
        stopAudioVisualization();
        // Try next item in queue in case of error
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
    
    // Clean up previous audio context and analyzer before creating new ones
    if (analyzerRef.current || sourceNodeRef.current || audioContextRef.current) {
      stopAudioVisualization();
    }
    
    try {
      // Create new AudioContext if necessary
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
      }
      
      const analyzer = audioContextRef.current.createAnalyser();
      analyzer.fftSize = 256; // Lower for better performance
      analyzer.smoothingTimeConstant = 0.5; // Smoother transitions
      
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
        
        // Convert to 30 bars for visualization
        const levelCount = 30;
        const levelData = Array(levelCount).fill(0);
        
        for (let i = 0; i < levelCount; i++) {
          const start = Math.floor(i * bufferLength / levelCount);
          const end = Math.floor((i + 1) * bufferLength / levelCount);
          let sum = 0;
          
          for (let j = start; j < end; j++) {
            sum += dataArray[j];
          }
          
          // Amplify the values for better visualization
          const normalizedValue = (sum / (end - start)) / 256;
          levelData[i] = Math.min(1, normalizedValue * 3); // Amplify by factor of 3, capped at 1
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
    
    // Fade out the audio visualization
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
        audioRef.current.src = nextAudioUrl;
        audioRef.current.volume = volume;
        audioRef.current.playbackRate = playbackRate;
        
        try {
          await audioRef.current.play();
        } catch (error) {
          console.error("Error playing queued audio:", error);
          // If can't play, try the next item
          isProcessingQueue.current = false;
          processQueue();
        }
      }
    } finally {
      isProcessingQueue.current = false;
    }
  };
  
  // Function to detect similar text to avoid duplicated audio
  const isDuplicateText = (text: string): boolean => {
    if (!text || text.length < 5) return false;
    
    // Check if text is very similar to the last played text
    const lastText = lastPlayedTextRef.current;
    if (lastText.includes(text) || text.includes(lastText)) {
      return true;
    }
    
    // Check if text is contained in any previous chunks
    return textChunksRef.current.some(chunk => 
      chunk.includes(text) || text.includes(chunk)
    );
  };
  
  // Function to play audio
  const playAudio = (url: string, text?: string) => {
    // Check if this is a duplicate of the last played text
    if (text && isDuplicateText(text)) {
      console.log("Skipping duplicate text:", text.substring(0, 30));
      return;
    }
    
    // If text is provided, update the last played text
    if (text) {
      lastPlayedTextRef.current = text;
      textChunksRef.current.push(text);
      
      // Manter apenas os últimos 10 chunks para economizar memória
      if (textChunksRef.current.length > 10) {
        textChunksRef.current.shift();
      }
    }
    
    // Add to queue
    audioQueue.current.push(url);
    
    // If not playing, start processing queue
    if (!isPlaying) {
      processQueue();
    }
  };
  
  // Function to play streaming text
  const playStreamingText = (url: string, text: string, isComplete: boolean = false) => {
    // Check if this text is a duplicate
    if (isDuplicateText(text)) {
      console.log("Skipping duplicate streaming text:", text.substring(0, 30));
      return;
    }
    
    // For streaming, update the last played text only on complete messages
    if (isComplete) {
      lastPlayedTextRef.current = text;
    }
    
    // Add text to history
    textChunksRef.current.push(text);
    
    // Manter apenas os últimos 10 chunks para economizar memória
    if (textChunksRef.current.length > 10) {
      textChunksRef.current.shift();
    }
    
    // Add to queue
    audioQueue.current.push(url);
    
    // If not playing, start processing queue
    if (!isPlaying) {
      processQueue();
    }
  };
  
  // Stop playback
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      stopAudioVisualization();
    }
    // Clear queue
    audioQueue.current = [];
    lastPlayedTextRef.current = "";
    textChunksRef.current = [];
  };
  
  // Pause playback without clearing queue
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      stopAudioVisualization();
    }
  };
  
  // Resume playback if paused
  const resumeAudio = async () => {
    if (audioRef.current && !isPlaying && audioRef.current.src) {
      try {
        await audioRef.current.play();
      } catch (error) {
        console.error("Error resuming audio:", error);
      }
    } else if (!isPlaying) {
      // If nothing is currently loaded but we have items in queue
      processQueue();
    }
  };
  
  // Clear played text history
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

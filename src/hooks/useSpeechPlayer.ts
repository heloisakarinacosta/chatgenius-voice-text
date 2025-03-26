
import { useState, useRef, useEffect } from "react";

export function useSpeechPlayer(defaultVoice: string = "alloy") {
  const [volume, setVolume] = useState<number>(0.8);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string>(defaultVoice);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueue = useRef<string[]>([]);
  const isProcessingQueue = useRef<boolean>(false);
  const lastPlayedTextRef = useRef<string>("");
  
  // Effect for applying volume and playback rate changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [volume, playbackRate]);
  
  // Effect to initialize audio ref
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      
      audioRef.current.onplay = () => {
        setIsPlaying(true);
      };
      
      audioRef.current.onended = () => {
        setIsPlaying(false);
        // Process next item in queue
        processQueue();
      };
      
      audioRef.current.onerror = (e) => {
        console.error("Error playing audio:", e);
        setIsPlaying(false);
        // Try next item in queue in case of error
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
          // If we can't play, try the next item
          isProcessingQueue.current = false;
          processQueue();
        }
      }
    } finally {
      isProcessingQueue.current = false;
    }
  };
  
  // Function to play audio
  const playAudio = (url: string, text?: string) => {
    // Check if this is a duplicate of the last played text
    if (text && text.trim() === lastPlayedTextRef.current.trim()) {
      console.log("Skipping duplicate text:", text);
      return;
    }
    
    // If text is provided, update the last played text
    if (text) {
      lastPlayedTextRef.current = text;
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
    // For streaming, we want to update the last played text only on complete messages
    if (isComplete) {
      lastPlayedTextRef.current = text;
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
    }
    // Clear queue
    audioQueue.current = [];
    lastPlayedTextRef.current = "";
  };
  
  // Pause playback without clearing queue
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
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
    playStreamingText,
    stopAudio,
    pauseAudio,
    resumeAudio
  };
}


import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Mic, StopCircle, RefreshCw, AudioWaveform } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { 
  transcribeAudio, 
  generateSpeech, 
  streamOpenAI
} from "@/utils/openai";
import { VoiceControls } from "./voice-chat/VoiceControls";
import { useSpeechPlayer } from "@/hooks/useSpeechPlayer";
import { VoiceSettings } from "./voice-chat/VoiceSettings";
import { silenceDetector } from "@/utils/silenceDetector";

const VOICES = [
  { id: 'alloy', name: 'Alloy (Neutro)' },
  { id: 'echo', name: 'Echo (Masculino)' },
  { id: 'fable', name: 'Fable (Feminino)' },
  { id: 'onyx', name: 'Onyx (Masculino Grave)' },
  { id: 'nova', name: 'Nova (Feminino Suave)' },
  { id: 'shimmer', name: 'Shimmer (Feminino Jovem)' }
];

// Valores padrão para detecção de silêncio, otimizados para conversação
const SILENCE_THRESHOLD = 0.3; // Reduzido para ser mais sensível
const MIN_VOICE_LEVEL = 0.5; // Reduzido para detectar voz mais facilmente
const MIN_RECORDING_DURATION = 750;
const VOICE_DETECTION_TIMEOUT = 8000;
const CONSECUTIVE_SILENCE_THRESHOLD = 3; // Reduzido para responder mais rápido

interface VoiceChatAgentProps {
  apiKey: string;
}

const VoiceChatAgent: React.FC<VoiceChatAgentProps> = ({ apiKey }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [stoppingRecording, setStoppingRecording] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(30).fill(0));
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isMicrophoneAvailable, setIsMicrophoneAvailable] = useState<boolean | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const processingAudioRef = useRef<boolean>(false);
  const lastProcessTimeRef = useRef<number>(0);
  const currentResponseRef = useRef<string>("");
  const currentStreamingMessageId = useRef<string | null>(null);
  const retryCountRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceDetectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelsRef = useRef<number[]>([]);
  const forcedStopRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number>(0);
  const consecutiveSilenceCountRef = useRef<number>(0);
  const silenceStartLoggedRef = useRef<boolean>(false);
  const voiceDetectedRef = useRef<boolean>(false);
  
  const MAX_RETRIES = 3;

  const { 
    addMessage, 
    updateMessage,
    agentConfig,
    messages,
    currentConversationId,
    updateAgentConfig
  } = useChat();

  const silenceTimeout = agentConfig?.voice?.silenceTimeout || 0.5; // Reduzido de 0.6 para 0.5
  const maxCallDuration = agentConfig?.voice?.maxCallDuration || 1800;
  const waitBeforeSpeaking = agentConfig?.voice?.waitBeforeSpeaking || 0.05;
  const waitAfterPunctuation = agentConfig?.voice?.waitAfterPunctuation || 0.03;
  const waitWithoutPunctuation = agentConfig?.voice?.waitWithoutPunctuation || 0.2;
  const waitAfterNumber = agentConfig?.voice?.waitAfterNumber || 0.1;
  const endCallMessage = agentConfig?.voice?.endCallMessage || "Encerrando chamada por inatividade. Obrigado pela conversa.";
  const continuousModeEnabled = agentConfig?.voice?.continuousMode !== undefined 
    ? agentConfig?.voice?.continuousMode 
    : true;

  const SILENCE_DURATION = silenceTimeout * 1000;

  const { 
    audioRef,
    volume, 
    setVolume,
    playbackRate, 
    setPlaybackRate,
    selectedVoice, 
    setSelectedVoice,
    playAudio,
    playStreamingText,
    isPlaying,
    audioData,
    stopAudio
  } = useSpeechPlayer(agentConfig?.voice?.voiceId || 'alloy');

  useEffect(() => {
    const checkMicrophoneSupport = async () => {
      try {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
          console.warn('MediaDevices API not supported in this browser');
          setIsMicrophoneAvailable(false);
          return;
        }
        
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsMicrophoneAvailable(true);
      } catch (error) {
        console.error('Microphone access denied or not available:', error);
        setIsMicrophoneAvailable(false);
      }
    };
    
    checkMicrophoneSupport();
  }, []);

  const cleanupResources = () => {
    console.log("Cleaning up voice chat resources");
    
    silenceDetector.cleanup();
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    if (voiceDetectionTimerRef.current) {
      clearTimeout(voiceDetectionTimerRef.current);
      voiceDetectionTimerRef.current = null;
    }
    
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error("Error stopping media recorder:", e);
      }
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.error("Error stopping audio track:", e);
        }
      });
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.error("Error closing audio context:", e);
      }
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    
    setIsRecording(false);
    setStoppingRecording(false);
    processingAudioRef.current = false;
    audioChunksRef.current = [];
    audioLevelsRef.current = [];
    forcedStopRef.current = false;
    setAudioLevels(Array(30).fill(0));
    setAudioLevel(0);
    
    console.log("Voice chat resources cleanup completed");
  };

  useEffect(() => {
    console.log("VoiceChatAgent: API key present:", !!apiKey);
    
    return cleanupResources;
  }, [apiKey]);

  // Função de atualização dos níveis de áudio para visualização
  const updateAudioLevels = (levels: number[], overallLevel: number) => {
    setAudioLevels(levels);
    setAudioLevel(overallLevel * 100); // Converter para porcentagem
    
    if (showDebugInfo && Math.random() < 0.05) {
      console.log(`[Audio Debug] Level: ${overallLevel.toFixed(2)}, Max: ${Math.max(...levels).toFixed(2)}`);
    }
  };

  const startRecording = async () => {
    if (stoppingRecording || isProcessing) {
      console.log("Cannot start recording while stopping or processing");
      return;
    }
    
    cleanupResources();
    
    try {
      console.log("Requesting microphone access...");
      
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        console.error("MediaDevices API is not supported in this browser or environment");
        toast.error("Seu navegador não suporta acesso ao microfone", {
          description: "Tente usar um navegador mais recente, como Chrome, Firefox, ou Edge."
        });
        setIsMicrophoneAvailable(false);
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        } 
      });
      
      streamRef.current = stream;
      console.log("Microphone access granted with optimal settings");
      
      audioChunksRef.current = [];
      audioLevelsRef.current = [];
      setRecordingDuration(0);
      recordingStartTimeRef.current = Date.now();
      forcedStopRef.current = false;
      setAudioLevels(Array(30).fill(0));
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      
      recordingTimerRef.current = setInterval(() => {
        const duration = Date.now() - recordingStartTimeRef.current;
        setRecordingDuration(duration);
        
        if (duration >= maxCallDuration * 1000) {
          console.log("Maximum recording duration reached, stopping recording");
          stopRecording();
        }
      }, 1000);
      
      // Inicializar detector de silêncio com as configurações otimizadas
      silenceDetector.initialize(
        stream, 
        () => {
          console.log("Silence detector triggered automatic stop");
          if (isRecording && !stoppingRecording && !processingAudioRef.current) {
            processingAudioRef.current = true;
            stopRecording(false);
          }
        }, 
        {
          silenceThreshold: SILENCE_THRESHOLD,
          minVoiceLevel: MIN_VOICE_LEVEL,
          silenceDuration: SILENCE_DURATION,
          minRecordingDuration: MIN_RECORDING_DURATION,
          consecutiveSilenceThreshold: CONSECUTIVE_SILENCE_THRESHOLD,
          continuousModeEnabled: continuousModeEnabled,
          debugMode: showDebugInfo
        },
        updateAudioLevels // Callback para atualizar os níveis de áudio
      );
      
      setIsRecording(true);
      
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm',
        audioBitsPerSecond: 128000
      });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const currentTime = Date.now();
        const recordingLength = currentTime - recordingStartTimeRef.current;
        
        console.log("MediaRecorder stopped, recording length:", recordingLength, "ms");
        
        if (audioChunksRef.current.length === 0) {
          console.log("No audio data captured");
          processingAudioRef.current = false;
          setStoppingRecording(false);
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log("Audio blob size:", audioBlob.size, "bytes", "type:", audioBlob.type);
        
        if (forcedStopRef.current) {
          console.log("Processing audio due to user forced stop");
          await processAudioBlob(audioBlob);
          forcedStopRef.current = false;
          return;
        }
        
        const voiceDetected = silenceDetector.hasVoiceBeenDetected();
        
        if (audioBlob.size < 1000 || !apiKey) {
          console.log("Audio too small or API key missing, ignoring");
          processingAudioRef.current = false;
          audioChunksRef.current = [];
          setStoppingRecording(false);
          return;
        }
        
        if (recordingLength < MIN_RECORDING_DURATION) {
          console.log("Recording too short, ignoring");
          processingAudioRef.current = false;
          audioChunksRef.current = [];
          setStoppingRecording(false);
          return;
        }
        
        if (voiceDetected) {
          console.log("Voice detected in recording, processing");
          await processAudioBlob(audioBlob);
        } else {
          console.log("No voice detected in recording, ignoring");
          toast.info("Não detectamos sua voz. Por favor, tente novamente falando mais alto.");
          processingAudioRef.current = false;
          audioChunksRef.current = [];
          setStoppingRecording(false);
        }
      };
      
      if (voiceDetectionTimerRef.current) {
        clearTimeout(voiceDetectionTimerRef.current);
      }
      
      voiceDetectionTimerRef.current = setTimeout(() => {
        if (isRecording && !silenceDetector.hasVoiceBeenDetected() && !stoppingRecording) {
          console.log("No voice detected after timeout, stopping recording");
          toast.info("Nenhuma voz detectada. Por favor, tente novamente falando mais alto.");
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            stopRecording();
          }
        }
      }, VOICE_DETECTION_TIMEOUT);
      
      mediaRecorder.start(250);
      console.log("Started recording with enhanced voice detection");
      
      try {
        const oscillator = audioContextRef.current?.createOscillator();
        const gainNode = audioContextRef.current?.createGain();
        
        if (oscillator && gainNode) {
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(440, audioContextRef.current?.currentTime || 0);
          gainNode.gain.setValueAtTime(0.1, audioContextRef.current?.currentTime || 0);
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContextRef.current?.destination || gainNode);
          
          oscillator.start();
          oscillator.stop(audioContextRef.current?.currentTime || 0 + 0.15);
        }
      } catch (e) {
        console.error("Error starting oscillator:", e);
      }
      
      toast.success("Gravação iniciada. Fale agora ou clique novamente para parar.");
      
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Erro ao acessar o microfone", {
        description: "Verifique as permissões do seu navegador."
      });
      setIsRecording(false);
    }
  };

  const stopRecording = (userInitiated = true) => {
    console.log("Stopping recording, user initiated:", userInitiated);
    
    if (userInitiated) {
      setStoppingRecording(true);
      forcedStopRef.current = true;
    }
    
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      console.log("MediaRecorder already inactive");
      setIsRecording(false);
      setStoppingRecording(false);
      return;
    }
    
    console.log("Stopping recording, state:", mediaRecorderRef.current.state);
    setIsRecording(false);
    
    silenceDetector.cleanup();
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    if (voiceDetectionTimerRef.current) {
      clearTimeout(voiceDetectionTimerRef.current);
      voiceDetectionTimerRef.current = null;
    }
    
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
    
    recordingTimeoutRef.current = setTimeout(() => {
      console.log("Safety timeout triggered to release resources");
      cleanupResources();
    }, 5000);
    
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
        console.log("MediaRecorder stop called");
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      setIsRecording(false);
      setStoppingRecording(false);
    }
  };

  const processAudioBlob = async (audioBlob: Blob) => {
    if (!apiKey || !currentConversationId) {
      console.log("Call is no longer active, ignoring audio");
      processingAudioRef.current = false;
      setStoppingRecording(false);
      return;
    }
    
    setIsProcessing(true);
    retryCountRef.current = 0;
    
    try {
      const audioURL = URL.createObjectURL(audioBlob);
      setAudioURL(audioURL);
      
      const transcription = await transcribeAudioWithRetry(audioBlob);
      console.log("Transcription received:", transcription);
      
      if (!transcription || transcription.trim() === "") {
        console.log("Empty transcription, ignoring");
        setIsProcessing(false);
        processingAudioRef.current = false;
        setStoppingRecording(false);
        
        toast.info("Não conseguimos entender o que você disse. Por favor, tente novamente.");
        
        return;
      }
      
      const userMessageId = addMessage(transcription, "user");
      console.log("User message added with ID:", userMessageId);
      
      const assistantMessageId = addMessage("...", "assistant");
      currentStreamingMessageId.current = assistantMessageId;
      
      currentResponseRef.current = "";
      
      const systemPrompt = agentConfig?.systemPrompt || "You are a helpful assistant.";
      
      const conversationMessages = messages.map(msg => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content
      }));
      
      conversationMessages.unshift({
        role: "system",
        content: systemPrompt
      });
      
      conversationMessages.push({
        role: "user",
        content: transcription
      });
      
      await streamOpenAI({
        messages: conversationMessages,
        model: agentConfig?.model || "gpt-4o-mini",
        temperature: agentConfig?.temperature || 0.7,
        trainingFiles: agentConfig?.trainingFiles || [],
        detectEmotion: agentConfig?.detectEmotion || false,
        stream: true
      }, apiKey, {
        onMessage: async (chunk) => {
          currentResponseRef.current += chunk;
          
          updateMessage(assistantMessageId, currentResponseRef.current);
          
          const shouldGenerateSpeech = (
            (chunk.includes('.') && currentResponseRef.current.length > waitAfterPunctuation * 100) ||
            (chunk.includes('!') && currentResponseRef.current.length > waitAfterPunctuation * 100) ||
            (chunk.includes('?') && currentResponseRef.current.length > waitAfterPunctuation * 100) ||
            (chunk.includes('\n\n') && currentResponseRef.current.length > waitWithoutPunctuation * 100) ||
            /\d+/.test(chunk) && currentResponseRef.current.length > waitAfterNumber * 100 ||
            (!/[.!?\n]/.test(chunk) && currentResponseRef.current.length > waitWithoutPunctuation * 100 && chunk.length > 20)
          );
          
          if (shouldGenerateSpeech) {
            try {
              console.log("Generating speech for sentence:", currentResponseRef.current);
              const speechAudioBuffer = await generateSpeech(
                currentResponseRef.current,
                selectedVoice,
                apiKey
              );
              
              const speechBlob = new Blob([speechAudioBuffer], { type: 'audio/mpeg' });
              const speechURL = URL.createObjectURL(speechBlob);
              
              await new Promise(resolve => setTimeout(resolve, waitBeforeSpeaking * 1000));
              
              playStreamingText(speechURL, currentResponseRef.current, false);
              
              currentResponseRef.current = "";
            } catch (speechError) {
              console.error("Error generating speech for chunk:", speechError);
            }
          }
        },
        onComplete: async (fullMessage) => {
          console.log("Complete response received:", fullMessage.substring(0, 50) + "...");
          
          updateMessage(assistantMessageId, fullMessage);
          
          if (agentConfig?.voice?.enabled && currentResponseRef.current) {
            try {
              const speechAudioBuffer = await generateSpeech(
                currentResponseRef.current,
                selectedVoice,
                apiKey
              );
              
              const speechBlob = new Blob([speechAudioBuffer], { type: 'audio/mpeg' });
              const speechURL = URL.createObjectURL(speechBlob);
              
              playStreamingText(speechURL, currentResponseRef.current, true);
            } catch (speechError) {
              console.error("Error generating speech for final chunk:", speechError);
            }
          }
          
          setIsProcessing(false);
          processingAudioRef.current = false;
          setStoppingRecording(false);
          currentStreamingMessageId.current = null;
          
          // Reinicia a gravação automaticamente após um breve intervalo
          if (continuousModeEnabled) {
            setTimeout(() => {
              if (!isRecording && !stoppingRecording && !isProcessing) {
                startRecording();
              }
            }, 1500);
          }
        },
        onError: (error) => {
          console.error("Error getting streaming response:", error);
          toast.error("Erro na resposta do assistente", {
            description: error instanceof Error ? error.message : "Ocorreu um erro inesperado"
          });
          setIsProcessing(false);
          processingAudioRef.current = false;
          setStoppingRecording(false);
          currentStreamingMessageId.current = null;
        }
      });
    } catch (error) {
      console.error("Error processing audio:", error);
      toast.error("Erro ao processar áudio", {
        description: error instanceof Error ? error.message : "Ocorreu um erro inesperado"
      });
      setIsProcessing(false);
      processingAudioRef.current = false;
      setStoppingRecording(false);
    }
  };

  const transcribeAudioWithRetry = async (audioBlob: Blob): Promise<string> => {
    try {
      return await transcribeAudio(audioBlob, apiKey);
    } catch (error) {
      retryCountRef.current += 1;
      if (retryCountRef.current <= MAX_RETRIES) {
        console.log(`Transcription attempt ${retryCountRef.current} failed, trying again...`);
        toast.warning(`Falha na transcrição, tentando novamente (${retryCountRef.current}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCountRef.current));
        return transcribeAudioWithRetry(audioBlob);
      } else {
        console.error("Maximum retry attempts exceeded");
        throw error;
      }
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const toggleRecording = () => {
    if (isRecording) {
      console.log("User toggled recording off");
      stopRecording(true);
    } else if (!stoppingRecording && !isProcessing) {
      console.log("User toggled recording on");
      startRecording();
    } else {
      console.log("Ignoring toggle request while stopping or processing");
    }
  };

  const saveVoiceSettings = (settings: any) => {
    const updatedVoiceConfig = {
      ...agentConfig.voice,
      ...settings,
      continuousMode: settings.continuousMode !== undefined ? settings.continuousMode : continuousModeEnabled
    };
    
    const updatedConfig = {
      ...agentConfig,
      voice: updatedVoiceConfig
    };
    
    updateAgentConfig(updatedConfig);
    toast.success("Configurações de voz salvas");
    setShowSettings(false);
    
    silenceDetector.setContinuousMode(updatedVoiceConfig.continuousMode);
  };

  const renderWaveform = () => {
    return (
      <div className="flex items-end justify-center h-12 my-2 gap-[2px]">
        {audioLevels.map((level, index) => {
          const animationClass = (isRecording || isPlaying) ? 'transition-all duration-50' : '';
          
          let height;
          if (isPlaying) {
            height = Math.max(4, Math.round((audioData[index] || 0) * 60));
          } else if (isRecording) {
            height = Math.max(4, Math.round(level * 60));
          } else {
            height = 4;
          }
          
          const baseColor = 'rgb(var(--primary))';
          const activeColor = isPlaying ? 
            'rgb(59, 130, 246)' : 
            'rgb(22, 163, 74)';
          
          const color = (isRecording || isPlaying) ? 
            (level > 0.05 ? activeColor : baseColor) : 
            baseColor;
            
          return (
            <div
              key={index}
              className={`w-1 rounded-t ${animationClass}`}
              style={{
                height: `${height}px`,
                opacity: level > 0.05 ? 0.7 + level * 0.3 : 0.4,
                backgroundColor: color,
                transform: `scaleY(${isRecording || isPlaying ? 1 + level * 0.7 : 1})`,
              }}
            ></div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-2">
          <Button
            onClick={toggleRecording}
            variant={isRecording ? "destructive" : "default"}
            className={`rounded-full w-12 h-12 p-0 ${isRecording ? 'animate-pulse' : ''}`}
            disabled={isProcessing || stoppingRecording || isMicrophoneAvailable === false}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? (
              <StopCircle className="h-6 w-6" />
            ) : isProcessing || stoppingRecording ? (
              <RefreshCw className="h-6 w-6 animate-spin" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
          
          {isRecording && (
            <span className="text-xs text-red-500 animate-pulse">
              {formatTime(recordingDuration)}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <VoiceControls 
            volume={volume} 
            setVolume={setVolume}
            playbackRate={playbackRate}
            setPlaybackRate={setPlaybackRate}
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            voices={VOICES}
          />
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowSettings(!showSettings)}
            className="text-xs"
          >
            Configurações
          </Button>
        </div>
      </div>
      
      <div className="bg-background/60 rounded-md p-2 border border-border">
        <div className="flex items-center gap-2 mb-1">
          <AudioWaveform 
            className={`h-4 w-4 ${isRecording ? 'text-red-500' : isPlaying ? 'text-blue-500' : 'text-muted-foreground'}`} 
          />
          <span className="text-xs text-muted-foreground">
            {isRecording ? "Gravando..." : isPlaying ? "Reproduzindo..." : "Níveis de áudio"}
          </span>
          {isRecording && audioLevel > 0 && (
            <span className="text-xs text-green-500 ml-auto">
              {audioLevel.toFixed(0)}%
            </span>
          )}
        </div>
        {renderWaveform()}
        
        {showDebugInfo && isRecording && (
          <div className="mt-2 text-xs text-muted-foreground">
            <p>Voz detectada: {silenceDetector.hasVoiceBeenDetected() ? 'Sim' : 'Não'}</p>
            <p>Contagem de silêncio: {silenceDetector.getConsecutiveSilenceCount()}/{CONSECUTIVE_SILENCE_THRESHOLD}</p>
            <p>Nível de áudio: {audioLevel.toFixed(1)}%</p>
          </div>
        )}
      </div>
      
      {showSettings && (
        <VoiceSettings 
          settings={{
            silenceTimeout,
            maxCallDuration,
            waitBeforeSpeaking,
            waitAfterPunctuation,
            waitWithoutPunctuation,
            waitAfterNumber,
            endCallMessage,
            continuousMode: continuousModeEnabled
          }}
          onSave={saveVoiceSettings}
          onCancel={() => setShowSettings(false)}
        />
      )}
      
      {isRecording && (
        <div className="text-center text-sm text-muted-foreground animate-pulse">
          Gravando... Clique no botão para parar ou aguarde silêncio
        </div>
      )}
      
      {isProcessing && (
        <div className="text-center text-sm text-muted-foreground">
          Processando áudio...
        </div>
      )}
      
      {stoppingRecording && (
        <div className="text-center text-sm text-muted-foreground">
          Finalizando gravação...
        </div>
      )}
      
      {!isRecording && !isProcessing && !stoppingRecording && isMicrophoneAvailable === false && (
        <div className="text-center text-sm text-red-500">
          Seu navegador não suporta acesso ao microfone ou o acesso foi negado.
          Por favor, use um navegador moderno como Chrome, Firefox ou Edge.
        </div>
      )}
      
      {!isRecording && !isProcessing && !stoppingRecording && isMicrophoneAvailable !== false && (
        <div className="text-center text-sm text-muted-foreground">
          Clique no botão do microfone para iniciar a conversa por voz
        </div>
      )}
      
      {audioURL && (
        <audio ref={audioRef} className="hidden" />
      )}
    </div>
  );
};

export default VoiceChatAgent;

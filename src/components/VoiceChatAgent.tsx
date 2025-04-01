import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Mic, StopCircle, RefreshCw } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { 
  transcribeAudio, 
  generateSpeech, 
  streamOpenAI
} from "@/utils/openai";
import { VoiceControls } from "./voice-chat/VoiceControls";
import { useSpeechPlayer } from "@/hooks/useSpeechPlayer";
import { VoiceSettings } from "./voice-chat/VoiceSettings";

const VOICES = [
  { id: 'alloy', name: 'Alloy (Neutro)' },
  { id: 'echo', name: 'Echo (Masculino)' },
  { id: 'fable', name: 'Fable (Feminino)' },
  { id: 'onyx', name: 'Onyx (Masculino Grave)' },
  { id: 'nova', name: 'Nova (Feminino Suave)' },
  { id: 'shimmer', name: 'Shimmer (Feminino Jovem)' }
];

const SILENCE_THRESHOLD = 5; // Volume below which is considered silence
const MIN_VOICE_LEVEL = 15; // Minimum level to consider as voice
const MIN_RECORDING_DURATION = 500; // Minimum recording duration to avoid processing very short noises
const VOICE_DETECTION_TIMEOUT = 5000; // Time to wait for voice detection before stopping (5 seconds)

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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const processingAudioRef = useRef<boolean>(false);
  const lastProcessTimeRef = useRef<number>(0);
  const currentResponseRef = useRef<string>("");
  const currentStreamingMessageId = useRef<string | null>(null);
  const retryCountRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const silenceStartRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceDetectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const voiceDetectedRef = useRef<boolean>(false);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const MAX_RETRIES = 3;
  
  const { 
    addMessage, 
    updateMessage,
    agentConfig,
    messages,
    currentConversationId,
    updateAgentConfig
  } = useChat();

  const silenceTimeout = agentConfig?.voice?.silenceTimeout || 10;
  const maxCallDuration = agentConfig?.voice?.maxCallDuration || 1800;
  const waitBeforeSpeaking = agentConfig?.voice?.waitBeforeSpeaking || 0.4;
  const waitAfterPunctuation = agentConfig?.voice?.waitAfterPunctuation || 0.1;
  const waitWithoutPunctuation = agentConfig?.voice?.waitWithoutPunctuation || 1.5;
  const waitAfterNumber = agentConfig?.voice?.waitAfterNumber || 0.5;
  const endCallMessage = agentConfig?.voice?.endCallMessage || "Encerrando chamada por inatividade. Obrigado pela conversa.";

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
    stopAudio
  } = useSpeechPlayer(agentConfig?.voice?.voiceId || 'alloy');

  const cleanupResources = () => {
    console.log("Cleaning up voice chat resources");
    
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
    
    console.log("Voice chat resources cleanup completed");
  };

  useEffect(() => {
    console.log("VoiceChatAgent: API key present:", !!apiKey);
    
    return cleanupResources;
  }, [apiKey]);

  const startRecording = async () => {
    if (stoppingRecording || isProcessing) {
      console.log("Cannot start recording while stopping or processing");
      return;
    }
    
    cleanupResources();
    
    try {
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      console.log("Microphone access granted");
      
      audioChunksRef.current = [];
      setRecordingDuration(0);
      recordingStartTimeRef.current = Date.now();
      silenceStartRef.current = Date.now();
      voiceDetectedRef.current = false;
      
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
      
      setupAudioAnalysis(stream);
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        if (!stoppingRecording) {
          const currentTime = Date.now();
          const recordingLength = currentTime - recordingStartTimeRef.current;
          
          console.log("MediaRecorder stopped, recording length:", recordingLength, "ms");
          
          if (audioChunksRef.current.length === 0) {
            console.log("No audio data captured");
            processingAudioRef.current = false;
            return;
          }
          
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log("Audio blob size:", audioBlob.size, "bytes", "type:", audioBlob.type);
          
          if (audioBlob.size < 1000 || !apiKey || recordingLength < MIN_RECORDING_DURATION) {
            console.log("Audio too small or API key missing, ignoring");
            processingAudioRef.current = false;
            audioChunksRef.current = [];
            
            setTimeout(() => {
              if (!isRecording && !isProcessing && !stoppingRecording) {
                startRecording();
              }
            }, 1000);
            
            return;
          }
          
          if (!voiceDetectedRef.current) {
            console.log("No voice detected in recording, ignoring");
            toast.info("Não detectamos sua voz. Por favor, tente novamente falando mais alto.");
            processingAudioRef.current = false;
            audioChunksRef.current = [];
            
            setTimeout(() => {
              if (!isRecording && !isProcessing && !stoppingRecording) {
                startRecording();
              }
            }, 1000);
            
            return;
          }
          
          await processAudioBlob(audioBlob);
        } else {
          console.log("MediaRecorder stopped while in stopping state, not processing audio");
          processingAudioRef.current = false;
          setStoppingRecording(false);
        }
        
        audioChunksRef.current = [];
      };
      
      if (voiceDetectionTimerRef.current) {
        clearTimeout(voiceDetectionTimerRef.current);
      }
      
      voiceDetectionTimerRef.current = setTimeout(() => {
        if (isRecording && !voiceDetectedRef.current && !stoppingRecording) {
          console.log("No voice detected after timeout, restarting recording");
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            stopRecording();
            
            setTimeout(() => {
              if (!isRecording && !isProcessing && !stoppingRecording) {
                startRecording();
              }
            }, 1000);
          }
        }
      }, VOICE_DETECTION_TIMEOUT);
      
      mediaRecorder.start(1000);
      setIsRecording(true);
      console.log("Started recording with voice detection");
      
      toast.info("Gravação iniciada. Fale agora ou clique novamente para parar.");
      
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Error accessing microphone", {
        description: "Please check your browser permissions."
      });
      setIsRecording(false);
    }
  };

  const setupAudioAnalysis = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);
      
      startSilenceDetection();
      
    } catch (error) {
      console.error("Error setting up audio analysis:", error);
    }
  };

  const startSilenceDetection = () => {
    if (!analyserRef.current) return;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkAudioLevel = () => {
      if (!isRecording || !analyserRef.current) return;
      
      analyser.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      
      const currentTime = Date.now();
      
      if (average > MIN_VOICE_LEVEL) {
        voiceDetectedRef.current = true;
        
        if (voiceDetectionTimerRef.current) {
          clearTimeout(voiceDetectionTimerRef.current);
          voiceDetectionTimerRef.current = null;
        }
      }
      
      if (average < SILENCE_THRESHOLD) {
        const elapsedSilence = currentTime - silenceStartRef.current;
        
        if (elapsedSilence > SILENCE_DURATION && !processingAudioRef.current && voiceDetectedRef.current && !stoppingRecording) {
          const recordingLength = currentTime - recordingStartTimeRef.current;
          
          if (recordingLength > MIN_RECORDING_DURATION) {
            console.log(`Conversational pause detected after ${elapsedSilence}ms of silence`);
            processingAudioRef.current = true;
            
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
              stopRecording(false);
            }
          }
        }
      } else {
        silenceStartRef.current = currentTime;
      }
      
      if (isRecording) {
        requestAnimationFrame(checkAudioLevel);
      }
    };
    
    checkAudioLevel();
  };

  const stopRecording = (userInitiated = true) => {
    console.log("Stopping recording, user initiated:", userInitiated);
    
    if (userInitiated) {
      setStoppingRecording(true);
      processingAudioRef.current = false;
    }
    
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      console.log("MediaRecorder already inactive");
      setIsRecording(false);
      setStoppingRecording(false);
      return;
    }
    
    console.log("Stopping recording, state:", mediaRecorderRef.current.state);
    setIsRecording(false);
    
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
      
      if (userInitiated) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
          analyserRef.current = null;
        }
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
          currentStreamingMessageId.current = null;
        },
        onError: (error) => {
          console.error("Error getting streaming response:", error);
          toast.error("Error getting assistant response", {
            description: error instanceof Error ? error.message : "An unknown error occurred"
          });
          setIsProcessing(false);
          processingAudioRef.current = false;
          currentStreamingMessageId.current = null;
        }
      });
    } catch (error) {
      console.error("Error processing audio:", error);
      toast.error("Error processing audio", {
        description: error instanceof Error ? error.message : "An unknown error occurred"
      });
      setIsProcessing(false);
      processingAudioRef.current = false;
    }
  };

  const transcribeAudioWithRetry = async (audioBlob: Blob): Promise<string> => {
    try {
      return await transcribeAudio(audioBlob, apiKey);
    } catch (error) {
      retryCountRef.current += 1;
      if (retryCountRef.current <= MAX_RETRIES) {
        console.log(`Transcription attempt ${retryCountRef.current} failed, trying again...`);
        toast.warning(`Transcription attempt failed, trying again (${retryCountRef.current}/${MAX_RETRIES})...`);
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
      ...settings
    };
    
    const updatedConfig = {
      ...agentConfig,
      voice: updatedVoiceConfig
    };
    
    updateAgentConfig(updatedConfig);
    toast.success("Configurações de voz salvas");
    setShowSettings(false);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-2">
          <Button
            onClick={toggleRecording}
            variant={isRecording ? "destructive" : "default"}
            className={`rounded-full w-12 h-12 p-0 ${isRecording ? 'animate-pulse' : ''}`}
            disabled={isProcessing || stoppingRecording}
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
      
      {showSettings && (
        <VoiceSettings 
          settings={{
            silenceTimeout,
            maxCallDuration,
            waitBeforeSpeaking,
            waitAfterPunctuation,
            waitWithoutPunctuation,
            waitAfterNumber,
            endCallMessage
          }}
          onSave={saveVoiceSettings}
          onCancel={() => setShowSettings(false)}
        />
      )}
      
      {isRecording && (
        <div className="text-center text-sm text-muted-foreground animate-pulse">
          Gravando... Clique no botão para parar
        </div>
      )}
      
      {isProcessing && (
        <div className="text-center text-sm text-muted-foreground">
          Processando áudio...
        </div>
      )}
      
      {stoppingRecording && (
        <div className="text-center text-sm text-muted-foreground">
          Parando gravação...
        </div>
      )}
      
      {!isRecording && !isProcessing && !stoppingRecording && (
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

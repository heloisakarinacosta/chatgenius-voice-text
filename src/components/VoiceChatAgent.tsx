
import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Mic, StopCircle, RefreshCw, VolumeX, Volume1, Volume2, Clock } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { 
  transcribeAudio, 
  generateSpeech, 
  streamOpenAI,
  callOpenAI
} from "@/utils/openai";
import { VoiceControls } from "./voice-chat/VoiceControls";
import { useSpeechPlayer } from "@/hooks/useSpeechPlayer";

const VOICES = [
  { id: 'alloy', name: 'Alloy (Neutro)' },
  { id: 'echo', name: 'Echo (Masculino)' },
  { id: 'fable', name: 'Fable (Feminino)' },
  { id: 'onyx', name: 'Onyx (Masculino Grave)' },
  { id: 'nova', name: 'Nova (Feminino Suave)' },
  { id: 'shimmer', name: 'Shimmer (Feminino Jovem)' }
];

// Silence detection settings
const SILENCE_THRESHOLD = 10; // Volume below which is considered silence
const SILENCE_DURATION = 1500; // 1.5 seconds of silence to consider a conversational pause
const MIN_RECORDING_DURATION = 500; // Minimum recording duration to avoid processing very short noises
const MAX_RECORDING_DURATION = 20000; // Maximum recording duration (20 seconds)

interface VoiceChatAgentProps {
  apiKey: string;
}

const VoiceChatAgent: React.FC<VoiceChatAgentProps> = ({ apiKey }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
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
  
  const MAX_RETRIES = 3;
  
  const { 
    addMessage, 
    updateMessage,
    agentConfig,
    messages,
    currentConversationId
  } = useChat();

  // Use our custom hook for speech playback
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

  useEffect(() => {
    console.log("VoiceChatAgent: API key present:", !!apiKey);
    
    // Cleanup function
    return () => {
      stopRecording();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
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
      
      // Reset recording state
      audioChunksRef.current = [];
      setRecordingDuration(0);
      recordingStartTimeRef.current = Date.now();
      silenceStartRef.current = Date.now(); // Initialize silence timer
      
      // Set up audio context for analyzing audio levels
      setupAudioAnalysis(stream);
      
      // Create and setup media recorder
      const mediaRecorder = new MediaRecorder(stream);
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
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log("Audio blob size:", audioBlob.size, "bytes");
        
        // Skip processing if recording is too short or API key is missing
        if (audioBlob.size < 1000 || !apiKey || recordingLength < MIN_RECORDING_DURATION) {
          console.log("Audio too small or API key missing, ignoring");
          processingAudioRef.current = false;
          // Clean up for next recording
          audioChunksRef.current = [];
          return;
        }
        
        // Process the recorded audio
        processAudioBlob(audioBlob);
        
        // Clean up for next recording
        audioChunksRef.current = [];
      };
      
      // Start the recording timer
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartTimeRef.current;
        setRecordingDuration(elapsed);
        
        // Stop if recording exceeds maximum duration
        if (elapsed >= MAX_RECORDING_DURATION) {
          console.log("Max recording duration reached, stopping");
          stopRecording();
        }
      }, 100);
      
      // Start recording
      mediaRecorder.start(1000); // Get data every second
      setIsRecording(true);
      console.log("Started recording with silence detection");
      
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Error accessing microphone", {
        description: "Please check your browser permissions."
      });
    }
  };

  const setupAudioAnalysis = (stream: MediaStream) => {
    try {
      // Create audio context and analyzer
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      // Configure analyzer
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);
      
      // Start analyzing audio for silence detection
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
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      
      const currentTime = Date.now();
      
      // Silence detection
      if (average < SILENCE_THRESHOLD) {
        const elapsedSilence = currentTime - silenceStartRef.current;
        
        // If silence duration is reached and we're not already processing audio
        if (elapsedSilence > SILENCE_DURATION && !processingAudioRef.current) {
          // Avoid processing very short recordings
          const recordingLength = currentTime - recordingStartTimeRef.current;
          
          if (recordingLength > MIN_RECORDING_DURATION) {
            console.log(`Conversational pause detected after ${elapsedSilence}ms of silence`);
            processingAudioRef.current = true;
            
            // Stop the current recording to process the audio
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
              stopRecording();
            }
          }
        }
      } else {
        // Reset silence timer when sound is detected
        silenceStartRef.current = currentTime;
      }
      
      // Continue checking audio levels
      if (isRecording) {
        requestAnimationFrame(checkAudioLevel);
      }
    };
    
    // Start the audio level checking loop
    checkAudioLevel();
  };
  
  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    
    console.log("Stopping recording, state:", mediaRecorderRef.current.state);
    setIsRecording(false);
    
    // Clear recording timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    try {
      // Stop media recorder
      mediaRecorderRef.current.stop();
      
      // Stop all tracks from the stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
        analyserRef.current = null;
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
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
      // Create an object URL for the audio blob for preview
      const audioURL = URL.createObjectURL(audioBlob);
      setAudioURL(audioURL);
      
      // Transcribe audio using OpenAI Whisper
      console.log("Sending audio for transcription...");
      const transcription = await transcribeAudioWithRetry(audioBlob);
      console.log("Transcription received:", transcription);
      
      if (!transcription || transcription.trim() === "") {
        console.log("Empty transcription, ignoring");
        setIsProcessing(false);
        processingAudioRef.current = false;
        return;
      }
      
      // Add the user's transcribed message to the chat
      const userMessageId = addMessage(transcription, "user");
      console.log("User message added with ID:", userMessageId);
      
      // Add a temporary assistant message that will be updated
      const assistantMessageId = addMessage("...", "assistant");
      currentStreamingMessageId.current = assistantMessageId;
      
      // Reset accumulated response
      currentResponseRef.current = "";
      
      // Process the message with OpenAI using streaming
      const systemPrompt = agentConfig?.systemPrompt || "You are a helpful assistant.";
      
      // Collect all messages for context
      const conversationMessages = messages.map(msg => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content
      }));
      
      // Add system prompt from configuration
      conversationMessages.unshift({
        role: "system",
        content: systemPrompt
      });
      
      // Add the new user message (may not be in messages array yet)
      conversationMessages.push({
        role: "user",
        content: transcription
      });
      
      // Get streaming response from OpenAI
      await streamOpenAI({
        messages: conversationMessages,
        model: agentConfig?.model || "gpt-4o-mini",
        temperature: agentConfig?.temperature || 0.7,
        trainingFiles: agentConfig?.trainingFiles || [],
        detectEmotion: agentConfig?.detectEmotion || false,
        stream: true
      }, apiKey, {
        onMessage: async (chunk) => {
          // Accumulate response
          currentResponseRef.current += chunk;
          
          // Update message in real-time
          updateMessage(assistantMessageId, currentResponseRef.current);
          
          // Start generating audio when we have a complete sentence or significant pause
          if (
            // Detect sentence endings or significant pauses
            (chunk.includes('.') || chunk.includes('!') || chunk.includes('?') || 
             chunk.includes('\n\n') || chunk.includes('. ')) && 
            // Ensure we have enough content to start voice synthesis
            currentResponseRef.current.length > 20 &&
            // Don't generate speech for very small chunks
            chunk.length > 5
          ) {
            try {
              console.log("Generating speech for sentence:", currentResponseRef.current);
              const speechAudioBuffer = await generateSpeech(
                currentResponseRef.current,
                selectedVoice,
                apiKey
              );
              
              const speechBlob = new Blob([speechAudioBuffer], { type: 'audio/mpeg' });
              const speechURL = URL.createObjectURL(speechBlob);
              
              // Play the synthesized speech, passing the text for deduplication
              playStreamingText(speechURL, currentResponseRef.current, false);
              
              // Reset the accumulated response for the next sentence
              currentResponseRef.current = "";
            } catch (speechError) {
              console.error("Error generating speech for chunk:", speechError);
            }
          }
        },
        onComplete: async (fullMessage) => {
          console.log("Complete response received:", fullMessage.substring(0, 50) + "...");
          
          // Update message with complete response
          updateMessage(assistantMessageId, fullMessage);
          
          // Generate audio for any remaining text
          if (agentConfig?.voice?.enabled && currentResponseRef.current) {
            try {
              const speechAudioBuffer = await generateSpeech(
                currentResponseRef.current,
                selectedVoice,
                apiKey
              );
              
              const speechBlob = new Blob([speechAudioBuffer], { type: 'audio/mpeg' });
              const speechURL = URL.createObjectURL(speechBlob);
              
              // Play the final part of the response
              playStreamingText(speechURL, currentResponseRef.current, true);
            } catch (speechError) {
              console.error("Error generating speech for final chunk:", speechError);
            }
          }
          
          setIsProcessing(false);
          processingAudioRef.current = false;
          currentStreamingMessageId.current = null;
          
          // Automatically start listening again after a brief delay
          setTimeout(() => {
            if (!isRecording && !isPlaying) {
              startRecording();
            }
          }, 2000);
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
        // Wait a short period before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCountRef.current));
        return transcribeAudioWithRetry(audioBlob);
      } else {
        console.error("Maximum retry attempts exceeded");
        throw error;
      }
    }
  };

  // Format time in MM:SS format
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-2">
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            variant={isRecording ? "destructive" : "default"}
            className={`rounded-full w-12 h-12 p-0 ${isRecording ? 'animate-pulse' : ''}`}
            disabled={isProcessing}
          >
            {isRecording ? (
              <StopCircle className="h-6 w-6" />
            ) : isProcessing ? (
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
        
        <VoiceControls 
          volume={volume} 
          setVolume={setVolume}
          playbackRate={playbackRate}
          setPlaybackRate={setPlaybackRate}
          selectedVoice={selectedVoice}
          setSelectedVoice={setSelectedVoice}
          voices={VOICES}
        />
      </div>
      
      {isRecording && (
        <div className="text-center text-sm text-muted-foreground animate-pulse">
          Listening... (Speak naturally with pauses for response)
        </div>
      )}
      
      {isProcessing && (
        <div className="text-center text-sm text-muted-foreground">
          Processing audio...
        </div>
      )}
      
      {audioURL && (
        <audio ref={audioRef} className="hidden" />
      )}
    </div>
  );
};

export default VoiceChatAgent;

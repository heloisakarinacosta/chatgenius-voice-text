
import React, { useState, useRef, useEffect } from "react";
import { Mic, PhoneOff, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { transcribeAudio, OpenAIMessage, streamOpenAI, generateSpeech } from "@/utils/openai";

interface VoiceChatAgentProps {
  apiKey: string;
}

const VoiceChatAgent: React.FC<VoiceChatAgentProps> = ({ apiKey }) => {
  const { agentConfig, messages, addMessage, updateMessage } = useChat();
  const [isCallActive, setIsCallActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [inputValue, setInputValue] = useState("");
  
  // Refs for audio handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Configuration for voice conversation
  const silenceThresholdMs = 2000; // Time of silence before sending (2 seconds)
  const interruptionThresholdMs = 300; // How quickly agent should stop when interrupted (0.3 seconds)

  // Cleanup audio resources
  const cleanupAudioResources = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioRef.current) {
      if (audioRef.current.src) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.src = "";
      }
    }

    // Clean up audio context resources
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    // Reset recording state
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  // Set up audio element for playback on mount
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      
      audioRef.current.onplay = () => {
        setIsSpeaking(true);
      };
      
      audioRef.current.onended = () => {
        setIsSpeaking(false);
        if (audioRef.current && audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
          audioRef.current.src = "";
        }
        
        // When agent finishes speaking, automatically start listening again if call is active
        if (isCallActive && !isProcessing) {
          startStreamingRecording();
        }
      };
      
      audioRef.current.onerror = (e) => {
        console.error("Audio playback error:", e);
        setIsSpeaking(false);
        toast.error("Erro ao reproduzir áudio");
        
        // If there's an error, still try to continue the conversation
        if (isCallActive && !isProcessing) {
          startStreamingRecording();
        }
      };
    }
    
    return () => {
      stopRecording();
      cleanupAudioResources();
    };
  }, []);

  // Initialize streaming voice call
  const startVoiceCall = async () => {
    try {
      setIsCallActive(true);
      addMessage("Olá! Estou ouvindo. Como posso ajudar?", "assistant");
      
      // Small delay to ensure UI updates before starting the microphone
      setTimeout(() => {
        startStreamingRecording();
      }, 500);
    } catch (error) {
      console.error("Error starting voice call:", error);
      toast.error("Não foi possível iniciar a chamada de voz");
      setIsCallActive(false);
    }
  };

  // End the voice call
  const endVoiceCall = () => {
    setIsCallActive(false);
    stopRecording();
    cleanupAudioResources();
    
    // If agent is currently speaking, stop it
    if (isSpeaking && audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.src = "";
      }
      setIsSpeaking(false);
    }
    
    addMessage("Conversa de voz encerrada.", "assistant");
  };

  // Start recording with automatic silence detection
  const startStreamingRecording = async () => {
    if (isRecording || isSpeaking || isProcessing) {
      console.log("Cannot start recording: already recording, speaking, or processing");
      return;
    }
    
    try {
      // Clean up any existing resources first
      cleanupAudioResources();
      
      // Reset audio chunks
      audioChunksRef.current = [];
      
      // Get media stream
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log("Microphone access granted");
      streamRef.current = stream;
      
      // Create media recorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        console.log("MediaRecorder stopped, processing audio chunks");
        if (audioChunksRef.current.length === 0) return;
        
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        
        // Only process if the blob is larger than 1KB (to avoid empty recordings)
        if (audioBlob.size > 1024) {
          processAudioInput(audioBlob);
        } else {
          console.log("Audio blob too small, ignoring");
          // If call is still active, start listening again
          if (isCallActive && !isSpeaking && !isProcessing) {
            startStreamingRecording();
          }
        }
      };
      
      // Set up audio analyzer for silence detection
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const microphone = audioContextRef.current.createMediaStreamSource(stream);
      scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      
      analyserRef.current.smoothingTimeConstant = 0.8;
      analyserRef.current.fftSize = 1024;
      
      microphone.connect(analyserRef.current);
      analyserRef.current.connect(scriptProcessorRef.current);
      scriptProcessorRef.current.connect(audioContextRef.current.destination);
      
      let silenceStart = Date.now();
      let isSilent = true;
      let hasTalked = false;
      let volumeData: Uint8Array;
      
      scriptProcessorRef.current.onaudioprocess = () => {
        if (!analyserRef.current || !isCallActive) return;
        
        volumeData = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(volumeData);
        
        // Calculate volume
        const arraySum = volumeData.reduce((acc, value) => acc + value, 0);
        const average = arraySum / volumeData.length;
        
        // Debug log volume level occasionally
        if (Math.random() < 0.01) { // Log roughly 1% of the time
          console.log("Current audio level:", average);
        }
        
        // Check if user is speaking (adjust threshold as needed)
        if (average > 20) { // Increased threshold for better detection
          hasTalked = true;
          isSilent = false;
          silenceStart = Date.now();
          
          // If agent is speaking, stop it when user interrupts
          if (isSpeaking && audioRef.current) {
            console.log("User interrupted agent");
            audioRef.current.pause();
            if (audioRef.current.src) {
              URL.revokeObjectURL(audioRef.current.src);
              audioRef.current.src = "";
            }
            setIsSpeaking(false);
            
            // Small delay before starting to record again
            setTimeout(() => {
              if (isCallActive && !isRecording) {
                startStreamingRecording();
              }
            }, 300);
          }
        } else if (!isSilent && hasTalked && Date.now() - silenceStart > silenceThresholdMs) {
          // User has been silent for the threshold duration after speaking
          console.log(`Silence detected for ${silenceThresholdMs}ms, stopping recording to process speech`);
          isSilent = true;
          
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            stopRecording();
          }
        }
      };
      
      // Start recording
      mediaRecorderRef.current.start();
      setIsRecording(true);
      console.log("Started streaming recording with silence detection");
      
    } catch (error) {
      console.error("Error starting streaming recording:", error);
      toast.error("Não foi possível acessar o microfone", {
        description: "Verifique se você concedeu permissão para usar o microfone."
      });
      setIsCallActive(false);
      setIsRecording(false);
    }
  };

  // Stop the current recording
  const stopRecording = () => {
    console.log("Stopping recording, state:", mediaRecorderRef.current?.state);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      setIsRecording(false);
    }
  };

  // Process the recorded audio
  const processAudioInput = async (audioBlob: Blob) => {
    if (!apiKey || !isCallActive) {
      console.log("Cannot process audio: no API key or call not active");
      return;
    }
    
    console.log("Processing audio input, blob size:", audioBlob.size);
    setIsProcessing(true);
    
    try {
      // Transcribe the audio
      console.log("Transcribing audio...");
      const transcript = await transcribeAudio(audioBlob, apiKey);
      console.log("Transcription result:", transcript);
      
      if (!transcript || transcript.trim() === "") {
        console.log("No transcript detected, continuing to listen");
        if (isCallActive && !isSpeaking) {
          startStreamingRecording();
        }
        setIsProcessing(false);
        return;
      }
      
      // Add the user's message to the conversation
      addMessage(transcript, "user");
      
      // Process the response
      await processResponse(transcript);
    } catch (error) {
      console.error("Error processing audio:", error);
      
      if (isCallActive) {
        toast.error("Erro ao processar áudio", {
          description: "Tente novamente."
        });
        
        // Continue listening even after an error
        if (!isSpeaking) {
          startStreamingRecording();
        }
      }
      
      setIsProcessing(false);
    }
  };

  // Generate and handle the agent's response
  const processResponse = async (userMessage: string) => {
    if (!isCallActive) return;
    console.log("Processing response for user message:", userMessage);
    
    const conversationHistory: OpenAIMessage[] = [
      { role: "system", content: agentConfig.systemPrompt },
      ...messages.map(msg => ({ 
        role: msg.role as "user" | "assistant" | "system", 
        content: msg.content 
      })),
      { role: "user", content: userMessage },
    ];
    
    let assistantMessage = "";
    
    try {
      // Add space for the assistant's response
      const assistantId = addMessage("", "assistant");
      console.log("Created assistant message with ID:", assistantId);
      
      // Configure streaming options
      const streamOptions: any = {
        messages: conversationHistory,
        model: agentConfig.model,
        temperature: agentConfig.temperature,
        max_tokens: agentConfig.maxTokens,
        stream: true,
        trainingFiles: agentConfig.trainingFiles,
        detectEmotion: agentConfig.detectEmotion
      };
      
      // Add functions if available
      if (agentConfig.functions && agentConfig.functions.length > 0) {
        streamOptions.functions = agentConfig.functions.map(fn => ({
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters,
        }));
      }
      
      console.log("Starting OpenAI stream with options:", {
        model: streamOptions.model,
        temperature: streamOptions.temperature,
        max_tokens: streamOptions.maxTokens,
        functions: streamOptions.functions ? streamOptions.functions.length : 0
      });
      
      // Start streaming the response
      await streamOpenAI(
        streamOptions,
        apiKey,
        {
          onMessage: (chunk) => {
            assistantMessage += chunk;
            
            // Update the message in the conversation
            if (assistantId && updateMessage) {
              updateMessage(assistantId, assistantMessage);
            }
          },
          onComplete: async (fullMessage) => {
            console.log("OpenAI stream complete, generating speech for:", fullMessage.substring(0, 50) + "...");
            // Generate audio for the response
            try {
              if (!isCallActive) return;
              
              const audioBuffer = await generateSpeech(
                fullMessage,
                agentConfig.voice.voiceId,
                apiKey
              );
              
              console.log("Speech generated successfully, buffer size:", audioBuffer.byteLength);
              
              // Play the audio
              const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
              const audioUrl = URL.createObjectURL(audioBlob);
              
              if (audioRef.current && isCallActive) {
                if (audioRef.current.src) {
                  URL.revokeObjectURL(audioRef.current.src);
                }
                
                audioRef.current.src = audioUrl;
                audioRef.current.play().catch(error => {
                  console.error("Erro ao reproduzir áudio:", error);
                  // If audio fails to play, still continue the conversation
                  if (isCallActive && !isRecording) {
                    startStreamingRecording();
                  }
                });
              }
            } catch (error) {
              console.error("Erro ao gerar fala:", error);
              toast.error("Não foi possível gerar a fala");
              
              // If we can't generate speech, continue listening
              if (isCallActive && !isRecording) {
                startStreamingRecording();
              }
            }
            
            setIsProcessing(false);
          },
          onError: (error) => {
            console.error("Erro na resposta da IA:", error);
            if (addMessage) {
              updateMessage(assistantId, "Desculpe, ocorreu um erro ao processar sua solicitação.");
            }
            
            setIsProcessing(false);
            
            // Continue listening even after an error
            if (isCallActive && !isRecording && !isSpeaking) {
              startStreamingRecording();
            }
            
            toast.error("Erro ao obter resposta", {
              description: error instanceof Error ? error.message : "Tente novamente."
            });
          },
        }
      );
    } catch (error) {
      console.error("Error getting response:", error);
      setIsProcessing(false);
      
      // Continue listening even after an error
      if (isCallActive && !isRecording && !isSpeaking) {
        startStreamingRecording();
      }
      
      toast.error("Erro ao processar resposta", {
        description: "Não foi possível obter uma resposta do assistente."
      });
    }
  };

  // Check if voice is enabled
  if (!agentConfig.voice.enabled) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          A funcionalidade de voz está desativada. Ative-a nas configurações do agente.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {isSpeaking && (
        <div className="flex justify-center mb-2">
          <div className="bg-primary/10 text-primary text-xs px-3 py-1 rounded-full flex items-center gap-1 animate-pulse">
            <Volume2 className="h-3 w-3" />
            <span>Falando...</span>
          </div>
        </div>
      )}
      
      {isRecording && (
        <div className="flex justify-center mb-2">
          <div className="bg-red-500/20 text-red-500 text-xs px-3 py-1 rounded-full flex items-center gap-1 animate-pulse">
            <Mic className="h-3 w-3" />
            <span>Ouvindo...</span>
          </div>
        </div>
      )}
      
      <div className="flex flex-col items-center gap-3">
        {isCallActive ? (
          <>
            <div className="text-sm text-center mb-2">
              <p className="text-muted-foreground">Conversa em andamento</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isRecording ? "Fale normalmente. Faça pausas para que o assistente responda." : 
                 isSpeaking ? "Assistente falando..." : "Aguardando..."}
              </p>
            </div>
            
            <Button
              size="lg"
              variant="destructive"
              onClick={endVoiceCall}
              className="rounded-full h-16 w-16 hover:scale-105 transition-transform"
            >
              <PhoneOff className="h-8 w-8" />
            </Button>
            
            <p className="text-sm text-center text-muted-foreground mt-1">
              Clique para encerrar a conversa
            </p>
          </>
        ) : (
          <>
            <Button
              size="lg"
              variant="default"
              onClick={startVoiceCall}
              className="rounded-full h-16 w-16 bg-green-500 hover:bg-green-600 hover:scale-105 transition-transform"
            >
              <Mic className="h-8 w-8" />
            </Button>
            
            <p className="text-sm text-center text-muted-foreground">
              Clique para iniciar a conversa por voz
            </p>
          </>
        )}
      </div>
      
      {isProcessing && (
        <div className="flex items-center justify-center w-full p-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
          <span className="text-xs text-muted-foreground">Processando...</span>
        </div>
      )}
    </div>
  );
};

export default VoiceChatAgent;

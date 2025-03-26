
import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send, StopCircle, Bot, Volume2, Loader2, PhoneOff } from "lucide-react";
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
  const [textInputMode, setTextInputMode] = useState(false);
  
  // Refs for audio handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Configuration for voice conversation
  const silenceThresholdMs = 3000; // Time of silence before sending (3 seconds)
  const interruptionThresholdMs = 500; // How quickly agent should stop when interrupted (0.5 seconds)

  // Set up audio element for playback
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
  }, [isCallActive, isProcessing]);

  // Cleanup function to release resources
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
        URL.revokeObjectURL(audioRef.current.src);
      }
    }
  };

  // Initialize streaming voice call
  const startVoiceCall = async () => {
    try {
      setIsCallActive(true);
      addMessage("Iniciando conversa por voz. Pode falar quando quiser.", "assistant");
      startStreamingRecording();
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
    if (isRecording || isSpeaking || isProcessing) return;
    
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        if (audioChunksRef.current.length === 0) return;
        
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        processAudioInput(audioBlob);
      };
      
      // Set up audio analyzer for silence detection
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);
      
      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;
      
      microphone.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);
      
      let silenceStart = Date.now();
      let isSilent = true;
      let hasTalked = false;
      
      scriptProcessor.onaudioprocess = () => {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        
        // Calculate volume
        const arraySum = array.reduce((acc, value) => acc + value, 0);
        const average = arraySum / array.length;
        
        // Check if user is speaking
        if (average > 15) { // Adjust threshold as needed
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
          }
        } else if (!isSilent && Date.now() - silenceStart > silenceThresholdMs && hasTalked) {
          // User has been silent for the threshold duration after speaking
          isSilent = true;
          
          if (mediaRecorderRef.current && isRecording) {
            console.log("Silence detected, stopping recording");
            stopRecording();
          }
        }
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      console.log("Started streaming recording with silence detection");
      
      // Cleanup function
      return () => {
        scriptProcessor.disconnect();
        analyser.disconnect();
        microphone.disconnect();
        if (audioContext.state !== 'closed') {
          audioContext.close();
        }
      };
    } catch (error) {
      console.error("Error starting streaming recording:", error);
      toast.error("Não foi possível acessar o microfone", {
        description: "Verifique se você concedeu permissão para usar o microfone."
      });
      setIsCallActive(false);
    }
  };

  // Stop the current recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  // Process the recorded audio
  const processAudioInput = async (audioBlob: Blob) => {
    if (!apiKey || !isCallActive) {
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Transcribe the audio
      const transcript = await transcribeAudio(audioBlob, apiKey);
      
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
            // Generate audio for the response
            try {
              if (!isCallActive) return;
              
              const audioBuffer = await generateSpeech(
                fullMessage,
                agentConfig.voice.voiceId,
                apiKey
              );
              
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
              addMessage("Desculpe, ocorreu um erro ao processar sua solicitação.", "assistant");
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

  // Handle send text message button
  const handleSendText = () => {
    if (!inputValue.trim() || isProcessing) return;
    
    const userMessage = inputValue.trim();
    setInputValue("");
    
    addMessage(userMessage, "user");
    setIsProcessing(true);
    
    processResponse(userMessage);
  };

  // Handle keyboard enter key
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // Toggle between voice and text input
  const toggleInputMode = () => {
    if (isCallActive) {
      endVoiceCall();
    }
    setTextInputMode(!textInputMode);
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
          <div className="bg-red-400/10 text-red-400 text-xs px-3 py-1 rounded-full flex items-center gap-1 animate-pulse">
            <Mic className="h-3 w-3" />
            <span>Ouvindo...</span>
          </div>
        </div>
      )}
      
      {textInputMode ? (
        <div className="flex gap-2">
          <Input
            placeholder="Digite sua mensagem..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isProcessing}
            className="flex-1"
          />
          <Button 
            size="icon"
            disabled={!inputValue.trim() || isProcessing}
            onClick={handleSendText}
          >
            <Send className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleInputMode}
            className="flex-shrink-0"
            title="Alternar para entrada de voz"
          >
            <Mic className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          {isProcessing ? (
            <div className="flex items-center justify-center w-full p-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Processando...</span>
            </div>
          ) : isCallActive ? (
            <div className="flex flex-col items-center gap-3">
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
                className="rounded-full h-16 w-16"
              >
                <PhoneOff className="h-8 w-8" />
              </Button>
              
              <p className="text-sm text-center text-muted-foreground mt-1">
                Clique para encerrar a conversa
              </p>
              
              <Button
                variant="outline"
                size="sm"
                onClick={toggleInputMode}
                className="mt-2"
              >
                Alternar para texto
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Button
                size="lg"
                variant="default"
                onClick={startVoiceCall}
                className="rounded-full h-16 w-16 bg-green-500 hover:bg-green-600"
              >
                <Mic className="h-8 w-8" />
              </Button>
              
              <p className="text-sm text-center text-muted-foreground">
                Clique para iniciar a conversa por voz
              </p>
              
              <Button
                variant="outline"
                size="sm"
                onClick={toggleInputMode}
                className="mt-2"
              >
                Alternar para texto
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceChatAgent;

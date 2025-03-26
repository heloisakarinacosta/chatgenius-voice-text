
import React, { useState, useRef, useEffect } from "react";
import { Mic, PhoneOff, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { transcribeAudio, OpenAIMessage, streamOpenAI, generateSpeech } from "@/utils/openai";

interface VoiceChatAgentProps {
  apiKey: string;
}

const VoiceChatAgent: React.FC<VoiceChatAgentProps> = ({ apiKey }) => {
  const { agentConfig, messages, addMessage, updateMessage, currentConversationId } = useChat();
  const [isCallActive, setIsCallActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Refs for audio handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  
  // Audio visualization
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
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
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    if (audioAnalyserRef.current) {
      audioAnalyserRef.current = null;
    }

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
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
        console.error("Erro na reprodução de áudio:", e);
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
      
      // Send a welcome message
      addMessage("Olá! Estou ouvindo. Como posso ajudar?", "assistant");
      
      // Small delay to ensure UI updates before starting the microphone
      setTimeout(() => {
        startStreamingRecording();
      }, 500);
    } catch (error) {
      console.error("Erro ao iniciar chamada de voz:", error);
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
    
    addMessage("Conversa por voz encerrada.", "assistant");
  };

  // Draw audio visualization
  const drawAudioVisualization = () => {
    const canvas = canvasRef.current;
    if (!canvas || !audioAnalyserRef.current) return;
    
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;
    
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    
    // Clear canvas
    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
    
    // Get audio data
    const bufferLength = audioAnalyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    audioAnalyserRef.current.getByteTimeDomainData(dataArray);
    
    // Draw waveform
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'rgb(0, 128, 255)';
    canvasCtx.beginPath();
    
    const sliceWidth = WIDTH / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * HEIGHT / 2;
      
      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    canvasCtx.lineTo(WIDTH, HEIGHT / 2);
    canvasCtx.stroke();
    
    animationFrameRef.current = requestAnimationFrame(drawAudioVisualization);
  };

  // Start recording with automatic silence detection
  const startStreamingRecording = async () => {
    if (isRecording || isSpeaking || isProcessing) {
      console.log("Não é possível iniciar a gravação: já está gravando, falando ou processando");
      return;
    }
    
    try {
      // Clean up any existing resources first
      cleanupAudioResources();
      
      // Reset audio chunks
      audioChunksRef.current = [];
      
      // Get media stream
      console.log("Solicitando acesso ao microfone...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log("Acesso ao microfone concedido");
      streamRef.current = stream;
      
      // Create audio context for visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      audioAnalyserRef.current = audioContextRef.current.createAnalyser();
      
      audioAnalyserRef.current.fftSize = 2048;
      source.connect(audioAnalyserRef.current);
      
      // Start visualization
      if (canvasRef.current) {
        drawAudioVisualization();
      }
      
      // Create media recorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        console.log("MediaRecorder parou, processando chunks de áudio");
        if (audioChunksRef.current.length === 0) return;
        
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        
        // Only process if the blob is larger than 1KB (to avoid empty recordings)
        if (audioBlob.size > 1024 && apiKey && isCallActive) {
          await processAudioInput(audioBlob);
        } else {
          console.log("Blob de áudio muito pequeno ou chave API ausente, ignorando");
          // If call is still active, start listening again
          if (isCallActive && !isSpeaking && !isProcessing) {
            startStreamingRecording();
          }
        }
      };
      
      // Set up audio analyzer for silence detection
      let silenceStart = Date.now();
      let isSilent = true;
      let hasTalked = false;
      
      const checkAudioLevel = () => {
        if (!audioAnalyserRef.current || !isCallActive) return;
        
        const bufferLength = audioAnalyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        audioAnalyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate volume
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        
        // Debug log volume level occasionally
        if (Math.random() < 0.01) { // Log roughly 1% of the time
          console.log("Nível de áudio atual:", average);
        }
        
        // Check if user is speaking (adjust threshold as needed)
        if (average > 20) { // Threshold for detecting speech
          hasTalked = true;
          isSilent = false;
          silenceStart = Date.now();
          
          // If agent is speaking, stop it when user interrupts
          if (isSpeaking && audioRef.current) {
            console.log("Usuário interrompeu o agente");
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
          console.log(`Silêncio detectado por ${silenceThresholdMs}ms, parando gravação para processar fala`);
          isSilent = true;
          
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            stopRecording();
          }
          return;
        }
        
        // Continue checking audio levels if still recording
        if (isCallActive && !isSpeaking && !isProcessing && mediaRecorderRef.current?.state === 'recording') {
          setTimeout(checkAudioLevel, 100);
        }
      };
      
      // Start audio level checking
      setTimeout(checkAudioLevel, 100);
      
      // Start recording
      mediaRecorderRef.current.start();
      setIsRecording(true);
      console.log("Iniciada gravação com detecção de silêncio");
      
    } catch (error) {
      console.error("Erro ao iniciar gravação:", error);
      toast.error("Não foi possível acessar o microfone", {
        description: "Verifique se você concedeu permissão para usar o microfone."
      });
      setIsCallActive(false);
      setIsRecording(false);
    }
  };

  // Stop the current recording
  const stopRecording = () => {
    console.log("Parando gravação, estado:", mediaRecorderRef.current?.state);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      setIsRecording(false);
    }
    
    // Stop animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  // Process the recorded audio
  const processAudioInput = async (audioBlob: Blob) => {
    if (!apiKey || !isCallActive) {
      console.log("Não é possível processar áudio: sem chave API ou chamada não ativa");
      return;
    }
    
    console.log("Processando entrada de áudio, tamanho do blob:", audioBlob.size);
    setIsProcessing(true);
    
    try {
      // Transcribe the audio
      console.log("Transcrevendo áudio...");
      const transcript = await transcribeAudio(audioBlob, apiKey);
      console.log("Resultado da transcrição:", transcript);
      
      if (!transcript || transcript.trim() === "") {
        console.log("Nenhuma transcrição detectada, continuando a ouvir");
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
      console.error("Erro ao processar áudio:", error);
      
      if (isCallActive) {
        toast.error("Erro ao processar áudio", {
          description: "Por favor, tente novamente."
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
    if (!isCallActive || !apiKey) {
      console.log("Não é possível processar resposta: chamada não ativa ou chave API ausente");
      return;
    }
    
    console.log("Processando resposta para mensagem do usuário:", userMessage);
    
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
      console.log("Criada mensagem do assistente com ID:", assistantId);
      
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
      
      console.log("Iniciando stream da OpenAI com opções:", {
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
            console.log("Stream da OpenAI completo, gerando fala para:", fullMessage.substring(0, 50) + "...");
            // Generate audio for the response
            try {
              if (!isCallActive) return;
              
              const audioBuffer = await generateSpeech(
                fullMessage,
                agentConfig.voice.voiceId,
                apiKey
              );
              
              console.log("Fala gerada com sucesso, tamanho do buffer:", audioBuffer.byteLength);
              
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
              toast.error("Não foi possível gerar fala");
              
              // If we can't generate speech, continue listening
              if (isCallActive && !isRecording) {
                startStreamingRecording();
              }
            }
            
            setIsProcessing(false);
          },
          onError: (error) => {
            console.error("Erro na resposta da IA:", error);
            if (updateMessage) {
              updateMessage(assistantId, "Desculpe, houve um erro ao processar sua solicitação.");
            }
            
            setIsProcessing(false);
            
            // Continue listening even after an error
            if (isCallActive && !isRecording && !isSpeaking) {
              startStreamingRecording();
            }
            
            toast.error("Erro ao obter resposta", {
              description: error instanceof Error ? error.message : "Por favor, tente novamente."
            });
          },
        }
      );
    } catch (error) {
      console.error("Erro ao obter resposta:", error);
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
          A funcionalidade de voz está desativada. Habilite-a nas configurações do agente.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {isSpeaking && (
        <div className="flex justify-center mb-2">
          <div className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-full flex items-center gap-1 animate-pulse">
            <Volume2 className="h-4 w-4" />
            <span>Falando...</span>
          </div>
        </div>
      )}
      
      {/* Audio visualization canvas - only show when recording */}
      {isRecording && (
        <div className="flex flex-col items-center mb-2">
          <div className="bg-red-500/20 text-red-500 text-sm px-3 py-1 rounded-full flex items-center gap-1 animate-pulse mb-2">
            <Mic className="h-4 w-4" />
            <span>Ouvindo...</span>
          </div>
          
          <canvas 
            ref={canvasRef} 
            width={300} 
            height={60} 
            className="w-full h-12 rounded-lg bg-black/5"
          />
        </div>
      )}
      
      <div className="flex flex-col items-center gap-3">
        {isCallActive ? (
          <>
            <div className="text-sm text-center mb-2">
              <p className="text-muted-foreground">Conversa em andamento</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isRecording ? "Fale normalmente. Pause para que o assistente responda." : 
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
            <div className="relative overflow-hidden group">
              <Button
                size="lg"
                variant="default"
                onClick={startVoiceCall}
                className="rounded-full h-16 w-16 bg-green-500 hover:bg-green-600 hover:scale-105 transition-transform z-10 relative"
              >
                <Mic className="h-8 w-8" />
              </Button>
              <div className="absolute inset-0 bg-green-400/30 rounded-full scale-0 group-hover:scale-125 transition-transform duration-700 animate-pulse"></div>
            </div>
            
            <p className="text-sm text-center text-muted-foreground">
              Clique para iniciar conversa por voz
            </p>
          </>
        )}
      </div>
      
      {isProcessing && (
        <div className="flex items-center justify-center w-full p-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Processando...</span>
        </div>
      )}
    </div>
  );
};

export default VoiceChatAgent;


import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Send, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { transcribeAudio, streamOpenAI, generateSpeech, OpenAIMessage } from "@/utils/openai";
import { useChat } from "@/contexts/ChatContext";
import { Input } from "@/components/ui/input";

interface VoiceChatAgentProps {
  apiKey: string;
}

const VoiceChatAgent: React.FC<VoiceChatAgentProps> = ({ apiKey }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const { 
    messages, 
    addMessage, 
    agentConfig,
    setIsVoiceChatActive
  } = useChat();

  useEffect(() => {
    // Inicializa o elemento de áudio
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
      };
      
      audioRef.current.onerror = (e) => {
        console.error("Audio playback error:", e);
        setIsSpeaking(false);
      };
    }
    
    return () => {
      if (audioRef.current) {
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        processAudioInput(audioBlob);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Gravação iniciada. Fale agora...");
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Erro ao acessar microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Interromper todos os tracks
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      
      toast.info("Processando sua fala...");
      setIsProcessing(true);
    }
  };

  const processAudioInput = async (audioBlob: Blob) => {
    try {
      const transcription = await transcribeAudio(audioBlob, apiKey);
      
      if (transcription.trim()) {
        addMessage(transcription, "user");
        await sendToAI(transcription);
      } else {
        toast.error("Não consegui entender o que você disse. Por favor, tente novamente.");
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Error transcribing audio:", error);
      toast.error("Erro ao transcrever áudio. Por favor, tente novamente.");
      setIsProcessing(false);
    }
  };

  const sendToAI = async (userMessage: string) => {
    if (!apiKey) {
      toast.error("API Key não configurada");
      setIsProcessing(false);
      return;
    }

    try {
      const conversationHistory: OpenAIMessage[] = [
        { role: "system", content: agentConfig.systemPrompt },
        ...messages.map(msg => ({ 
          role: msg.role as "user" | "assistant" | "system", 
          content: msg.content 
        })),
        { role: "user", content: userMessage },
      ];
      
      let assistantMessage = "";
      
      addMessage("", "assistant");
      
      await streamOpenAI(
        {
          messages: conversationHistory,
          model: agentConfig.model,
          temperature: agentConfig.temperature,
          max_tokens: agentConfig.maxTokens,
          trainingFiles: agentConfig.trainingFiles,
          detectEmotion: agentConfig.detectEmotion,
          stream: true
        },
        apiKey,
        {
          onMessage: (chunk) => {
            assistantMessage += chunk;
            
            const updatedMessages = [...messages];
            if (updatedMessages.length > 0) {
              const lastAssistantMessageIndex = updatedMessages.findIndex(
                msg => msg.role === "assistant"
              );
              
              if (lastAssistantMessageIndex !== -1) {
                const lastMessage = updatedMessages[lastAssistantMessageIndex];
                lastMessage.content = assistantMessage;
              }
            }
          },
          onComplete: async (fullMessage) => {
            try {
              // Gerar áudio da resposta
              const audioBuffer = await generateSpeech(
                fullMessage,
                agentConfig.voice.voiceId,
                apiKey
              );
              
              const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
              const audioUrl = URL.createObjectURL(audioBlob);
              
              if (audioRef.current) {
                if (audioRef.current.src) {
                  URL.revokeObjectURL(audioRef.current.src);
                }
                
                audioRef.current.src = audioUrl;
                audioRef.current.play().catch(error => {
                  console.error("Erro ao reproduzir áudio:", error);
                  toast.error("Erro ao reproduzir áudio", {
                    description: "Seu navegador bloqueou a reprodução automática. Clique para ouvir a resposta.",
                    action: {
                      label: "Reproduzir",
                      onClick: () => audioRef.current?.play(),
                    }
                  });
                });
              }
              
              setIsProcessing(false);
            } catch (error) {
              console.error("Error generating speech:", error);
              toast.error("Erro ao gerar fala. Continuando apenas com texto.");
              setIsProcessing(false);
            }
          },
          onError: (error) => {
            console.error("Error from OpenAI:", error);
            setIsProcessing(false);
            toast.error("Erro ao processar resposta");
          }
        }
      );
    } catch (error) {
      console.error("Error in AI processing:", error);
      toast.error("Erro ao processar resposta. Por favor, tente novamente.");
      setIsProcessing(false);
    }
  };

  const handleSendTextMessage = () => {
    if (!inputValue.trim() || isProcessing) return;
    
    const userMessage = inputValue.trim();
    setInputValue("");
    addMessage(userMessage, "user");
    setIsProcessing(true);
    sendToAI(userMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendTextMessage();
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Digite sua mensagem..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={isProcessing || !apiKey || isRecording}
          className="flex-1"
        />
        <Button 
          variant="default" 
          size="icon"
          disabled={!inputValue.trim() || isProcessing || !apiKey || isRecording}
          onClick={handleSendTextMessage}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="w-full flex justify-center items-center">
        <div className="w-full flex items-center justify-between rounded-lg p-2 bg-secondary/20">
          <div className="text-xs text-muted-foreground">
            {isRecording ? "Gravando... Clique para parar" : 
             isSpeaking ? "Falando..." : 
             isProcessing ? "Processando..." : 
             "Clique no microfone para falar"}
          </div>
          
          <div className="flex items-center gap-1">
            {isSpeaking && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-full"
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.pause();
                    setIsSpeaking(false);
                  }
                }}
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            )}
            
            <Button
              variant={isRecording ? "destructive" : "secondary"}
              size="sm"
              className={`h-10 w-10 p-0 rounded-full ${isRecording ? "animate-pulse" : ""}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing || isSpeaking}
            >
              {isRecording ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full ml-1"
              onClick={() => setIsVoiceChatActive(false)}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceChatAgent;

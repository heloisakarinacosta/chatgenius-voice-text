
import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send, StopCircle, Bot, Volume2, Loader2 } from "lucide-react";
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
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [textInputMode, setTextInputMode] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      };
      
      audioRef.current.onerror = (e) => {
        console.error("Audio playback error:", e);
        setIsSpeaking(false);
        toast.error("Erro ao reproduzir áudio");
      };
    }
    
    return () => {
      stopRecording();
      if (audioRef.current) {
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
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
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Não foi possível acessar o microfone", {
        description: "Verifique se você concedeu permissão para usar o microfone."
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const processAudioInput = async (audioBlob: Blob) => {
    if (!apiKey) {
      toast.error("API Key não configurada");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Transcrever o áudio
      const transcript = await transcribeAudio(audioBlob, apiKey);
      
      if (!transcript || transcript.trim() === "") {
        toast.error("Não foi possível entender o áudio", {
          description: "Por favor, tente falar mais claramente."
        });
        setIsProcessing(false);
        return;
      }
      
      // Adicionar a mensagem do usuário
      if (addMessage) {
        addMessage(transcript, "user");
      }
      
      // Processar a resposta
      await processResponse(transcript);
    } catch (error) {
      console.error("Error processing audio:", error);
      toast.error("Erro ao processar áudio", {
        description: error instanceof Error ? error.message : "Tente novamente."
      });
      setIsProcessing(false);
    }
  };

  const processResponse = async (userMessage: string) => {
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
      // Adicionar espaço para a resposta do assistente
      const assistantId = addMessage ? addMessage("", "assistant") : "";
      
      // Configurar opções para streaming
      const streamOptions: any = {
        messages: conversationHistory,
        model: agentConfig.model,
        temperature: agentConfig.temperature,
        max_tokens: agentConfig.maxTokens,
        stream: true,
        trainingFiles: agentConfig.trainingFiles,
        detectEmotion: agentConfig.detectEmotion
      };
      
      // Adicionar funções se disponíveis
      if (agentConfig.functions && agentConfig.functions.length > 0) {
        streamOptions.functions = agentConfig.functions.map(fn => ({
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters,
        }));
      }
      
      // Iniciar streaming da resposta
      await streamOpenAI(
        streamOptions,
        apiKey,
        {
          onMessage: (chunk) => {
            assistantMessage += chunk;
            
            // Atualizar a mensagem na conversa
            if (assistantId && updateMessage) {
              updateMessage(assistantId, assistantMessage);
            }
          },
          onComplete: async (fullMessage) => {
            // Gerar áudio da resposta completa
            try {
              const audioBuffer = await generateSpeech(
                fullMessage,
                agentConfig.voice.voiceId,
                apiKey
              );
              
              // Reproduzir o áudio
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
                    action: {
                      label: "Reproduzir",
                      onClick: () => audioRef.current?.play(),
                    }
                  });
                });
              }
            } catch (error) {
              console.error("Erro ao gerar fala:", error);
              toast.error("Não foi possível gerar a fala");
            }
            
            setIsProcessing(false);
          },
          onError: (error) => {
            console.error("Erro na resposta da IA:", error);
            if (addMessage) {
              addMessage("Desculpe, ocorreu um erro ao processar sua solicitação.", "assistant");
            }
            setIsProcessing(false);
            
            toast.error("Erro ao obter resposta", {
              description: error instanceof Error ? error.message : "Tente novamente."
            });
          },
        }
      );
    } catch (error) {
      console.error("Error getting response:", error);
      setIsProcessing(false);
      
      toast.error("Erro ao processar resposta", {
        description: "Não foi possível obter uma resposta do assistente."
      });
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSendText = () => {
    if (!inputValue.trim() || isProcessing) return;
    
    const userMessage = inputValue.trim();
    setInputValue("");
    if (addMessage) {
      addMessage(userMessage, "user");
    }
    setIsProcessing(true);
    
    processResponse(userMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const toggleInputMode = () => {
    setTextInputMode(!textInputMode);
  };

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
          ) : (
            <>
              <Button
                size="lg"
                variant={isRecording ? "destructive" : "default"}
                onClick={handleToggleRecording}
                className="rounded-full h-16 w-16"
                disabled={isProcessing || isSpeaking}
              >
                {isRecording ? (
                  <StopCircle className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </Button>
              
              <p className="text-sm text-center text-muted-foreground">
                {isRecording 
                  ? "Clique para parar de gravar" 
                  : isSpeaking 
                    ? "Aguarde a resposta terminar..." 
                    : "Clique para falar"}
              </p>
              
              <Button
                variant="outline"
                size="sm"
                onClick={toggleInputMode}
                className="mt-2"
              >
                Alternar para texto
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceChatAgent;

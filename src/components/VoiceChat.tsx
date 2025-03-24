
import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/contexts/ChatContext";
import { transcribeAudio } from "@/utils/openai";
import { toast } from "sonner";

interface VoiceChatProps {
  apiKey: string;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ apiKey }) => {
  const { isVoiceChatActive, setIsVoiceChatActive, addMessage } = useChat();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Inicializar gravador de mídia
  const startRecording = async () => {
    try {
      console.log("Solicitando acesso ao microfone...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      console.log("Acesso ao microfone concedido, criando MediaRecorder");
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) {
          console.log("Nenhum áudio gravado");
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log(`Áudio gravado: ${audioBlob.size} bytes`);
        
        try {
          setIsTranscribing(true);
          console.log("Transcrevendo áudio...");
          const transcript = await transcribeAudio(audioBlob, apiKey);
          setIsTranscribing(false);
          
          if (transcript) {
            console.log(`Transcrição: "${transcript}"`);
            addMessage(transcript, "user");
          } else {
            console.error("Transcrição vazia recebida");
            toast.error("Não foi possível transcrever sua mensagem. Por favor, tente novamente.");
          }
        } catch (error) {
          setIsTranscribing(false);
          console.error("Erro de transcrição:", error);
          
          let errorMessage = "Erro ao transcrever áudio. Por favor, tente novamente.";
          let errorDescription = "";
          
          if (error instanceof Error) {
            if (error.message.includes("limit") || error.message.includes("quota")) {
              errorMessage = "Limite da API de transcrição excedido";
              errorDescription = "Você excedeu seu limite de uso para a API de transcrição. Tente novamente mais tarde.";
            } else if (error.message.includes("key")) {
              errorMessage = "Problema com a chave da API";
              errorDescription = "Sua chave da API não tem permissão para usar o serviço de transcrição.";
            }
          }
          
          toast.error(errorMessage, {
            description: errorDescription,
          });
        }
        
        // Limpar tempo de gravação e chunks
        setRecordingTime(0);
        audioChunksRef.current = [];
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      // Iniciar timer de gravação
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Erro ao acessar microfone:", error);
      
      let errorMessage = "Não foi possível acessar seu microfone. Por favor, verifique as permissões.";
      let description = "";
      
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          errorMessage = "Acesso ao microfone foi negado";
          description = "Por favor, permita o acesso ao microfone nas configurações do seu navegador.";
        } else if (error.name === "NotFoundError") {
          errorMessage = "Microfone não encontrado";
          description = "Seu dispositivo não possui um microfone ou ele não está disponível.";
        }
      }
      
      toast.error(errorMessage, {
        description,
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log("Parando a gravação");
      mediaRecorderRef.current.stop();
      
      // Parar todas as pistas no stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          console.log(`Parando faixa: ${track.kind}`);
          track.stop();
        });
        streamRef.current = null;
      }
      
      setIsRecording(false);
      
      // Limpar o timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Alternar chat por voz
  const toggleVoiceChat = () => {
    if (isVoiceChatActive) {
      setIsVoiceChatActive(false);
      if (isRecording) {
        stopRecording();
      }
    } else {
      setIsVoiceChatActive(true);
    }
  };

  // Mudar para modo texto
  const switchToTextMode = () => {
    if (isRecording) {
      stopRecording();
    }
    setIsVoiceChatActive(false);
  };

  // Formatar tempo de gravação
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 w-full flex justify-between items-center">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs flex items-center gap-1"
          onClick={switchToTextMode}
        >
          <MessageSquare className="h-3 w-3" />
          Mudar para texto
        </Button>
        
        <div className="text-xs text-muted-foreground">
          {isRecording ? (
            <span className="text-red-500 animate-pulse font-medium">Gravando {formatTime(recordingTime)}</span>
          ) : isTranscribing ? (
            <span className="text-amber-500 animate-pulse font-medium">Transcrevendo...</span>
          ) : (
            "Modo de voz ativado"
          )}
        </div>
      </div>
      
      <Button
        variant={isRecording ? "destructive" : "default"}
        size="icon"
        className={`rounded-full w-16 h-16 ${isRecording ? 'animate-pulse' : ''}`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isTranscribing}
      >
        {isRecording ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </Button>
      
      <p className="mt-3 text-xs text-center text-muted-foreground max-w-xs">
        {isRecording 
          ? "Clique para parar a gravação" 
          : isTranscribing
          ? "Transcrevendo sua mensagem..."
          : "Clique no botão para começar a falar. Você pode alternar entre texto e voz a qualquer momento."}
      </p>
    </div>
  );
};

export default VoiceChat;

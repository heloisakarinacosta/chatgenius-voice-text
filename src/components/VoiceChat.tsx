
import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, MessageSquare, Volume2, PauseCircle, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/contexts/ChatContext";
import { transcribeAudio } from "@/utils/openai";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface VoiceChatProps {
  apiKey: string;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ apiKey }) => {
  const { isVoiceChatActive, setIsVoiceChatActive, addMessage, updateMessage, sendMessage } = useChat();
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTextInputMode, setIsTextInputMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [lastUserInteraction, setLastUserInteraction] = useState<Date>(new Date());
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isListening && !isRecording && !isTranscribing && !isTextInputMode) {
      const timeSinceLastInteraction = new Date().getTime() - lastUserInteraction.getTime();
      
      if (timeSinceLastInteraction > 3000) {
        startRecording();
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isListening, isRecording, isTranscribing, isTextInputMode, lastUserInteraction]);

  // Draw audio visualization on canvas
  const drawAudioVisualization = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set styles
    ctx.fillStyle = 'rgba(0, 120, 255, 0.2)';
    ctx.strokeStyle = 'rgb(0, 120, 255)';
    ctx.lineWidth = 2;
    
    // Draw waveform based on audio level
    ctx.beginPath();
    const centerY = canvas.height / 2;
    const amplitude = (audioLevel / 100) * (canvas.height / 2 - 5);
    
    // Create a sine wave effect based on audio level
    for (let x = 0; x < canvas.width; x += 1) {
      const y = centerY + Math.sin(x * 0.1 + Date.now() * 0.005) * amplitude;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    
    // Continue animation
    animationFrameRef.current = requestAnimationFrame(drawAudioVisualization);
  };

  const startRecording = async () => {
    try {
      console.log("Solicitando acesso ao microfone...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
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
        
        if (audioBlob.size < 1000) {
          console.log("Gravação muito curta, ignorando");
          setLastUserInteraction(new Date());
          return;
        }
        
        try {
          setIsTranscribing(true);
          console.log("Transcrevendo áudio...");
          const transcript = await transcribeAudio(audioBlob, apiKey);
          setIsTranscribing(false);
          
          if (transcript) {
            console.log(`Transcrição: "${transcript}"`);
            const messageId = addMessage(transcript, "user");
            console.log(`Mensagem adicionada com ID: ${messageId}`);
            
            // Enviar a mensagem para o servidor
            try {
              const success = await sendMessage(transcript);
              if (!success) {
                console.error("Falha ao enviar mensagem transcrita para o servidor");
                toast.error("Erro ao enviar áudio transcrito");
              }
            } catch (error) {
              console.error("Erro ao enviar mensagem transcrita:", error);
            }
            
            setLastUserInteraction(new Date());
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
        
        setRecordingTime(0);
        audioChunksRef.current = [];
      };
      
      // Set up audio analyzer for visualization
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Start visualization
      const updateAudioLevel = () => {
        if (!isRecording) return;
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
        setAudioLevel(average);
        
        if (isRecording) {
          setTimeout(updateAudioLevel, 100);
        }
      };
      
      updateAudioLevel();
      
      // Start visualization
      if (canvasRef.current) {
        drawAudioVisualization();
      }
      
      mediaRecorder.start();
      setIsRecording(true);
      
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 14) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              stopRecording();
            }
            return 0;
          }
          return prev + 1;
        });
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
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          console.log(`Parando faixa: ${track.kind}`);
          track.stop();
        });
        streamRef.current = null;
      }
      
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Stop visualization
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  };

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

  const toggleInputMode = () => {
    setIsTextInputMode(!isTextInputMode);
    
    if (!isTextInputMode) {
      if (isRecording) {
        stopRecording();
      }
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };

  const switchToTextMode = () => {
    if (isRecording) {
      stopRecording();
    }
    setIsVoiceChatActive(false);
  };

  const handleSendText = async () => {
    if (!textInput.trim()) return;
    
    try {
      // Adicionar mensagem localmente
      const messageId = addMessage(textInput, "user");
      console.log(`Mensagem de texto adicionada com ID: ${messageId}`);
      
      // Enviar mensagem para o servidor
      const success = await sendMessage(textInput);
      if (!success) {
        console.error("Falha ao enviar mensagem de texto para o servidor");
        toast.error("Erro ao enviar mensagem");
      }
      
      setTextInput("");
      setIsTextInputMode(false);
      setLastUserInteraction(new Date());
    } catch (error) {
      console.error("Erro ao enviar mensagem de texto:", error);
      toast.error("Erro ao enviar mensagem");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const toggleListening = () => {
    setIsListening(!isListening);
    if (isRecording) {
      stopRecording();
    }
  };

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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
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
          Voltar para texto
        </Button>
        
        <div className="text-xs text-muted-foreground">
          {isRecording ? (
            <span className="text-red-500 animate-pulse font-medium">Gravando {formatTime(recordingTime)}</span>
          ) : isTranscribing ? (
            <span className="text-amber-500 animate-pulse font-medium">Transcrevendo...</span>
          ) : isListening ? (
            <span className="text-green-500">Escutando...</span>
          ) : (
            "Modo de voz ativado"
          )}
        </div>
      </div>
      
      {isTextInputMode ? (
        <div className="w-full flex gap-2">
          <Input
            ref={textInputRef}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Digite sua mensagem..."
            className="flex-1"
          />
          <Button 
            variant="default" 
            disabled={!textInput.trim()}
            onClick={handleSendText}
          >
            Enviar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {isRecording && (
            <div className="w-full mb-3">
              <canvas 
                ref={canvasRef} 
                width={300} 
                height={60} 
                className="w-full h-12 rounded-lg bg-black/5"
              />
            </div>
          )}
          
          <div className="flex gap-4 mb-4">
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
            
            <Button
              variant="outline"
              size="icon"
              className="rounded-full w-12 h-12"
              onClick={toggleListening}
            >
              {isListening ? (
                <PauseCircle className="h-5 w-5 text-amber-500" />
              ) : (
                <Volume2 className="h-5 w-5 text-green-500" />
              )}
            </Button>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1"
            onClick={toggleInputMode}
          >
            <Keyboard className="h-4 w-4 mr-1" />
            <span>Digitar texto</span>
          </Button>
          
          <p className="mt-3 text-xs text-center text-muted-foreground max-w-xs">
            {isRecording 
              ? "Clique para parar a gravação" 
              : isTranscribing
              ? "Transcrevendo sua mensagem..."
              : isListening
              ? "Escutando... Comece a falar e a gravação iniciará automaticamente."
              : "Clique no botão para começar a falar."}
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceChat;

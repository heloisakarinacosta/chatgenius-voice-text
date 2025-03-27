
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
  const voiceDetectedRef = useRef<boolean>(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Configurações de detecção de voz
  const SILENCE_THRESHOLD = 5; // Nível abaixo do qual é considerado silêncio
  const MIN_VOICE_LEVEL = 15; // Nível mínimo para considerar como voz
  const SILENCE_DURATION = 1000; // Tempo em ms para considerar como silêncio contínuo

  useEffect(() => {
    if (isVoiceChatActive && !isRecording && !isTranscribing && !isTextInputMode) {
      console.log("Auto-starting recording when voice chat is activated");
      startRecording();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, [isVoiceChatActive]);

  const drawAudioVisualization = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'rgba(0, 120, 255, 0.2)';
    ctx.strokeStyle = 'rgb(0, 120, 255)';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    const centerY = canvas.height / 2;
    const amplitude = (audioLevel / 100) * (canvas.height / 2 - 5);
    
    for (let x = 0; x < canvas.width; x += 1) {
      const y = centerY + Math.sin(x * 0.1 + Date.now() * 0.005) * amplitude;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    
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
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      voiceDetectedRef.current = false;
      
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
        
        // Verificar se voz foi detectada durante a gravação
        if (!voiceDetectedRef.current) {
          console.log("Nenhuma voz detectada na gravação, ignorando");
          toast.info("Não detectamos sua voz. Por favor, tente novamente falando mais alto.");
          setRecordingTime(0);
          audioChunksRef.current = [];
          
          // Reiniciar a gravação após breve pausa
          setTimeout(() => {
            if (isVoiceChatActive && !isRecording && !isTranscribing) {
              startRecording();
            }
          }, 1000);
          return;
        }
        
        try {
          setIsTranscribing(true);
          console.log("Transcrevendo áudio...");
          const transcript = await transcribeAudio(audioBlob, apiKey);
          setIsTranscribing(false);
          
          if (transcript && transcript.trim() !== "") {
            console.log(`Transcrição: "${transcript}"`);
            const messageId = addMessage(transcript, "user");
            console.log(`Mensagem adicionada com ID: ${messageId}`);
            
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
            toast.info("Não conseguimos entender o que você disse. Por favor, tente novamente.");
            
            // Reiniciar gravação se não conseguimos entender
            setTimeout(() => {
              if (isVoiceChatActive && !isRecording && !isTranscribing) {
                startRecording();
              }
            }, 1000);
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
          
          // Reiniciar gravação após erro
          setTimeout(() => {
            if (isVoiceChatActive && !isRecording && !isTranscribing) {
              startRecording();
            }
          }, 2000);
        }
        
        setRecordingTime(0);
        audioChunksRef.current = [];
      };
      
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateAudioLevel = () => {
        if (!isRecording) return;
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
        setAudioLevel(average);
        
        // Detecção de voz
        if (average > MIN_VOICE_LEVEL) {
          voiceDetectedRef.current = true;
          
          // Reset do timeout de silêncio quando detectamos voz
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }
        } else if (average < SILENCE_THRESHOLD && isRecording && recordingTime > 2) {
          // Se estiver em silêncio e já estiver gravando por alguns segundos
          if (!silenceTimeoutRef.current) {
            silenceTimeoutRef.current = setTimeout(() => {
              if (isRecording && voiceDetectedRef.current) {
                console.log("Silêncio prolongado detectado, parando gravação");
                stopRecording();
              }
            }, SILENCE_DURATION);
          }
        }
        
        if (isRecording) {
          setTimeout(updateAudioLevel, 100);
        }
      };
      
      updateAudioLevel();
      
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
      // Iniciar a gravação imediatamente ao ativar o chat de voz
      setTimeout(() => {
        startRecording();
      }, 300);
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
      const messageId = addMessage(textInput, "user");
      console.log(`Mensagem de texto adicionada com ID: ${messageId}`);
      
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
              aria-label={isRecording ? "Stop recording" : "Start recording"}
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
              aria-label={isListening ? "Pause listening" : "Resume listening"}
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
              ? "Escutando... Comece a falar e a gravação continuará automaticamente."
              : "Clique no botão para começar a falar."}
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceChat;

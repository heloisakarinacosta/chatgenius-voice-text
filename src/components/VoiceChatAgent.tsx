
import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Mic, StopCircle, RefreshCw } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { transcribeAudio, generateSpeech, callOpenAI } from "@/utils/openai";

interface VoiceChatAgentProps {
  apiKey: string;
}

const VoiceChatAgent: React.FC<VoiceChatAgentProps> = ({ apiKey }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processingAudioRef = useRef<boolean>(false);
  const lastProcessTimeRef = useRef<number>(0);
  
  const { 
    addMessage, 
    updateMessage,
    agentConfig,
    messages,
    currentConversationId
  } = useChat();

  useEffect(() => {
    console.log("VoiceChatAgent: API key present:", !!apiKey);
    
    // Cleanup function
    return () => {
      stopRecording();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      console.log("Solicitando acesso ao microfone...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      console.log("Acesso ao microfone concedido");
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        console.log("MediaRecorder parou, processando chunks de áudio");
        if (audioChunksRef.current.length === 0) {
          console.log("Nenhum dado de áudio capturado");
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log("Tamanho do blob de áudio:", audioBlob.size);
        
        if (audioBlob.size < 1000 || !apiKey) {
          console.log("Blob de áudio muito pequeno ou chave API ausente, ignorando");
          return;
        }
        
        // Limpa os chunks para o próximo segmento
        audioChunksRef.current = [];
        
        // Processa o áudio atual
        processAudioBlob(audioBlob);
        
        // Se ainda estiver no modo de gravação, inicia uma nova gravação
        if (isRecording && mediaRecorderRef.current) {
          console.log("Reiniciando gravação para modo conversacional");
          try {
            mediaRecorderRef.current.start(1000);
          } catch (error) {
            console.error("Erro ao reiniciar gravação:", error);
          }
        }
      };
      
      // Start recording
      mediaRecorder.start(1000);
      setIsRecording(true);
      
      // Set up silence detection
      console.log("Iniciada gravação com detecção de silêncio para modo conversacional");
      setupSilenceDetection(stream);
      
    } catch (error) {
      console.error("Erro ao iniciar gravação:", error);
      toast.error("Erro ao acessar microfone", {
        description: "Verifique as permissões do seu navegador."
      });
    }
  };

  const setupSilenceDetection = (stream: MediaStream) => {
    try {
      // Usar AnalyserNode em vez de ScriptProcessorNode para minimizar alertas de depreciação
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      // Configuração do AnalyserNode
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);
      
      // Buffer para análise de amplitude
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let silenceStart = Date.now();
      const silenceThreshold = 15; // Volume abaixo do qual é considerado silêncio
      const conversationalPauseTime = 1500; // 1.5 segundos de silêncio para considerar uma pausa conversacional
      
      // Função para análise periódica
      const checkAudioLevel = () => {
        if (!isRecording) return;
        
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        
        // Detecção de silêncio
        if (average < silenceThreshold) {
          const currentTime = Date.now();
          const elapsedSilence = currentTime - silenceStart;
          
          // Se o silêncio durar mais do que o tempo conversacional de pausa, processa o áudio
          if (elapsedSilence > conversationalPauseTime && !processingAudioRef.current) {
            // Evita detectar silêncios muito frequentes
            if (currentTime - lastProcessTimeRef.current > 3000) {
              console.log("Pausa conversacional detectada após " + elapsedSilence + "ms, processando segmento de áudio");
              
              // Marca que estamos processando
              processingAudioRef.current = true;
              
              // Para o gravador atual para processar os chunks atuais
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
                // O evento onstop lidará com o processamento e reinício
              }
              
              lastProcessTimeRef.current = currentTime;
            }
          }
        } else {
          // Reinicia o contador de silêncio
          silenceStart = Date.now();
        }
        
        // Continua verificando
        if (isRecording) {
          requestAnimationFrame(checkAudioLevel);
        }
      };
      
      // Inicia a análise de áudio
      checkAudioLevel();
      
      // Retorno para limpar
      return () => {
        microphone.disconnect();
        audioContext.close();
      };
    } catch (error) {
      console.error("Erro ao configurar detecção de silêncio:", error);
    }
  };
  
  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    
    console.log("Parando gravação, estado:", mediaRecorderRef.current.state);
    setIsRecording(false);
    
    try {
      mediaRecorderRef.current.stop();
      
      // Stop all tracks from the stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    } catch (error) {
      console.error("Erro ao parar gravação:", error);
    }
  };

  const processAudioBlob = async (audioBlob: Blob) => {
    if (!apiKey || !currentConversationId) {
      console.log("Chamada não está mais ativa, ignorando áudio");
      processingAudioRef.current = false;
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Create an object URL for the audio blob for preview
      const audioURL = URL.createObjectURL(audioBlob);
      setAudioURL(audioURL);
      
      // Transcribe audio using OpenAI Whisper
      console.log("Enviando áudio para transcrição...");
      const transcription = await transcribeAudio(audioBlob, apiKey);
      console.log("Transcrição recebida:", transcription);
      
      if (!transcription || transcription.trim() === "") {
        console.log("Transcrição vazia, ignorando");
        setIsProcessing(false);
        processingAudioRef.current = false;
        return;
      }
      
      // Add the user's transcribed message to the chat
      const userMessageId = addMessage(transcription, "user");
      console.log("Mensagem do usuário adicionada com ID:", userMessageId);
      
      // Add a temporary assistant message that will be updated
      const assistantMessageId = addMessage("...", "assistant");
      
      // Process the message with OpenAI
      const systemPrompt = agentConfig?.systemPrompt || "Você é um assistente útil.";
      
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
      
      // Get response from OpenAI
      const assistantResponse = await callOpenAI({
        messages: conversationMessages,
        model: agentConfig?.model || "gpt-4o-mini",
        temperature: agentConfig?.temperature || 0.7,
        trainingFiles: agentConfig?.trainingFiles || [],
        detectEmotion: agentConfig?.detectEmotion || false
      }, apiKey);
      
      console.log("Resposta do assistente:", assistantResponse.substring(0, 50) + "...");
      
      // Update the temporary message with the actual response
      updateMessage(assistantMessageId, assistantResponse);
      
      // Generate and play the speech response if voice is enabled
      if (agentConfig?.voice?.enabled && assistantResponse) {
        try {
          const voiceId = agentConfig.voice.voiceId || "alloy";
          console.log("Gerando resposta de voz com voz:", voiceId);
          
          const speechAudioBuffer = await generateSpeech(
            assistantResponse, 
            voiceId, 
            apiKey
          );
          
          const speechBlob = new Blob([speechAudioBuffer], { type: 'audio/mpeg' });
          const speechURL = URL.createObjectURL(speechBlob);
          
          if (audioRef.current) {
            audioRef.current.src = speechURL;
            audioRef.current.play();
          }
        } catch (speechError) {
          console.error("Erro ao gerar fala:", speechError);
        }
      }
    } catch (error) {
      console.error("Erro ao processar áudio:", error);
      toast.error("Erro ao processar áudio", {
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido"
      });
    } finally {
      setIsProcessing(false);
      processingAudioRef.current = false;
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-center space-x-2">
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
      </div>
      
      {isRecording && (
        <div className="text-center text-sm text-muted-foreground animate-pulse">
          Falando... (Fale e faça pausas naturais para resposta)
        </div>
      )}
      
      {isProcessing && (
        <div className="text-center text-sm text-muted-foreground">
          Processando áudio...
        </div>
      )}
      
      {audioURL && (
        <audio ref={audioRef} className="hidden" controls />
      )}
    </div>
  );
};

export default VoiceChatAgent;

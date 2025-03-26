
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
import { 
  Slider 
} from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface VoiceChatAgentProps {
  apiKey: string;
}

const VoiceChatAgent: React.FC<VoiceChatAgentProps> = ({ apiKey }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const processingAudioRef = useRef<boolean>(false);
  const lastProcessTimeRef = useRef<number>(0);
  const currentResponseRef = useRef<string>("");
  const currentStreamingMessageId = useRef<string | null>(null);
  const retryCountRef = useRef<number>(0);
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
    isPlaying
  } = useSpeechPlayer(agentConfig?.voice?.voiceId || 'alloy');

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
      // Usar AnalyserNode em vez de ScriptProcessorNode
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
    retryCountRef.current = 0;
    
    try {
      // Create an object URL for the audio blob for preview
      const audioURL = URL.createObjectURL(audioBlob);
      setAudioURL(audioURL);
      
      // Transcribe audio using OpenAI Whisper
      console.log("Enviando áudio para transcrição...");
      const transcription = await transcribeAudioWithRetry(audioBlob);
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
      currentStreamingMessageId.current = assistantMessageId;
      
      // Reset accumulated response
      currentResponseRef.current = "";
      
      // Process the message with OpenAI using streaming
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
      
      // Get streaming response from OpenAI
      await streamOpenAI({
        messages: conversationMessages,
        model: agentConfig?.model || "gpt-4o-mini",
        temperature: agentConfig?.temperature || 0.7,
        trainingFiles: agentConfig?.trainingFiles || [],
        detectEmotion: agentConfig?.detectEmotion || false,
        stream: true
      }, apiKey, {
        onMessage: (chunk) => {
          // Accumulate response
          currentResponseRef.current += chunk;
          
          // Update message in real-time
          updateMessage(assistantMessageId, currentResponseRef.current);
          
          // Se temos uma frase completa, começamos a gerar áudio
          if (
            // Detectar finais de frases (termina com . ! ? ou múltiplos espaços)
            (chunk.includes('.') || chunk.includes('!') || chunk.includes('?') || 
             chunk.includes('\n\n') || chunk.includes('. ')) && 
            // Garantir que temos conteúdo suficiente para começar a síntese de voz
            currentResponseRef.current.length > 50 &&
            // Garantir que não estamos já tocando áudio
            !isPlaying
          ) {
            // Gerar e reproduzir áudio para o conteúdo atual
            generateAndPlaySpeech(currentResponseRef.current, selectedVoice);
          }
        },
        onComplete: async (fullMessage) => {
          console.log("Resposta completa recebida:", fullMessage.substring(0, 50) + "...");
          
          // Atualizar mensagem com resposta completa
          updateMessage(assistantMessageId, fullMessage);
          
          // Gerar áudio para resposta completa se ainda não tiver sido gerado
          if (agentConfig?.voice?.enabled && fullMessage) {
            generateAndPlaySpeech(fullMessage, selectedVoice);
          }
          
          setIsProcessing(false);
          processingAudioRef.current = false;
          currentStreamingMessageId.current = null;
        },
        onError: (error) => {
          console.error("Erro ao obter resposta em streaming:", error);
          toast.error("Erro ao obter resposta do assistente", {
            description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido"
          });
          setIsProcessing(false);
          processingAudioRef.current = false;
          currentStreamingMessageId.current = null;
        }
      });
    } catch (error) {
      console.error("Erro ao processar áudio:", error);
      toast.error("Erro ao processar áudio", {
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido"
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
        console.log(`Tentativa ${retryCountRef.current} de transcrição falhou, tentando novamente...`);
        toast.warning(`Tentativa de transcrição falhou, tentando novamente (${retryCountRef.current}/${MAX_RETRIES})...`);
        // Aguarda um curto período antes de tentar novamente (backoff exponencial)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCountRef.current));
        return transcribeAudioWithRetry(audioBlob);
      } else {
        console.error("Número máximo de tentativas excedido");
        throw error;
      }
    }
  };

  const generateAndPlaySpeech = async (text: string, voiceId: string) => {
    if (!agentConfig?.voice?.enabled) return;
    
    try {
      console.log("Gerando resposta de voz com voz:", voiceId);
      
      const speechAudioBuffer = await generateSpeech(
        text, 
        voiceId, 
        apiKey
      );
      
      const speechBlob = new Blob([speechAudioBuffer], { type: 'audio/mpeg' });
      const speechURL = URL.createObjectURL(speechBlob);
      
      // Usar o hook para reproduzir o áudio
      playAudio(speechURL);
    } catch (speechError) {
      console.error("Erro ao gerar fala:", speechError);
      toast.error("Erro ao gerar fala", {
        description: "Não foi possível sintetizar a resposta em áudio."
      });
    }
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
          Falando... (Fale e faça pausas naturais para resposta)
        </div>
      )}
      
      {isProcessing && (
        <div className="text-center text-sm text-muted-foreground">
          Processando áudio...
        </div>
      )}
      
      {audioURL && (
        <audio ref={audioRef} className="hidden" />
      )}
    </div>
  );
};

export default VoiceChatAgent;

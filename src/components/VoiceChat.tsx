
import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize media recorder
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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          const transcript = await transcribeAudio(audioBlob, apiKey);
          
          if (transcript) {
            addMessage(transcript, "user");
          } else {
            toast.error("Couldn't transcribe your message. Please try again.");
          }
        } catch (error) {
          console.error("Transcription error:", error);
          toast.error("Error transcribing audio. Please try again.");
        }
        
        // Clear recording time and chunks
        setRecordingTime(0);
        audioChunksRef.current = [];
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
      // Start recording timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Couldn't access your microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop all tracks in the stream
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      
      setIsRecording(false);
      
      // Clear the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Toggle voice chat
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

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      <Button
        variant="outline"
        size="icon"
        className={`rounded-full w-12 h-12 ${isVoiceChatActive ? 'bg-red-100 hover:bg-red-200 text-red-500' : ''}`}
        onClick={toggleVoiceChat}
      >
        {isVoiceChatActive ? (
          <PhoneOff className="h-5 w-5" />
        ) : (
          <Phone className="h-5 w-5" />
        )}
      </Button>
      
      {isVoiceChatActive && (
        <div className="mt-4 flex flex-col items-center">
          <Button
            variant={isRecording ? "destructive" : "secondary"}
            size="icon"
            className={`rounded-full w-14 h-14 ${isRecording ? 'animate-pulse' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
          
          {isRecording && (
            <div className="mt-2 text-sm font-medium text-red-500">
              Recording {formatTime(recordingTime)}
            </div>
          )}
          
          {!isRecording && (
            <p className="mt-2 text-xs text-muted-foreground">
              Press to start recording
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceChat;

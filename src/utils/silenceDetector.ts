
/**
 * SilenceDetector - Utilitário para detecção de silêncio em gravações de áudio
 */

export class SilenceDetector {
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private audioLevels: number[] = [];
  private silenceStartTime: number = 0;
  private voiceDetected: boolean = false;
  private onSilenceDetected: (() => void) | null = null;
  private animationFrame: number | null = null;
  private isActive: boolean = false;
  private consecutiveSilenceCount: number = 0;
  private silenceLogged: boolean = false;

  // Configurações
  private silenceThreshold: number = 0.5; // Nível de silêncio (0-100)
  private minVoiceLevel: number = 1.0;    // Nível mínimo para considerar como voz
  private silenceDuration: number = 600;  // Duração do silêncio em ms para considerar como pausa
  private minRecordingDuration: number = 400; // Duração mínima da gravação antes de considerar silêncio
  private recordingStartTime: number = 0;
  
  /**
   * Inicializa o detector de silêncio com um stream de mídia
   */
  public initialize(
    stream: MediaStream, 
    onSilenceDetected: () => void, 
    config?: {
      silenceThreshold?: number;
      minVoiceLevel?: number;
      silenceDuration?: number;
      minRecordingDuration?: number;
    }
  ) {
    this.cleanup();
    
    this.recordingStartTime = Date.now();
    this.silenceStartTime = Date.now();
    this.voiceDetected = false;
    this.isActive = true;
    this.audioLevels = [];
    this.consecutiveSilenceCount = 0;
    this.silenceLogged = false;
    this.onSilenceDetected = onSilenceDetected;
    
    // Aplicar configurações personalizadas se fornecidas
    if (config) {
      this.silenceThreshold = config.silenceThreshold ?? this.silenceThreshold;
      this.minVoiceLevel = config.minVoiceLevel ?? this.minVoiceLevel;
      this.silenceDuration = config.silenceDuration ?? this.silenceDuration;
      this.minRecordingDuration = config.minRecordingDuration ?? this.minRecordingDuration;
    }
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      const microphone = this.audioContext.createMediaStreamSource(stream);
      
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.1; // Resposta rápida
      microphone.connect(this.analyser);
      
      console.log("SilenceDetector initialized with settings:", {
        silenceThreshold: this.silenceThreshold,
        minVoiceLevel: this.minVoiceLevel, 
        silenceDuration: this.silenceDuration,
        minRecordingDuration: this.minRecordingDuration
      });
      
      this.startMonitoring();
      return true;
    } catch (error) {
      console.error("Failed to initialize SilenceDetector:", error);
      return false;
    }
  }
  
  /**
   * Inicia o monitoramento de áudio
   */
  private startMonitoring() {
    if (!this.analyser || !this.isActive) return;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const checkAudioLevel = () => {
      if (!this.isActive || !this.analyser) return;
      
      // Obter dados de frequência
      this.analyser.getByteFrequencyData(dataArray);
      
      // Calcular nível médio de áudio
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const averageLevel = sum / bufferLength;
      
      // Adicionar ao histórico de níveis
      this.audioLevels.push(averageLevel);
      if (this.audioLevels.length > 10) {
        this.audioLevels.shift(); // Manter apenas os 10 valores mais recentes
      }
      
      const currentTime = Date.now();
      
      // Log periódico (a cada ~250ms)
      if (currentTime % 250 < 50) {
        console.log(`SilenceDetector: audio=${averageLevel.toFixed(1)}, voice=${this.voiceDetected}, silence=${this.consecutiveSilenceCount}, elapsed=${currentTime - this.silenceStartTime}ms`);
      }
      
      // Verificar se é voz
      if (averageLevel > this.minVoiceLevel) {
        if (!this.voiceDetected) {
          console.log(`Voice detected with level: ${averageLevel.toFixed(1)}`);
          this.voiceDetected = true;
        }
        
        this.consecutiveSilenceCount = 0;
        this.silenceStartTime = currentTime;
        this.silenceLogged = false;
      }
      
      // Verificar silêncio após certo tempo de gravação
      this.checkForSilence(currentTime);
      
      if (this.isActive) {
        this.animationFrame = requestAnimationFrame(checkAudioLevel);
      }
    };
    
    this.animationFrame = requestAnimationFrame(checkAudioLevel);
  }
  
  /**
   * Verifica se há silêncio contínuo após detecção de voz
   */
  private checkForSilence(currentTime: number) {
    const recordingDuration = currentTime - this.recordingStartTime;
    const silenceDuration = currentTime - this.silenceStartTime;
    
    // Verificar só depois de ter gravado o mínimo necessário
    if (recordingDuration < this.minRecordingDuration) return;
    
    // Verificar se a maioria dos níveis recentes está abaixo do limiar
    const recentLevels = this.audioLevels.slice(-5);
    const silentSamples = recentLevels.filter(level => level < this.silenceThreshold).length;
    const isSilent = recentLevels.length > 0 && silentSamples >= Math.ceil(recentLevels.length * 0.6);
    
    if (isSilent) {
      this.consecutiveSilenceCount++;
      
      if (!this.silenceLogged) {
        console.log(`SilenceDetector: Silence detected (${silentSamples}/${recentLevels.length}), elapsed=${silenceDuration}ms, levels=[${recentLevels.map(l => l.toFixed(1)).join(', ')}]`);
        this.silenceLogged = true;
      }
    } else {
      if (this.consecutiveSilenceCount > 0) {
        console.log(`SilenceDetector: Resetting silence counter, levels=[${recentLevels.map(l => l.toFixed(1)).join(', ')}]`);
      }
      this.consecutiveSilenceCount = 0;
      this.silenceStartTime = currentTime;
      this.silenceLogged = false;
    }
    
    // Verificar se houve voz antes e se o silêncio é longo o suficiente
    if (this.voiceDetected && 
        silenceDuration > this.silenceDuration &&
        isSilent) {
      
      console.log(`SilenceDetector: Sufficient silence detected (${silenceDuration}ms > ${this.silenceDuration}ms), triggering callback`);
      this.notifySilenceDetected();
    }
  }
  
  /**
   * Notifica o callback de detecção de silêncio
   */
  private notifySilenceDetected() {
    if (this.isActive && this.onSilenceDetected) {
      // Desativar antes de chamar o callback para evitar chamadas múltiplas
      this.isActive = false;
      
      // Chamar o callback
      this.onSilenceDetected();
    }
  }
  
  /**
   * Limpa todos os recursos
   */
  public cleanup() {
    this.isActive = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        console.error("Error closing audio context:", e);
      }
      this.audioContext = null;
      this.analyser = null;
    }
    
    this.audioLevels = [];
    this.consecutiveSilenceCount = 0;
    this.voiceDetected = false;
    
    console.log("SilenceDetector cleanup completed");
  }
  
  /**
   * Retorna se voz foi detectada durante a gravação atual
   */
  public hasVoiceBeenDetected(): boolean {
    return this.voiceDetected;
  }
}

// Instância singleton para uso em toda a aplicação
export const silenceDetector = new SilenceDetector();

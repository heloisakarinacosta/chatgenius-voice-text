
// src/utils/silenceDetector.ts

interface SilenceDetectorConfig {
  silenceThreshold: number;
  minVoiceLevel: number;
  silenceDuration: number;
  minRecordingDuration: number;
  consecutiveSilenceThreshold: number;
}

class SilenceDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private stream: MediaStream | null = null;
  private audioLevels: number[] = [];
  private voiceDetected: boolean = false;
  private consecutiveSilenceCount: number = 0;
  private silenceStartTime: number = 0;
  private recordingStartTime: number = 0;
  private animationFrameId: number | null = null;
  private silenceCallback: (() => void) | null = null;
  private checkSilenceIntervalId: number | null = null;
  
  // Configurações
  private silenceThreshold: number = 0.5;
  private minVoiceLevel: number = 1.0;
  private silenceDuration: number = 800;
  private minRecordingDuration: number = 1000;
  private consecutiveSilenceThreshold: number = 8;
  
  private initialized: boolean = false;
  private debugMode: boolean = true;
  private continuousMode: boolean = true;
  
  initialize(
    stream: MediaStream, 
    silenceCallback: () => void, 
    config?: Partial<SilenceDetectorConfig>
  ) {
    // Limpar recursos anteriores se existirem
    this.cleanup();
    
    if (config) {
      this.silenceThreshold = config.silenceThreshold ?? this.silenceThreshold;
      this.minVoiceLevel = config.minVoiceLevel ?? this.minVoiceLevel;
      this.silenceDuration = config.silenceDuration ?? this.silenceDuration;
      this.minRecordingDuration = config.minRecordingDuration ?? this.minRecordingDuration;
      this.consecutiveSilenceThreshold = config.consecutiveSilenceThreshold ?? this.consecutiveSilenceThreshold;
    }
    
    this.stream = stream;
    this.silenceCallback = silenceCallback;
    this.recordingStartTime = Date.now();
    this.silenceStartTime = Date.now();
    this.audioLevels = [];
    this.voiceDetected = false;
    this.consecutiveSilenceCount = 0;
    
    this.setupAudioAnalysis();
    this.startSilenceDetection();
    
    this.initialized = true;
    
    this.log("SilenceDetector initialized with config:", {
      silenceThreshold: this.silenceThreshold,
      minVoiceLevel: this.minVoiceLevel,
      silenceDuration: this.silenceDuration,
      minRecordingDuration: this.minRecordingDuration,
      consecutiveSilenceThreshold: this.consecutiveSilenceThreshold,
      continuousMode: this.continuousMode
    });
  }
  
  setContinuousMode(enabled: boolean) {
    this.continuousMode = enabled;
    this.log(`Continuous mode ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  private log(...args: any[]) {
    if (this.debugMode) {
      console.log("[SilenceDetector]", ...args);
    }
  }
  
  private setupAudioAnalysis() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      
      // Configurações otimizadas para detecção de voz
      this.analyser.fftSize = 1024; // Mais detalhado para melhor análise de frequência
      this.analyser.smoothingTimeConstant = 0.5; // Boa suavização sem perder resposta rápida
      
      // Filtro passa-alta para reduzir ruídos de baixa frequência
      const highpassFilter = this.audioContext.createBiquadFilter();
      highpassFilter.type = "highpass";
      highpassFilter.frequency.value = 85; // Filtra ruído abaixo da voz humana típica
      
      // Filtro passa-baixa para reduzir ruídos de alta frequência
      const lowpassFilter = this.audioContext.createBiquadFilter();
      lowpassFilter.type = "lowpass";
      lowpassFilter.frequency.value = 3500; // Mantém a maior parte da fala humana
      
      // Criação do buffer para análise
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      
      // Conectar o stream aos filtros e analisador
      const microphone = this.audioContext.createMediaStreamSource(this.stream!);
      microphone.connect(highpassFilter);
      highpassFilter.connect(lowpassFilter);
      lowpassFilter.connect(this.analyser);
      
      this.log("Audio analysis setup completed successfully");
    } catch (error) {
      console.error("[SilenceDetector] Error setting up audio analysis:", error);
    }
  }
  
  private startSilenceDetection() {
    if (!this.analyser || !this.dataArray) {
      console.error("[SilenceDetector] Analyzer not initialized");
      return;
    }
    
    // Monitorar níveis de áudio continuamente
    const checkAudioLevel = () => {
      if (!this.analyser || !this.dataArray) return;
      
      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Focamos nas frequências da voz humana (85Hz-255Hz)
      let voiceSum = 0;
      let voiceCount = 0;
      
      // Cálculo aproximado de bins para frequências específicas da voz
      // Para fftSize 1024, cada bin é ~21Hz (taxa de amostragem 44100/2 dividido por frequencyBinCount)
      const startBin = Math.floor(85 / 21); // ~4
      const endBin = Math.floor(255 / 21);  // ~12
      
      for (let i = startBin; i < endBin && i < this.dataArray.length; i++) {
        voiceSum += this.dataArray[i];
        voiceCount++;
      }
      
      // Calcular média geral
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      
      const average = sum / this.dataArray.length;
      const voiceAverage = voiceSum / (voiceCount || 1);
      
      // Dar mais peso à faixa de voz humana
      const weightedAverage = (voiceAverage * 0.8) + (average * 0.2);
      const normalizedValue = weightedAverage / 256; // Normalizar para 0-1
      
      // Adicionar ao histórico de níveis
      this.audioLevels.push(normalizedValue * 6); // Amplificamos o valor para ter melhor sensibilidade
      
      // Manter apenas os últimos N níveis
      if (this.audioLevels.length > 20) {
        this.audioLevels.shift();
      }
      
      // Verificar se há voz (com histerese para evitar oscilações)
      const recentLevels = this.audioLevels.slice(-5);
      const recentAverage = recentLevels.reduce((sum, level) => sum + level, 0) / recentLevels.length;
      
      // Detecção de voz com histerese
      if (recentAverage > this.minVoiceLevel + 0.2) {
        if (!this.voiceDetected) {
          this.log(`Voice detected with level: ${recentAverage.toFixed(2)} (threshold: ${this.minVoiceLevel.toFixed(2)})`);
          
          // Feedback sonoro (opcional)
          this.playDetectionTone(660, 0.05, 0.1);
        }
        
        this.voiceDetected = true;
        this.consecutiveSilenceCount = 0;
        this.silenceStartTime = Date.now();
      }
      
      // Log de amostra a cada 1 segundo
      if (Date.now() % 1000 < 50) {
        this.log(
          `Audio levels: weighted=${recentAverage.toFixed(2)}, ` +
          `voice=${this.voiceDetected}, silence=${this.consecutiveSilenceCount}/${this.consecutiveSilenceThreshold}, ` +
          `elapsed=${Date.now() - this.silenceStartTime}ms`
        );
      }
      
      // Continuar monitorando enquanto estiver inicializado
      if (this.initialized) {
        this.animationFrameId = requestAnimationFrame(checkAudioLevel);
      }
    };
    
    // Iniciar loop de monitoramento
    this.animationFrameId = requestAnimationFrame(checkAudioLevel);
    
    // Verificar silêncio em intervalos regulares
    this.checkSilenceIntervalId = window.setInterval(() => {
      this.checkForSilence();
    }, 50) as unknown as number;
  }
  
  private checkForSilence() {
    if (!this.initialized || !this.continuousMode) return;
    
    const currentTime = Date.now();
    const elapsedSilence = currentTime - this.silenceStartTime;
    const recordingLength = currentTime - this.recordingStartTime;
    
    // Calcular média dos últimos níveis de áudio
    const recentLevels = this.audioLevels.slice(-10);
    const avgLevel = recentLevels.reduce((sum, level) => sum + level, 0) / 
                     (recentLevels.length || 1);
    
    // Considerar silêncio se nível médio estiver abaixo do limiar
    const isSilent = avgLevel < this.silenceThreshold;
    
    // Log detalhado a cada segundo
    if (currentTime % 1000 < 50) {
      this.log(
        `Silence check: avgLevel=${avgLevel.toFixed(2)}, ` +
        `threshold=${this.silenceThreshold}, ` +
        `isSilent=${isSilent}, ` +
        `count=${this.consecutiveSilenceCount}/${this.consecutiveSilenceThreshold}, ` +
        `elapsedSilence=${elapsedSilence}ms`
      );
    }
    
    if (isSilent) {
      this.consecutiveSilenceCount += 1;
      
      // Log quando começamos a detectar silêncio
      if (this.consecutiveSilenceCount === 3) {
        this.log(`Silence detected (${this.consecutiveSilenceCount}/${this.consecutiveSilenceThreshold}), avg level=${avgLevel.toFixed(2)}, threshold=${this.silenceThreshold}`);
      }
      
      // Log a cada 5 contagens
      if (this.consecutiveSilenceCount % 5 === 0 && this.consecutiveSilenceCount > 3) {
        this.log(`Silence continuing: count=${this.consecutiveSilenceCount}, level=${avgLevel.toFixed(2)}`);
      }
    } else {
      if (this.consecutiveSilenceCount > 0) {
        this.log(`Resetting silence counter after ${this.consecutiveSilenceCount} samples, current level=${avgLevel.toFixed(2)}`);
      }
      this.consecutiveSilenceCount = 0;
      this.silenceStartTime = currentTime;
    }
    
    // Condições para considerar o silêncio suficiente para parar a gravação:
    // 1. Voz foi detectada anteriormente
    // 2. Gravação durou pelo menos o mínimo de tempo
    // 3. Temos amostras de silêncio consecutivas suficientes
    //    OU um período longo de silêncio total
    if (this.voiceDetected && 
        recordingLength > this.minRecordingDuration && 
        (this.consecutiveSilenceCount >= this.consecutiveSilenceThreshold || 
         elapsedSilence > this.silenceDuration * 1.5)) {
      
      this.log(`Sufficient silence detected: ${this.consecutiveSilenceCount} samples or ${elapsedSilence}ms > ${this.silenceDuration}ms`);
      this.log(`Recording length: ${recordingLength}ms, minimum: ${this.minRecordingDuration}ms`);
      this.log(`Notifying silence detected callback`);
      
      // Executar callback de silêncio
      if (this.silenceCallback) {
        // Feedback sonoro de fim (opcional)
        this.playDetectionTone(440, 0.05, 0.15);
        
        setTimeout(() => {
          if (this.silenceCallback) {
            this.silenceCallback();
          }
        }, 100);
      }
      
      // Limpar este verificador para evitar múltiplas chamadas
      this.cleanup();
    }
  }
  
  private playDetectionTone(frequency: number, volume: number, duration: number) {
    try {
      if (!this.audioContext) return;
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (e) {
      // Ignorar erros do feedback sonoro
    }
  }
  
  hasVoiceBeenDetected(): boolean {
    return this.voiceDetected;
  }
  
  getAudioLevels(): number[] {
    return [...this.audioLevels];
  }
  
  getConsecutiveSilenceCount(): number {
    return this.consecutiveSilenceCount;
  }
  
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
  
  cleanup() {
    this.log("Cleaning up silence detector resources");
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.checkSilenceIntervalId !== null) {
      clearInterval(this.checkSilenceIntervalId);
      this.checkSilenceIntervalId = null;
    }
    
    // Não fechar o audioContext aqui, apenas desconectar o analisador
    // pois pode estar sendo usado por outras partes da aplicação
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch (e) {
        // Ignora erro se já desconectado
      }
      this.analyser = null;
    }
    
    this.initialized = false;
    this.silenceCallback = null;
    this.dataArray = null;
    
    // Manter audioLevels e voiceDetected para consulta posterior
  }
}

// Exportar uma única instância para uso em toda a aplicação
export const silenceDetector = new SilenceDetector();

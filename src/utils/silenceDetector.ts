
/**
 * SilenceDetector - Utilitário para detecção de silêncio em gravações de áudio
 * Otimizado para compatibilidade entre plataformas
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
  private calibrated: boolean = false;
  private platformAdjustment: number = 1.0; // Ajuste específico por plataforma

  // Configurações
  private silenceThreshold: number = 0.5; // Reduzido para ser menos restritivo (0-100)
  private minVoiceLevel: number = 0.8;    // Reduzido para detectar vozes mais baixas
  private silenceDuration: number = 800;  // Duração do silêncio em ms para considerar como pausa (ajustado)
  private minRecordingDuration: number = 1000; // Duração mínima da gravação antes de considerar silêncio
  private recordingStartTime: number = 0;
  private consecutiveSilenceThreshold: number = 5; // Precisamos de N amostras consecutivas de silêncio
  private voiceThresholdMultiplier: number = 1.1; // Multiplicador usado para determinar se há voz
  private continuousModeEnabled: boolean = true; // Enable continuous response during conversation
  
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
      consecutiveSilenceThreshold?: number;
      continuousModeEnabled?: boolean;
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
    this.calibrated = false;
    
    // Detectar sistema operacional para ajustes específicos
    this.detectPlatform();
    
    // Aplicar configurações personalizadas se fornecidas
    if (config) {
      this.silenceThreshold = config.silenceThreshold ?? this.silenceThreshold;
      this.minVoiceLevel = config.minVoiceLevel ?? this.minVoiceLevel;
      this.silenceDuration = config.silenceDuration ?? this.silenceDuration;
      this.minRecordingDuration = config.minRecordingDuration ?? this.minRecordingDuration;
      this.consecutiveSilenceThreshold = config.consecutiveSilenceThreshold ?? this.consecutiveSilenceThreshold;
      this.continuousModeEnabled = config.continuousModeEnabled ?? this.continuousModeEnabled;
    }
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      
      // Configurações otimizadas para melhor detecção de fala
      this.analyser.fftSize = 1024; // Aumentado para maior precisão em Windows
      this.analyser.smoothingTimeConstant = 0.5; // Bom valor para suavizar variações
      
      // Adicionar um filtro passa-alta para reduzir ruído de baixa frequência
      const highpassFilter = this.audioContext.createBiquadFilter();
      highpassFilter.type = "highpass";
      highpassFilter.frequency.value = 85; // Hz - reduz ruído de baixa frequência
      
      // Adicionar filtro passa-baixa para foco na voz (até ~3.5kHz)
      const lowpassFilter = this.audioContext.createBiquadFilter();
      lowpassFilter.type = "lowpass";
      lowpassFilter.frequency.value = 3500; // Hz - atenua frequências acima da voz humana
      
      const microphone = this.audioContext.createMediaStreamSource(stream);
      
      // Conectar a cadeia de processamento de áudio
      microphone.connect(highpassFilter);
      highpassFilter.connect(lowpassFilter);
      lowpassFilter.connect(this.analyser);
      
      console.log("SilenceDetector initialized with settings:", {
        silenceThreshold: this.silenceThreshold,
        minVoiceLevel: this.minVoiceLevel, 
        silenceDuration: this.silenceDuration,
        minRecordingDuration: this.minRecordingDuration,
        consecutiveSilenceThreshold: this.consecutiveSilenceThreshold,
        platformAdjustment: this.platformAdjustment,
        continuousModeEnabled: this.continuousModeEnabled,
        fftSize: this.analyser.fftSize
      });
      
      // Iniciar auto-calibração antes do monitoramento
      this.calibrateMicrophone().then(() => {
        this.startMonitoring();
      });
      
      return true;
    } catch (error) {
      console.error("Failed to initialize SilenceDetector:", error);
      return false;
    }
  }
  
  /**
   * Detecta a plataforma e faz ajustes específicos
   */
  private detectPlatform(): void {
    const userAgent = window.navigator.userAgent.toLowerCase();
    
    // Ajustes específicos por plataforma
    if (userAgent.indexOf('windows') !== -1) {
      console.log("Windows platform detected, adjusting sensitivity");
      this.platformAdjustment = 0.8; // Sensibilidade reduzida para Windows
      this.consecutiveSilenceThreshold = 6; // Reduzido de 8 para 6
    } else if (userAgent.indexOf('mac') !== -1) {
      console.log("Mac platform detected, using standard settings");
      this.platformAdjustment = 1.0;
    } else if (userAgent.indexOf('android') !== -1 || userAgent.indexOf('iphone') !== -1) {
      console.log("Mobile platform detected, increasing sensitivity");
      this.platformAdjustment = 1.2; // Sensibilidade aumentada para dispositivos móveis
      this.consecutiveSilenceThreshold = 4; // Reduzido ainda mais para mobile
    } else if (userAgent.indexOf('linux') !== -1) {
      console.log("Linux platform detected, adjusting sensitivity");
      this.platformAdjustment = 0.9;
      this.consecutiveSilenceThreshold = 5; // Valor intermediário para Linux
    }
    
    // Ajustar thresholds com base na plataforma
    this.silenceThreshold *= this.platformAdjustment;
    this.minVoiceLevel *= this.platformAdjustment;
  }
  
  /**
   * Calibra automaticamente o microfone para se adaptar ao ambiente
   */
  private async calibrateMicrophone(): Promise<void> {
    if (!this.analyser || !this.isActive) return;
    
    console.log("Iniciando calibração do microfone...");
    
    // Coletar amostras por 1 segundo (reduzido para calibração mais rápida)
    const sampleDuration = 1000;
    const startTime = Date.now();
    const samples: number[] = [];
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    return new Promise<void>(resolve => {
      const collectSample = () => {
        if (Date.now() - startTime < sampleDuration && this.analyser && this.isActive) {
          this.analyser.getByteFrequencyData(dataArray);
          
          // Foco em frequências relevantes para voz humana (85Hz-255Hz)
          let voiceSum = 0;
          let voiceCount = 0;
          
          // Cálculo aproximado: cada bin representa frequência baseada no fftSize
          const binSize = 22050 / (bufferLength * 2);
          const startBin = Math.floor(85 / binSize); 
          const endBin = Math.floor(255 / binSize);
          
          // Somar níveis nas frequências de voz humana
          for (let i = startBin; i < endBin && i < bufferLength; i++) {
            voiceSum += dataArray[i];
            voiceCount++;
          }
          
          // Calcular média geral
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          
          const average = sum / bufferLength;
          const voiceAverage = voiceSum / (voiceCount || 1);
          const weightedAverage = (voiceAverage * 0.7) + (average * 0.3);
          
          samples.push(weightedAverage);
          
          requestAnimationFrame(collectSample);
        } else {
          // Processar amostras
          if (samples.length > 0 && this.isActive) {
            // Ordenar amostras e pegar o 75º percentil como nível de ruído ambiente
            const sortedSamples = [...samples].sort((a, b) => a - b);
            const percentile75 = sortedSamples[Math.floor(samples.length * 0.75)];
            
            // Ajustar SILENCE_THRESHOLD para 20% acima do ruído ambiente
            this.silenceThreshold = Math.max(0.5, (percentile75 / 256) * 4 * 1.2);
            
            // Ajustar MIN_VOICE_LEVEL para 80% acima do ruído ambiente (reduzido de 100% para aumentar sensibilidade)
            this.minVoiceLevel = Math.max(0.7, (percentile75 / 256) * 4 * 1.8);
            
            // Aplicar ajuste de plataforma após calibração
            this.silenceThreshold *= this.platformAdjustment;
            this.minVoiceLevel *= this.platformAdjustment;
            
            console.log(`Calibração concluída: ruído ambiente=${(percentile75 / 256 * 4).toFixed(2)}, ` + 
                        `novo silence threshold=${this.silenceThreshold.toFixed(2)}, ` +
                        `novo voice level=${this.minVoiceLevel.toFixed(2)}`);
            
            this.calibrated = true;
          } else {
            console.log("Falha na calibração - sem amostras ou detector inativo");
          }
          
          resolve();
        }
      };
      
      collectSample();
    });
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
      
      // Foco em frequências relevantes para voz humana (85Hz-255Hz)
      let voiceSum = 0;
      let voiceCount = 0;
      
      // Cálculo baseado no fftSize atual
      const binSize = 22050 / (bufferLength * 2);
      const startBin = Math.floor(85 / binSize); 
      const endBin = Math.floor(255 / binSize);
      
      // Somar apenas as frequências de voz típicas
      for (let i = startBin; i < endBin && i < bufferLength; i++) {
        voiceSum += dataArray[i];
        voiceCount++;
      }
      
      // Calcular média geral e média na faixa de voz
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      
      const average = sum / bufferLength;
      const voiceAverage = voiceSum / (voiceCount || 1);
      
      // Dar maior peso à faixa de voz humana
      const weightedAverage = (voiceAverage * 0.7) + (average * 0.3);
      const normalizedLevel = weightedAverage / 256 * 4; // Normalizar para faixa similar aos valores anteriores
      
      // Adicionar ao histórico de níveis
      this.audioLevels.push(normalizedLevel);
      if (this.audioLevels.length > 20) { // Manter histórico mais longo
        this.audioLevels.shift();
      }
      
      const currentTime = Date.now();
      
      // Log periódico (a cada ~1s)
      if (currentTime % 1000 < 50) {
        console.log(`SilenceDetector: weighted=${normalizedLevel.toFixed(2)}, voice=${this.voiceDetected}, silence=${this.consecutiveSilenceCount}/${this.consecutiveSilenceThreshold}, elapsed=${currentTime - this.silenceStartTime}ms`);
      }
      
      // Verificar se é voz com histerese (evita oscilações)
      const recentLevels = this.audioLevels.slice(-5);
      const recentAverage = recentLevels.reduce((sum, val) => sum + val, 0) / (recentLevels.length || 1);
      
      // Reduzido o theshold para detectar voz mais facilmente
      if (recentAverage > this.minVoiceLevel * this.voiceThresholdMultiplier) {
        if (!this.voiceDetected) {
          console.log(`Voice detected with level: ${recentAverage.toFixed(2)} (threshold: ${this.minVoiceLevel.toFixed(2)})`);
          this.voiceDetected = true;
          
          // Produzir som sutil de feedback se for a primeira detecção de voz
          try {
            if (this.audioContext && this.audioLevels.length <= 5) {
              const oscillator = this.audioContext.createOscillator();
              const gainNode = this.audioContext.createGain();
              
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(660, this.audioContext.currentTime);
              gainNode.gain.setValueAtTime(0.03, this.audioContext.currentTime); // Bem baixo
              
              oscillator.connect(gainNode);
              gainNode.connect(this.audioContext.destination);
              
              oscillator.start();
              oscillator.stop(this.audioContext.currentTime + 0.1);
            }
          } catch (e) {
            // Ignorar erros do som de feedback
          }
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
    
    // Obter média móvel de mais amostras (10 em vez de 5)
    const recentLevels = this.audioLevels.slice(-10);
    
    // Calcular média dos níveis recentes para melhor estabilidade
    const avgLevel = recentLevels.reduce((sum, level) => sum + level, 0) / 
                  (recentLevels.length || 1);
    
    // Considerar como silêncio se a média estiver abaixo do limiar
    const isSilent = avgLevel < this.silenceThreshold;
    
    if (isSilent) {
      this.consecutiveSilenceCount++;
      
      if (!this.silenceLogged && this.consecutiveSilenceCount > 2) {
        console.log(`SilenceDetector: Silence detected (${this.consecutiveSilenceCount}/${this.consecutiveSilenceThreshold}), avg level=${avgLevel.toFixed(2)}, threshold=${this.silenceThreshold.toFixed(2)}`);
        this.silenceLogged = true;
      }
    } else {
      if (this.consecutiveSilenceCount > 0) {
        console.log(`SilenceDetector: Resetting silence counter after ${this.consecutiveSilenceCount} samples, current level=${avgLevel.toFixed(2)}`);
        this.silenceLogged = false;
      }
      this.consecutiveSilenceCount = 0;
      this.silenceStartTime = currentTime;
    }
    
    // Condição modificada para modo contínuo de conversação:
    // Notifica silêncio apenas se voz foi detectada E:
    // 1. Temos amostras consecutivas suficientes de silêncio OU
    // 2. Temos um longo período de silêncio total
    const silenceThresholdReached = this.consecutiveSilenceCount >= this.consecutiveSilenceThreshold;
    const longSilenceDetected = silenceDuration > (this.continuousModeEnabled ? this.silenceDuration : this.silenceDuration * 1.5);
    
    if (this.voiceDetected && (silenceThresholdReached || longSilenceDetected)) {
      console.log(`SilenceDetector: Sufficient silence detected: ${this.consecutiveSilenceCount} samples or ${silenceDuration}ms > ${this.silenceDuration}ms`);
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
      console.log("SilenceDetector: Notifying silence detected callback");
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
    this.calibrated = false;
    
    console.log("SilenceDetector cleanup completed");
  }
  
  /**
   * Retorna se voz foi detectada durante a gravação atual
   */
  public hasVoiceBeenDetected(): boolean {
    return this.voiceDetected;
  }
  
  /**
   * Retorna se o microfone foi calibrado
   */
  public isCalibrated(): boolean {
    return this.calibrated;
  }
  
  /**
   * Retorna o nível médio de áudio recente
   */
  public getRecentAudioLevel(): number {
    if (this.audioLevels.length === 0) return 0;
    return this.audioLevels.slice(-5).reduce((sum, level) => sum + level, 0) / 
           Math.min(5, this.audioLevels.length);
  }
  
  /**
   * Define se o modo contínuo está ativado
   */
  public setContinuousMode(enabled: boolean): void {
    this.continuousModeEnabled = enabled;
  }
  
  /**
   * Retorna se o modo contínuo está ativado
   */
  public isContinuousModeEnabled(): boolean {
    return this.continuousModeEnabled;
  }
}

// Instância singleton para uso em toda a aplicação
export const silenceDetector = new SilenceDetector();

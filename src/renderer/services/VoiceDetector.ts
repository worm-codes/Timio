export class VoiceDetector {
  private enabled: boolean = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private checkIntervalId: number | null = null;
  private isVoiceActive: boolean = false;
  private silenceThreshold: number = -35; // dB threshold for silence (higher = requires louder voice)
  private lastVoiceTime: number = 0;
  private consecutiveVoiceChecks: number = 0; // Track consecutive voice detections
  private consecutiveSilenceChecks: number = 0; // Track consecutive silence detections
  private readonly VOICE_CONFIRM_COUNT: number = 3; // Require 3 consecutive checks to confirm voice
  private readonly SILENCE_CONFIRM_COUNT: number = 6; // Require 6 consecutive checks to confirm silence
  private deviceId: string = 'default'; // Selected microphone device ID

  constructor() {}

  setThreshold(threshold: number): void {
    this.silenceThreshold = threshold;
    console.log(`Voice threshold set to ${threshold} dB`);
  }

  setMicrophone(deviceId: string): void {
    this.deviceId = deviceId;
    console.log(`Microphone set to: ${deviceId}`);
    
    // If already running, restart with new microphone
    if (this.enabled && this.audioContext) {
      this.stop();
      this.start();
    }
  }

  async start(): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      // Request microphone access with selected device
      const constraints: MediaStreamConstraints = {
        audio: this.deviceId === 'default' 
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          : {
              deviceId: { exact: this.deviceId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
      };
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create audio context and analyser
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect microphone to analyser
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      // Start monitoring
      this.startMonitoring();
      
      console.log('Voice detection started');
      return true;
    } catch (error) {
      console.error('Failed to access microphone:', error);
      this.enabled = false;
      return false;
    }
  }

  stop(): void {
    this.stopMonitoring();

    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.isVoiceActive = false;
    this.lastVoiceTime = 0;
    this.consecutiveVoiceChecks = 0;
    this.consecutiveSilenceChecks = 0;
    
    console.log('Voice detection stopped');
  }

  private startMonitoring(): void {
    if (this.checkIntervalId !== null) {
      clearInterval(this.checkIntervalId);
    }

    // Check voice activity every 500ms
    this.checkIntervalId = window.setInterval(() => {
      this.checkVoiceActivity();
    }, 500);
  }

  private stopMonitoring(): void {
    if (this.checkIntervalId !== null) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }

  private checkVoiceActivity(): void {
    if (!this.analyser) return;

    // Get frequency data
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    
    // Convert to dB (approximate)
    const dB = 20 * Math.log10(average / 255);
    
    // Determine if current check detects voice
    const voiceDetectedNow = dB > this.silenceThreshold;

    // Use hysteresis to prevent flickering
    if (voiceDetectedNow) {
      this.consecutiveVoiceChecks++;
      this.consecutiveSilenceChecks = 0;
      
      // Only activate voice after sustained detection
      if (!this.isVoiceActive && this.consecutiveVoiceChecks >= this.VOICE_CONFIRM_COUNT) {
        this.isVoiceActive = true;
        this.lastVoiceTime = Date.now();
        console.log(`Voice STARTED: ${dB.toFixed(1)} dB (sustained for ${this.consecutiveVoiceChecks} checks)`);
      } else if (this.isVoiceActive) {
        this.lastVoiceTime = Date.now();
      }
    } else {
      this.consecutiveSilenceChecks++;
      this.consecutiveVoiceChecks = 0;
      
      // Only deactivate voice after sustained silence
      if (this.isVoiceActive && this.consecutiveSilenceChecks >= this.SILENCE_CONFIRM_COUNT) {
        this.isVoiceActive = false;
        console.log(`Voice STOPPED: ${dB.toFixed(1)} dB (silent for ${this.consecutiveSilenceChecks} checks)`);
      }
    }
  }

  isActive(): boolean {
    return this.isVoiceActive;
  }

  getTimeSinceLastVoice(): number {
    if (this.lastVoiceTime === 0) return Infinity;
    return Date.now() - this.lastVoiceTime;
  }

  setEnabled(enabled: boolean): void {
    const wasEnabled = this.enabled;
    this.enabled = enabled;

    if (enabled && !wasEnabled) {
      this.start();
    } else if (!enabled && wasEnabled) {
      this.stop();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

import * as Tone from 'tone';

export type SoundType = 'start' | 'pause' | 'stop' | 'break' | 'complete';

export class SoundManager {
  private enabled: boolean = true;
  private synth: Tone.Synth | null = null;
  private initialized: boolean = false;

  constructor() {
    // Load enabled state from localStorage
    const saved = localStorage.getItem('soundsEnabled');
    this.enabled = saved ? saved === 'true' : true;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Initialize Tone.js (requires user interaction)
    await Tone.start();
    
    // Create a synth for sound generation
    this.synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.05,
        decay: 0.1,
        sustain: 0.3,
        release: 0.5
      }
    }).toDestination();
    
    this.synth.volume.value = -10; // Softer volume
    this.initialized = true;
  }

  async play(type: SoundType): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.initialize();
      if (!this.synth) return;

      // Different sound patterns for each type
      const now = Tone.now();
      
      switch (type) {
        case 'start':
          // Positive ascending notes
          this.synth.triggerAttackRelease('C5', '0.15', now);
          this.synth.triggerAttackRelease('E5', '0.15', now + 0.1);
          this.synth.triggerAttackRelease('G5', '0.2', now + 0.2);
          break;
          
        case 'pause':
          // Single soft note
          this.synth.triggerAttackRelease('G4', '0.2', now);
          break;
          
        case 'stop':
          // Descending notes
          this.synth.triggerAttackRelease('E5', '0.15', now);
          this.synth.triggerAttackRelease('C5', '0.2', now + 0.1);
          break;
          
        case 'break':
          // Gentle, relaxing melody
          this.synth.triggerAttackRelease('A4', '0.3', now);
          this.synth.triggerAttackRelease('E4', '0.3', now + 0.2);
          this.synth.triggerAttackRelease('C4', '0.4', now + 0.4);
          break;
          
        case 'complete':
          // Success chime
          this.synth.triggerAttackRelease('C5', '0.15', now);
          this.synth.triggerAttackRelease('E5', '0.15', now + 0.1);
          this.synth.triggerAttackRelease('G5', '0.15', now + 0.2);
          this.synth.triggerAttackRelease('C6', '0.4', now + 0.3);
          break;
      }
    } catch (error) {
      console.warn(`Failed to play sound ${type}:`, error);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    localStorage.setItem('soundsEnabled', String(enabled));
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

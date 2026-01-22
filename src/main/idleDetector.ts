import { powerMonitor } from 'electron';
import { TimerEngine, TimerState } from './timerEngine';

export class IdleDetector {
  private timerEngine: TimerEngine;
  private checkIntervalId: NodeJS.Timeout | null = null;
  private checkInterval: number = 60 * 1000; // Dynamic, default 1 minute
  private idleThreshold: number = 5 * 60; // Default 5 minutes in seconds
  private enabled: boolean = true; // Default enabled
  private idleStartTime: number = 0; // Track when user became idle
  private wasIdlePaused: boolean = false; // Track if we paused due to idle
  private voiceDetectionEnabled: boolean = false; // Voice detection setting
  private isVoiceActive: boolean = false; // Current voice status
  private lastVoiceActivityTime: number = 0; // Last time voice was detected
  private wasVoiceActiveLastCheck: boolean = false; // Track if voice was active in previous check

  constructor(timerEngine: TimerEngine) {
    this.timerEngine = timerEngine;
    
    // Listen to timer state changes
    this.timerEngine.on('stateChange', (stateData) => {
      if ((stateData.state === TimerState.RUNNING || stateData.state === TimerState.IDLE_PAUSED) && stateData.isWorkPhase) {
        this.startMonitoring();
      } else if (stateData.state === TimerState.PAUSED || stateData.state === TimerState.STOPPED) {
        this.stopMonitoring();
      }
    });
  }

  private startMonitoring(): void {
    // Only monitor if enabled
    if (!this.enabled) return;
    
    // Clear any existing interval
    this.stopMonitoring();

    // Get current state to determine check frequency
    const currentState = this.timerEngine.getState();
    
    if (currentState.state === TimerState.IDLE_PAUSED) {
      // When idle paused, check very frequently (every 2 seconds) to detect user activity quickly
      this.checkInterval = 2 * 1000;
      console.log(`Starting frequent idle monitoring for resume detection: check every 2s`);
    } else {
      // When running, check frequently to catch idle state accurately
      // Use 5 seconds or threshold/4, whichever is smaller, to ensure we don't miss the idle threshold
      this.checkInterval = Math.min(5 * 1000, (this.idleThreshold * 1000) / 4);
      console.log(`Starting idle monitoring: check every ${this.checkInterval / 1000}s, threshold ${this.idleThreshold}s`);
    }

    // Start checking idle time
    this.checkIntervalId = setInterval(() => {
      this.checkIdleTime();
    }, this.checkInterval);
  }

  private stopMonitoring(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    this.wasIdlePaused = false;
    this.idleStartTime = 0;
  }

  private checkIdleTime(): void {
    // Get system idle time in seconds (only tracks mouse/keyboard)
    const systemIdleTime = powerMonitor.getSystemIdleTime();
    
    // Track voice activity changes - voice works just like keyboard/mouse
    if (this.voiceDetectionEnabled && this.isVoiceActive && !this.wasVoiceActiveLastCheck) {
      // Voice just started - mark as activity
      console.log('Voice activity started - resetting idle time');
      this.lastVoiceActivityTime = Date.now();
    } else if (this.voiceDetectionEnabled && this.isVoiceActive) {
      // Voice is ongoing - keep updating activity time
      this.lastVoiceActivityTime = Date.now();
    }
    
    this.wasVoiceActiveLastCheck = this.voiceDetectionEnabled && this.isVoiceActive;
    
    // Calculate effective idle time
    let effectiveIdleTime: number;
    
    if (this.voiceDetectionEnabled && this.isVoiceActive) {
      // Voice is currently active - idle time is 0
      effectiveIdleTime = 0;
    } else if (this.lastVoiceActivityTime > 0) {
      // Voice was active recently - calculate time since last voice activity
      const timeSinceVoice = Math.floor((Date.now() - this.lastVoiceActivityTime) / 1000);
      // Use the smaller of system idle or time since voice activity
      effectiveIdleTime = Math.min(systemIdleTime, timeSinceVoice);
    } else {
      // No voice activity - use system idle time
      effectiveIdleTime = systemIdleTime;
    }

    console.log(`System idle: ${systemIdleTime}s, Effective idle: ${effectiveIdleTime}s, threshold: ${this.idleThreshold}s, voice: ${this.isVoiceActive}`);

    // Check if timer is currently in IDLE_PAUSED state
    const currentState = this.timerEngine.getState();
    
    if (currentState.state === TimerState.IDLE_PAUSED) {
      // Already paused due to idle - check if user became active again
      // User is considered active if effective idle time is very small (less than 5 seconds)
      const isUserActive = effectiveIdleTime < 5;
      
      if (isUserActive) {
        console.log('User active again - resuming timer');
        
        // Calculate total idle duration (from when we paused until now)
        const totalIdleSeconds = Math.floor((Date.now() - this.idleStartTime) / 1000);
        console.log(`Total idle duration: ${totalIdleSeconds} seconds`);
        
        // Resume the timer (it will automatically continue from remaining time)
        this.timerEngine.resume();
        this.wasIdlePaused = false;
        this.idleStartTime = 0;
      }
    } else if (currentState.state === TimerState.RUNNING) {
      // Timer is running - check if user became idle using effective idle time
      const isUserIdle = effectiveIdleTime >= this.idleThreshold;
      
      if (isUserIdle && !this.wasIdlePaused) {
        console.log('User idle detected - pausing timer');
        
        // Mark the current time when we detect idle (for calculating total idle duration)
        this.idleStartTime = Date.now();
        this.wasIdlePaused = true;
        
        // Pause the timer and add back the idle threshold time
        this.timerEngine.pauseForIdle(this.idleThreshold);
        
        // Restart monitoring with faster interval for quick resume detection
        this.startMonitoring();
      }
    }
  }

  configure(enabled: boolean, thresholdSeconds: number, voiceEnabled?: boolean): void {
    this.enabled = enabled;
    this.idleThreshold = thresholdSeconds;
    
    if (voiceEnabled !== undefined) {
      this.voiceDetectionEnabled = voiceEnabled;
    }
    
    console.log(`Idle detection configured: enabled=${enabled}, threshold=${thresholdSeconds}s, voice=${this.voiceDetectionEnabled}`);
    
    // Restart monitoring if currently in work phase and now enabled
    if (enabled) {
      const state = this.timerEngine.getState();
      if (state.state === TimerState.RUNNING && state.isWorkPhase) {
        this.startMonitoring();
      }
    } else {
      this.stopMonitoring();
    }
  }

  destroy(): void {
    this.stopMonitoring();
  }

  setVoiceActive(isActive: boolean): void {
    this.isVoiceActive = isActive;
  }
}

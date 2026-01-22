import { EventEmitter } from 'events';

export enum TimerState {
  STOPPED = 'STOPPED',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  IDLE_PAUSED = 'IDLE_PAUSED',
  WORK_FINISHED = 'WORK_FINISHED',
  BREAK_RUNNING = 'BREAK_RUNNING',
  BREAK_FINISHED = 'BREAK_FINISHED'
}

export interface TimerConfig {
  workDuration: number; // in seconds
  breakDuration: number; // in seconds
  idleEnabled?: boolean; // whether idle detection is enabled
  idleThreshold?: number; // idle threshold in seconds
}

export interface TimerStateData {
  state: TimerState;
  remainingTime: number;
  totalTime: number;
  isWorkPhase: boolean;
}

export class TimerEngine extends EventEmitter {
  private state: TimerState = TimerState.STOPPED;
  private remainingTime: number = 25 * 60; // Show default work duration
  private totalTime: number = 25 * 60;
  private isWorkPhase: boolean = true;
  private intervalId: NodeJS.Timeout | null = null;
  private config: TimerConfig = {
    workDuration: 25 * 60, // 25 minutes default
    breakDuration: 5 * 60  // 5 minutes default
  };

  constructor() {
    super();
  }

  configure(config: Partial<TimerConfig>): void {
    if (config.workDuration !== undefined) {
      this.config.workDuration = config.workDuration;
      // Update display if in STOPPED state
      if (this.state === TimerState.STOPPED) {
        this.remainingTime = config.workDuration;
        this.totalTime = config.workDuration;
        this.emitState();
      }
    }
    if (config.breakDuration !== undefined) {
      // Ensure break duration doesn't exceed work duration
      this.config.breakDuration = Math.min(
        config.breakDuration,
        this.config.workDuration
      );
    }
  }

  start(): void {
    if (this.state === TimerState.STOPPED || this.state === TimerState.WORK_FINISHED) {
      // Start new work session
      this.isWorkPhase = true;
      this.remainingTime = this.config.workDuration;
      this.totalTime = this.config.workDuration;
      this.state = TimerState.RUNNING;
      this.startCountdown();
      this.emitState();
    } else if (this.state === TimerState.PAUSED || this.state === TimerState.IDLE_PAUSED) {
      // Resume from pause
      this.state = TimerState.RUNNING;
      this.startCountdown();
      this.emitState();
    } else if (this.state === TimerState.BREAK_FINISHED) {
      // Start new work session after break
      this.isWorkPhase = true;
      this.remainingTime = this.config.workDuration;
      this.totalTime = this.config.workDuration;
      this.state = TimerState.RUNNING;
      this.startCountdown();
      this.emitState();
    }
  }

  pause(): void {
    if (this.state === TimerState.RUNNING) {
      this.state = TimerState.PAUSED;
      this.stopCountdown();
      this.emitState();
    } else if (this.state === TimerState.BREAK_RUNNING) {
      // Can't manually pause break - just ignore
      return;
    }
  }

  // Resume from idle pause (called by idle detector)
  resume(): void {
    if (this.state === TimerState.IDLE_PAUSED) {
      this.state = TimerState.RUNNING;
      this.startCountdown();
      this.emitState();
    } else if (this.state === TimerState.PAUSED) {
      // Also handle manual pause resume
      this.state = TimerState.RUNNING;
      this.startCountdown();
      this.emitState();
    }
  }

  reset(): void {
    this.stopCountdown();
    this.state = TimerState.STOPPED;
    // Show the configured work duration when stopped
    this.remainingTime = this.config.workDuration;
    this.totalTime = this.config.workDuration;
    this.isWorkPhase = true;
    this.emitState();
  }

  // Called by idle detector
  pauseForIdle(idleSeconds: number): void {
    if (this.state === TimerState.RUNNING && this.isWorkPhase) {
      // Add back idle time since user wasn't working during that period
      // The countdown already subtracted this time, but user wasn't active
      this.remainingTime = Math.min(this.totalTime, this.remainingTime + idleSeconds);
      this.state = TimerState.IDLE_PAUSED;
      this.stopCountdown();
      this.emitState();
    }
  }

  getState(): TimerStateData {
    return {
      state: this.state,
      remainingTime: this.remainingTime,
      totalTime: this.totalTime,
      isWorkPhase: this.isWorkPhase
    };
  }

  private startCountdown(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => {
      this.remainingTime--;
      this.emit('tick', this.getState());

      if (this.remainingTime <= 0) {
        if (this.isWorkPhase) {
          this.handleWorkComplete();
        } else {
          this.handleBreakComplete();
        }
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private handleWorkComplete(): void {
    this.stopCountdown();
    this.state = TimerState.WORK_FINISHED;
    this.emitState();
    
    // Emit break start event for window management
    this.emit('breakStart');
    
    // Auto-start break after a brief moment
    setTimeout(() => {
      this.startBreak();
    }, 1000);
  }

  private startBreak(): void {
    this.isWorkPhase = false;
    this.remainingTime = this.config.breakDuration;
    this.totalTime = this.config.breakDuration;
    this.state = TimerState.BREAK_RUNNING;
    this.startCountdown();
    this.emitState();
  }

  private handleBreakComplete(): void {
    this.stopCountdown();
    this.state = TimerState.BREAK_FINISHED;
    this.emitState();
    
    // Emit break end event for window management
    this.emit('breakEnd');
  }

  private emitState(): void {
    this.emit('stateChange', this.getState());
  }

  destroy(): void {
    this.stopCountdown();
  }
}

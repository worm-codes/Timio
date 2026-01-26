import { AnimationType, SpriteAnimation } from './SpriteLoader';

export type PetState = 'idle' | 'alert' | 'sleep' | 'happy' | 'walk';

export class AnimationController {
  private currentAnimation: SpriteAnimation | null = null;
  private currentFrame: number = 0;
  private frameTimer: number = 0;
  private lastFrameTime: number = 0;
  private playOnce: boolean = false;
  private animationComplete: boolean = false;

  private animations: Map<AnimationType, SpriteAnimation>;
  private hasAttackAnimation: boolean;

  constructor(animations: Map<AnimationType, SpriteAnimation>) {
    this.animations = animations;
    this.hasAttackAnimation = animations.has('attack');
  }

  // Map pet state to sprite animation
  private getAnimationForState(state: PetState): AnimationType {
    switch (state) {
      case 'idle':
        return 'idle';
      case 'walk':
        return 'walk';
      case 'sleep':
        return 'death'; // Repurpose death as sleep
      case 'alert':
        return 'hurt';
      case 'happy':
        // Use attack for happy if available, otherwise fast idle
        return this.hasAttackAnimation ? 'attack' : 'idle';
      default:
        return 'idle';
    }
  }

  setState(state: PetState, shouldPlayOnce: boolean = false): void {
    const animType = this.getAnimationForState(state);
    const newAnimation = this.animations.get(animType);

    if (newAnimation && newAnimation !== this.currentAnimation) {
      this.currentAnimation = newAnimation;
      this.currentFrame = 0;
      this.frameTimer = 0;
      this.lastFrameTime = Date.now();
      this.playOnce = shouldPlayOnce;
      this.animationComplete = false;
    } else if (newAnimation === this.currentAnimation) {
      // Same animation but mode or state changed
      const wasPlayOnce = this.playOnce;
      this.playOnce = shouldPlayOnce;
      
      if (wasPlayOnce && !shouldPlayOnce) {
        // Switching from playOnce (frozen) to loop - reset animation to start fresh
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.lastFrameTime = Date.now();
        this.animationComplete = false;
      } else if (!wasPlayOnce && shouldPlayOnce) {
        // Switching from loop to playOnce - let current animation continue to end
        this.animationComplete = false;
      }
    }
  }

  // Set animation to last frame immediately without playing
  setToLastFrame(state: PetState): void {
    const animType = this.getAnimationForState(state);
    const newAnimation = this.animations.get(animType);
    
    if (newAnimation) {
      this.currentAnimation = newAnimation;
      this.currentFrame = newAnimation.frames.length - 1;
      this.frameTimer = 0;
      this.lastFrameTime = Date.now();
      this.playOnce = true;
      this.animationComplete = true;
    }
  }

  update(): void {
    if (!this.currentAnimation) return;
    
    // If playOnce and animation complete, stay on last frame
    if (this.playOnce && this.animationComplete) {
      this.lastFrameTime = Date.now();
      return;
    }

    const now = Date.now();
    const deltaTime = (now - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = now;

    this.frameTimer += deltaTime;

    const frameDuration = 1 / this.currentAnimation.fps;
    if (this.frameTimer >= frameDuration) {
      if (this.playOnce && this.currentFrame === this.currentAnimation.frameCount - 1) {
        // Reached last frame in playOnce mode
        this.animationComplete = true;
      } else {
        this.currentFrame = (this.currentFrame + 1) % this.currentAnimation.frameCount;
      }
      this.frameTimer = 0;
    }
  }

  getCurrentFrame(): { animation: SpriteAnimation; frameIndex: number } | null {
    if (!this.currentAnimation) return null;

    return {
      animation: this.currentAnimation,
      frameIndex: this.currentFrame
    };
  }

  reset(): void {
    this.currentFrame = 0;
    this.frameTimer = 0;
    this.lastFrameTime = Date.now();
  }
}

// Map timer states to pet states
export function timerStateToPetState(timerState: string): PetState {
  switch (timerState) {
    case 'RUNNING':
      return 'walk'; // Walking around actively during work
    case 'PAUSED':
      return 'sleep'; // Play sleep animation once then freeze
    case 'IDLE_PAUSED':
      return 'sleep'; // Sleeping when user is idle
    case 'WORK_FINISHED':
    case 'BREAK_FINISHED':
      return 'happy'; // Celebrate completion
    case 'BREAK_RUNNING':
      return 'sleep'; // Sleeping during break (resting)
    case 'STOPPED':
    default:
      return 'sleep'; // Sleeping when timer is not started
  }
}

import React, { useEffect, useRef, useState } from 'react';
import { SpriteLoader, AnimalType } from './SpriteLoader';
import { AnimationController, timerStateToPetState, PetState } from './AnimationController';
import './PixelPet.css';

interface PixelPetProps {
  timerState: string;
}

const ANIMALS: { type: AnimalType; label: string }[] = [
  { type: 'dog1', label: '🐕 Dog' },
  { type: 'dog2', label: '🐕 Dog 2' },
  { type: 'cat1', label: '🐈 Cat' },
  { type: 'cat2', label: '🐈 Cat 2' },
  { type: 'rat1', label: '🐀 Rat' },
  { type: 'rat2', label: '🐀 Rat 2' },
  { type: 'bird1', label: '🐦 Bird' },
  { type: 'bird2', label: '🐦 Bird 2' }
];

const SCALE_X = 1; // Horizontal scale
const SCALE_Y = 1.5; // Vertical scale
const LERP_SPEED = 0.0075; // Smoothness of movement (slower = smoother)
const WANDER_SPEED = 0.6; // How fast pet wanders
const WANDER_CHANGE_INTERVAL = 2500; // Change direction every 2.5 seconds
const PAUSE_DURATION = 3000; // Pause for 3 seconds after click
const RANDOM_PAUSE_MIN = 2000; // Minimum pause duration (2 seconds)
const RANDOM_PAUSE_MAX = 5000; // Maximum pause duration (5 seconds)

export const PixelPet: React.FC<PixelPetProps> = ({ timerState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const controllerRef = useRef<AnimationController | null>(null);
  const spriteSheetRef = useRef<any>(null);
  
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalType>(() => {
    const saved = localStorage.getItem('selectedAnimal');
    return (saved as AnimalType) || 'cat1';
  });
  
  const [showSelector, setShowSelector] = useState(false);
  const [affection, setAffection] = useState(0);
  const [showHeart, setShowHeart] = useState(false);
  
  // Pet position and movement
  const positionRef = useRef({ x: 120, y: 60 });
  const targetRef = useRef({ x: 120, y: 60 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const directionRef = useRef<'left' | 'right'>('right'); // Track facing direction
  const isMovingRef = useRef(false);
  const isPausedRef = useRef(false);
  const isWanderingPausedRef = useRef(false);
  const isLandingRef = useRef(false);
  const pauseEndTimeRef = useRef(0);
  const lastWanderChangeRef = useRef(Date.now());
  const petStateRef = useRef<PetState>('idle');

  // Load sprite sheet when animal changes
  useEffect(() => {
    let cancelled = false;
    
    SpriteLoader.loadSpriteSheet(selectedAnimal).then((spriteSheet) => {
      if (cancelled) return;
      
      spriteSheetRef.current = spriteSheet;
      controllerRef.current = new AnimationController(spriteSheet.animations);
      
      const petState = timerStateToPetState(timerState);
      petStateRef.current = petState;
      
      // If changing animal while in sleep state, go directly to last frame without playing
      const isSleepState = timerState === 'PAUSED' || timerState === 'STOPPED' || timerState === 'IDLE_PAUSED' || timerState === 'BREAK_RUNNING';
      
      if (isSleepState && petStateRef.current === 'sleep') {
        // Skip animation and go directly to frozen last frame
        controllerRef.current.setToLastFrame(petState);
      } else {
        // Normal animation start
        const shouldPlayOnce = isSleepState;
        controllerRef.current.setState(petState, shouldPlayOnce);
      }
    }).catch((error) => {
      console.error('Failed to load sprite sheet:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedAnimal]);

  // Update animation state based on timer state
  useEffect(() => {
    if (!controllerRef.current) return;
    
    const petState = timerStateToPetState(timerState);
    petStateRef.current = petState;
    
    // Play sleep animation once and freeze on last frame for PAUSED, STOPPED, IDLE_PAUSED, and BREAK_RUNNING
    const shouldPlayOnce = timerState === 'PAUSED' || timerState === 'STOPPED' || timerState === 'IDLE_PAUSED' || timerState === 'BREAK_RUNNING';
    controllerRef.current.setState(petState, shouldPlayOnce);
    
    // Reset isPausedRef when resuming from pause/stop
    if (petState === 'walk') {
      isPausedRef.current = false;
    }
    
    // Active wandering during work session
    if (petState === 'walk') {
      const isBird = selectedAnimal === 'bird1' || selectedAnimal === 'bird2';
      if (isBird) {
        const angle = Math.random() * Math.PI * 2;
        velocityRef.current = {
          x: Math.cos(angle) * WANDER_SPEED,
          y: Math.sin(angle) * WANDER_SPEED * 0.5
        };
      } else {
        const direction = Math.random() > 0.5 ? 1 : -1;
        velocityRef.current = {
          x: direction * WANDER_SPEED,
          y: 0
        };
      }
      lastWanderChangeRef.current = Date.now();
    } else if (petState === 'sleep' || petState === 'idle') {
      // Birds should land before stopping
      const isBird = selectedAnimal === 'bird1' || selectedAnimal === 'bird2';
      if (isBird) {
        const canvas = canvasRef.current;
        if (canvas) {
          const groundLevel = canvas.height * 0.5;
          // Move bird down to ground level if above it
          if (positionRef.current.y < groundLevel - 5) {
            isLandingRef.current = true;
            velocityRef.current = { x: 0, y: 1.5 }; // Descend
            isMovingRef.current = false;
          } else {
            // Reached ground, fully stop
            isLandingRef.current = false;
            positionRef.current.y = groundLevel;
            velocityRef.current = { x: 0, y: 0 };
            isMovingRef.current = false;
          }
        }
      } else {
        // Ground animals just stop
        isLandingRef.current = false;
        velocityRef.current = { x: 0, y: 0 };
        isMovingRef.current = false;
      }
    }
  }, [timerState, selectedAnimal]);

  // Canvas click handler - move pet to clicked position
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    // Scale coordinates from display size to canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    
    // Check if clicked on pet (within 25px radius)
    const dx = clickX - positionRef.current.x;
    const dy = clickY - positionRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 25) {
      // Clicked on pet - show heart and pause
      handlePetClick();
    } else {
      // Clicked elsewhere - move pet to that location
      if (!isWanderingPausedRef.current) {
        // Cancel any ongoing happy animation pause
        isPausedRef.current = false;
        
        // Ground animals can only move horizontally
        const isBird = selectedAnimal === 'bird1' || selectedAnimal === 'bird2';
        if (isBird) {
          targetRef.current = { x: clickX, y: clickY };
        } else {
          // Keep Y position same for ground animals
          targetRef.current = { x: clickX, y: positionRef.current.y };
        }
        isMovingRef.current = true;
        isWanderingPausedRef.current = false; // Exit wandering pause
        
        // Force walk animation
        if (controllerRef.current) {
          controllerRef.current.setState('walk');
        }
      }
    }
  };

  // Click handler for affection (when clicking ON the pet)
  const handlePetClick = () => {
    setAffection((prev) => prev + 1);
    setShowHeart(true);
    
    // Pause movement and show happy animation
    isPausedRef.current = true;
    isMovingRef.current = false;
    velocityRef.current = { x: 0, y: 0 };
    
    if (controllerRef.current) {
      controllerRef.current.setState('happy');
    }
    
    // Resume movement after 5 seconds
    setTimeout(() => {
      isPausedRef.current = false;
      const petState = timerStateToPetState(timerState);
      petStateRef.current = petState;
      if (controllerRef.current) {
        controllerRef.current.setState(petState);
      }
    }, PAUSE_DURATION);
    
    setTimeout(() => setShowHeart(false), 800);
  };

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const animate = () => {
      // Update animation (playOnce handles freezing automatically)
      if (controllerRef.current) {
        controllerRef.current.update();
      }

      // Update movement behavior
      if (!isPausedRef.current) {
        const now = Date.now();
        
        // Check if reached target
        const dx = targetRef.current.x - positionRef.current.x;
        const dy = targetRef.current.y - positionRef.current.y;
        const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
        
        if (distanceToTarget < 5 && isMovingRef.current) {
          // Reached target, stop manual movement
          isMovingRef.current = false;
          positionRef.current.x = targetRef.current.x;
          positionRef.current.y = targetRef.current.y;
          velocityRef.current = { x: 0, y: 0 };
          
          // Switch to idle animation when stopped
          if (controllerRef.current) {
            controllerRef.current.setState('idle');
          }
          
          // Start wandering timer for work mode
          lastWanderChangeRef.current = now;
        }
        
        // Autonomous wandering - only during work mode and when not manually moving
        if (!isMovingRef.current && petStateRef.current === 'walk') {
          // Check if in random pause
          if (isWanderingPausedRef.current) {
            if (now >= pauseEndTimeRef.current) {
              // Resume wandering
              isWanderingPausedRef.current = false;
              lastWanderChangeRef.current = now;
              
              // Switch back to walk animation
              if (controllerRef.current) {
                controllerRef.current.setState('walk');
              }
              
              const isBird = selectedAnimal === 'bird1' || selectedAnimal === 'bird2';
              if (isBird) {
                const angle = Math.random() * Math.PI * 2;
                velocityRef.current = {
                  x: Math.cos(angle) * WANDER_SPEED,
                  y: Math.sin(angle) * WANDER_SPEED * 0.5
                };
              } else {
                const direction = Math.random() > 0.5 ? 1 : -1;
                velocityRef.current = {
                  x: direction * WANDER_SPEED,
                  y: 0
                };
              }
            }
          } else if (now - lastWanderChangeRef.current > WANDER_CHANGE_INTERVAL) {
            // Randomly decide to pause or change direction
            const shouldPause = Math.random() > 0.6; // 40% chance to pause
            
            if (shouldPause) {
              // Start random pause
              isWanderingPausedRef.current = true;
              velocityRef.current = { x: 0, y: 0 };
              const pauseDuration = RANDOM_PAUSE_MIN + Math.random() * (RANDOM_PAUSE_MAX - RANDOM_PAUSE_MIN);
              pauseEndTimeRef.current = now + pauseDuration;
              
              // Switch to idle animation during pause
              if (controllerRef.current) {
                controllerRef.current.setState('idle');
              }
            } else {
              // Change direction
              lastWanderChangeRef.current = now;
              
              const isBird = selectedAnimal === 'bird1' || selectedAnimal === 'bird2';
              if (isBird) {
                const angle = Math.random() * Math.PI * 2;
                velocityRef.current = {
                  x: Math.cos(angle) * WANDER_SPEED,
                  y: Math.sin(angle) * WANDER_SPEED * 0.5
                };
              } else {
                const direction = Math.random() > 0.5 ? 1 : -1;
                velocityRef.current = {
                  x: direction * WANDER_SPEED,
                  y: 0
                };
              }
            }
          }
        }
        
        // Apply movement
        if (isMovingRef.current) {
          // Moving to target - use lerp
          positionRef.current.x += dx * LERP_SPEED;
          positionRef.current.y += dy * LERP_SPEED;
          
          // Update direction based on movement
          if (Math.abs(dx) > 1) {
            directionRef.current = dx > 0 ? 'right' : 'left';
          }
          
          // Switch to walk animation
          if (controllerRef.current && petStateRef.current === 'idle') {
            controllerRef.current.setState('walk');
          }
        } else if (velocityRef.current.x !== 0 || velocityRef.current.y !== 0) {
          // Wandering or landing - apply velocity
          positionRef.current.x += velocityRef.current.x;
          positionRef.current.y += velocityRef.current.y;
          
          // Check if bird finished landing
          if (isLandingRef.current) {
            const groundLevel = canvas.height * 0.5;
            if (positionRef.current.y >= groundLevel - 2) {
              // Landed!
              isLandingRef.current = false;
              positionRef.current.y = groundLevel;
              velocityRef.current = { x: 0, y: 0 };
              
              // Switch to idle animation after landing
              if (controllerRef.current) {
                controllerRef.current.setState('idle');
              }
            }
          }
          
          // Update direction based on velocity
          if (Math.abs(velocityRef.current.x) > 0.1) {
            directionRef.current = velocityRef.current.x > 0 ? 'right' : 'left';
          }
          
          // Switch to walk animation while wandering (not during landing)
          if (controllerRef.current && petStateRef.current === 'idle' && !isLandingRef.current) {
            controllerRef.current.setState('walk');
          }
        } else {
          // Stopped - idle animation
          if (controllerRef.current && petStateRef.current === 'idle') {
            controllerRef.current.setState('idle');
          }
        }
        
        // Keep pet within canvas bounds (skip Y bounds during landing)
        const margin = 20;
        const isBird = selectedAnimal === 'bird1' || selectedAnimal === 'bird2';
        const groundLevel = canvas.height * 0.5; // Ground animals stay in middle/lower area
        const maxY = isBird ? canvas.height * 0.65 : groundLevel;
        const minY = isBird ? margin : groundLevel - 10;
        
        if (positionRef.current.x < margin) {
          positionRef.current.x = margin;
          velocityRef.current.x *= -1;
        }
        if (positionRef.current.x > canvas.width - margin) {
          positionRef.current.x = canvas.width - margin;
          velocityRef.current.x *= -1;
        }
        
        // Only apply Y boundary checks when not landing
        if (!isLandingRef.current) {
          if (positionRef.current.y < minY) {
            positionRef.current.y = minY;
            velocityRef.current.y *= -1;
          }
          if (positionRef.current.y > maxY) {
            positionRef.current.y = maxY;
            velocityRef.current.y *= -1;
          }
        }
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw sprite
      const frameData = controllerRef.current?.getCurrentFrame();
      if (frameData && spriteSheetRef.current) {
        const { animation, frameIndex } = frameData;
        const frame = animation.frames[frameIndex];
        
        if (frame && animation.image) {
          // Use the pre-loaded image from animation
          const img = animation.image;
          
          ctx.imageSmoothingEnabled = false;
          
          // Save canvas state for flipping
          ctx.save();
          
          // Calculate position
          const drawX = positionRef.current.x;
          const drawY = positionRef.current.y;
          
          // Flip sprite if moving left
          if (directionRef.current === 'left') {
            ctx.translate(drawX, drawY);
            ctx.scale(-1, 1);
            ctx.drawImage(
              img,
              frame.x, frame.y, frame.width, frame.height,
              -(frame.width * SCALE_X) / 2,
              -(frame.height * SCALE_Y) / 2,
              frame.width * SCALE_X,
              frame.height * SCALE_Y
            );
          } else {
            ctx.drawImage(
              img,
              frame.x, frame.y, frame.width, frame.height,
              drawX - (frame.width * SCALE_X) / 2,
              drawY - (frame.height * SCALE_Y) / 2,
              frame.width * SCALE_X,
              frame.height * SCALE_Y
            );
          }
          
          // Restore canvas state
          ctx.restore();
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [selectedAnimal, timerState]);

  // Save selected animal to localStorage
  useEffect(() => {
    localStorage.setItem('selectedAnimal', selectedAnimal);
  }, [selectedAnimal]);

  return (
    <div className="pixel-pet-container">
      <canvas
        ref={canvasRef}
        width={240}
        height={120}
        className="pixel-pet-canvas"
        onClick={handleCanvasClick}
      />
      
      {showHeart && canvasRef.current && (() => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        // Convert canvas coordinates to screen coordinates
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        const screenX = positionRef.current.x * scaleX;
        const screenY = positionRef.current.y * scaleY;
        
        return (
          <div className="floating-heart" style={{ 
            left: screenX, 
            top: screenY - 40,
            transform: 'translate(-50%, -50%)' // Center on pet
          }}>
            ❤️
          </div>
        );
      })()}
      
      <button 
        className="pet-selector-btn"
        onClick={() => setShowSelector(!showSelector)}
        title="Select Pet"
      >
        🐾
      </button>
      
      {showSelector && (
        <div className="pet-selector">
          <div className="pet-selector-header">Choose Your Companion</div>
          <div className="pet-options">
            {ANIMALS.map((animal) => (
              <button
                key={animal.type}
                className={`pet-option ${selectedAnimal === animal.type ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedAnimal(animal.type);
                  setShowSelector(false);
                }}
              >
                {animal.label}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="affection-counter">
        💖 {affection}
      </div>
    </div>
  );
};

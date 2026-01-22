import React, { useState, useEffect, useRef } from 'react';
import { useTimer } from './hooks/useTimer';
import { PixelPet } from './components/PixelPet/PixelPet';
import { TimerDisplay } from './components/TimerDisplay';
import { ControlButtons } from './components/ControlButtons';
import { ProgressBar } from './components/ProgressBar';
import { SettingsPanel } from './components/SettingsPanel';
import { VoiceDetector } from './services/VoiceDetector';
import { SoundManager } from './services/SoundManager';
import './styles/App.css';

const App: React.FC = () => {
  const { state, remainingTime, totalTime, isWorkPhase, start, pause, reset, configure } = useTimer();
  const [showSettings, setShowSettings] = useState(false);
  const voiceDetectorRef = useRef<VoiceDetector | null>(null);
  const soundManagerRef = useRef<SoundManager | null>(null);
  const prevStateRef = useRef<string>(state);

  useEffect(() => {
    // Initialize sound manager
    soundManagerRef.current = new SoundManager();
    
    // Initialize voice detector
    voiceDetectorRef.current = new VoiceDetector();
    
    // Load voice detection settings
    const voiceEnabled = localStorage.getItem('voiceDetection') === 'true';
    const voiceThreshold = localStorage.getItem('voiceThreshold');
    const selectedMic = localStorage.getItem('selectedMicrophone');
    
    if (voiceThreshold) {
      voiceDetectorRef.current.setThreshold(Number(voiceThreshold));
    }
    
    if (selectedMic) {
      voiceDetectorRef.current.setMicrophone(selectedMic);
    }
    
    if (voiceEnabled) {
      voiceDetectorRef.current.setEnabled(true);
    }

    // Send voice status updates to main process periodically
    const voiceStatusInterval = setInterval(() => {
      if (voiceDetectorRef.current && voiceDetectorRef.current.isEnabled()) {
        const isActive = voiceDetectorRef.current.isActive();
        window.electronAPI.voice.sendStatus(isActive);
        if (isActive) {
          console.log('Sending voice active status to main process');
        }
      }
    }, 1000); // Send every second

    // Handle voice status requests from main process
    const removeRequestListener = window.electronAPI.voice.onRequestStatus(() => {
      if (voiceDetectorRef.current && voiceDetectorRef.current.isEnabled()) {
        const isActive = voiceDetectorRef.current.isActive();
        window.electronAPI.voice.sendStatus(isActive);
      }
    });

    return () => {
      clearInterval(voiceStatusInterval);
      removeRequestListener();
      voiceDetectorRef.current?.stop();
    };
  }, []);

  // Play sounds on state changes
  useEffect(() => {
    const prevState = prevStateRef.current;
    const currentState = state;
    
    if (soundManagerRef.current && prevState !== currentState) {
      // Play appropriate sound based on state transition
      if (currentState === 'RUNNING' && prevState === 'STOPPED') {
        soundManagerRef.current.play('start');
      } else if (currentState === 'PAUSED') {
        soundManagerRef.current.play('pause');
      } else if (currentState === 'STOPPED') {
        soundManagerRef.current.play('stop');
      } else if (currentState === 'BREAK_RUNNING' && prevState === 'WORK_FINISHED') {
        soundManagerRef.current.play('break');
      } else if (currentState === 'WORK_FINISHED' || currentState === 'BREAK_FINISHED') {
        soundManagerRef.current.play('complete');
      } else if (currentState === 'RUNNING' && (prevState === 'PAUSED' || prevState === 'IDLE_PAUSED')) {
        soundManagerRef.current.play('start');
      }
      
      prevStateRef.current = currentState;
    }
  }, [state]);

  // Update voice detector when settings change
  const handleConfigure = (config: any) => {
    configure(config);
    
    // Update sound settings
    if (config.soundsEnabled !== undefined && soundManagerRef.current) {
      soundManagerRef.current.setEnabled(config.soundsEnabled);
    }
    
    // Update voice detector settings
    const voiceEnabled = localStorage.getItem('voiceDetection') === 'true';
    const voiceThreshold = localStorage.getItem('voiceThreshold');
    const selectedMic = localStorage.getItem('selectedMicrophone');
    
    if (voiceDetectorRef.current) {
      if (voiceThreshold) {
        voiceDetectorRef.current.setThreshold(Number(voiceThreshold));
      }
      
      if (selectedMic) {
        voiceDetectorRef.current.setMicrophone(selectedMic);
      }
      
      voiceDetectorRef.current.setEnabled(voiceEnabled);
    }
  };

  return (
    <div className="app">
      {/* Night Sky Background */}
      <div className="night-sky">
        <div className="stars"></div>
        <div className="stars-slow"></div>
      </div>

      {/* Campsite Scene with Pixel Pet - Above timer */}
      <div className="campsite-scene">
        <PixelPet timerState={state} />
      </div>

      {/* Main Timer Panel */}
      <div className="timer-panel">
        <div className="phase-indicator">
          {isWorkPhase ? '🔥 BURN TIME' : '✨ REST STOP'}
        </div>

        <TimerDisplay 
          remainingTime={remainingTime}
          isRunning={state === 'RUNNING' || state === 'BREAK_RUNNING'}
        />

        <ControlButtons
          state={state}
          onStart={start}
          onPause={pause}
          onReset={reset}
        />

        <ProgressBar
          current={totalTime - remainingTime}
          total={totalTime}
        />
      </div>

      {/* Settings Button */}
      <button 
        className="settings-button"
        onClick={() => setShowSettings(!showSettings)}
        title="Settings"
      >
        ⚙
      </button>

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onConfigure={handleConfigure}
          onReset={reset}
        />
      )}
    </div>
  );
};

export default App;

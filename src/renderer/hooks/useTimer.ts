import { useState, useEffect } from 'react';

interface TimerState {
  state: string;
  remainingTime: number;
  totalTime: number;
  isWorkPhase: boolean;
}

export function useTimer() {
  const [timerState, setTimerState] = useState<TimerState>({
    state: 'STOPPED',
    remainingTime: 0,
    totalTime: 0,
    isWorkPhase: true
  });

  useEffect(() => {
    // Load saved settings from localStorage
    const loadSavedSettings = async () => {
      const workDuration = localStorage.getItem('workDuration');
      const breakDuration = localStorage.getItem('breakDuration');
      const idleEnabled = localStorage.getItem('idleEnabled');
      const idleThreshold = localStorage.getItem('idleThreshold');
      const voiceDetection = localStorage.getItem('voiceDetection');
      
      if (workDuration || breakDuration || idleEnabled || idleThreshold || voiceDetection) {
        await window.electronAPI.timer.configure({
          workDuration: workDuration ? Number(workDuration) : undefined,
          breakDuration: breakDuration ? Number(breakDuration) : undefined,
          idleEnabled: idleEnabled ? idleEnabled === 'true' : undefined,
          idleThreshold: idleThreshold ? Number(idleThreshold) : undefined,
          voiceDetection: voiceDetection ? voiceDetection === 'true' : undefined
        } as any);
      }
    };
    
    loadSavedSettings();
    
    // Get initial state
    window.electronAPI.timer.getState().then(setTimerState);

    // Subscribe to timer updates
    const unsubscribeTick = window.electronAPI.timer.onTick(setTimerState);
    const unsubscribeState = window.electronAPI.timer.onStateChange(setTimerState);

    // Subscribe to break events
    const unsubscribeBreakStart = window.electronAPI.timer.onBreakStart(() => {
      console.log('Break time started! Window should be on top.');
    });

    const unsubscribeBreakEnd = window.electronAPI.timer.onBreakEnd(() => {
      console.log('Break time ended. Window returned to normal.');
    });

    return () => {
      unsubscribeTick();
      unsubscribeState();
      unsubscribeBreakStart();
      unsubscribeBreakEnd();
    };
  }, []);

  const start = async () => {
    const newState = await window.electronAPI.timer.start();
    setTimerState(newState);
  };

  const pause = async () => {
    const newState = await window.electronAPI.timer.pause();
    setTimerState(newState);
  };

  const reset = async () => {
    const newState = await window.electronAPI.timer.reset();
    setTimerState(newState);
  };

  const configure = async (config: { 
    workDuration?: number; 
    breakDuration?: number;
    idleEnabled?: boolean;
    idleThreshold?: number;
  }) => {
    const newState = await window.electronAPI.timer.configure(config);
    setTimerState(newState);
  };

  return {
    state: timerState.state,
    remainingTime: timerState.remainingTime,
    totalTime: timerState.totalTime,
    isWorkPhase: timerState.isWorkPhase,
    start,
    pause,
    reset,
    configure
  };
}

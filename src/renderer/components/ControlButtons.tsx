import React from 'react';
import './ControlButtons.css';

interface ControlButtonsProps {
  state: string;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

export const ControlButtons: React.FC<ControlButtonsProps> = ({ 
  state, 
  onStart, 
  onPause, 
  onReset 
}) => {
  const isRunning = state === 'RUNNING' || state === 'BREAK_RUNNING';
  const canStart = state === 'STOPPED' || state === 'PAUSED' || state === 'IDLE_PAUSED' || state === 'WORK_FINISHED' || state === 'BREAK_FINISHED';
  const canPause = state === 'RUNNING';

  return (
    <div className="control-buttons">
      {!isRunning && canStart && (
        <button 
          className="control-btn ignite"
          onClick={onStart}
        >
          🔥 IGNITE
        </button>
      )}
      
      {canPause && (
        <button 
          className="control-btn quench"
          onClick={onPause}
        >
          💧 QUENCH
        </button>
      )}
      
      <button 
        className="control-btn reset"
        onClick={onReset}
      >
        🌙 RESET
      </button>
    </div>
  );
};

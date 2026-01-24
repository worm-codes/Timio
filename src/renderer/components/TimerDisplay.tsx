import React from 'react';
import './TimerDisplay.css';

interface TimerDisplayProps {
  remainingTime: number;
  isRunning: boolean;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ remainingTime, isRunning }) => {
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;
  
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className={`timer-display ${isRunning ? 'running' : ''}`}>
      <div className="time-digits">
        {formattedTime}
      </div>
    </div>
  );
};

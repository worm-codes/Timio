import React, { useState } from 'react';
import './SettingsPanel.css';

interface SettingsPanelProps {
  onClose: () => void;
  onConfigure: (config: { 
    workDuration?: number; 
    breakDuration?: number;
    idleEnabled?: boolean;
    idleThreshold?: number;
    voiceDetection?: boolean;
    soundsEnabled?: boolean;
  }) => void;
  onReset: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose, onConfigure, onReset }) => {
  const [workMinutes, setWorkMinutes] = useState(() => {
    const saved = localStorage.getItem('workDuration');
    return saved ? Number(saved) / 60 : 25;
  });
  const [breakMinutes, setBreakMinutes] = useState(() => {
    const saved = localStorage.getItem('breakDuration');
    return saved ? Number(saved) / 60 : 5;
  });
  const [idleEnabled, setIdleEnabled] = useState(() => {
    const saved = localStorage.getItem('idleEnabled');
    return saved ? saved === 'true' : true;
  });
  const [idleMinutes, setIdleMinutes] = useState(() => {
    const saved = localStorage.getItem('idleThreshold');
    return saved ? Number(saved) / 60 : 5;
  });
  const [voiceDetection, setVoiceDetection] = useState(() => {
    const saved = localStorage.getItem('voiceDetection');
    return saved ? saved === 'true' : false;
  });
  const [voiceThreshold, setVoiceThreshold] = useState(() => {
    const saved = localStorage.getItem('voiceThreshold');
    return saved ? Number(saved) : -35;
  });
  const [selectedMicrophone, setSelectedMicrophone] = useState(() => {
    const saved = localStorage.getItem('selectedMicrophone');
    return saved || 'default';
  });
  const [soundsEnabled, setSoundsEnabled] = useState(() => {
    const saved = localStorage.getItem('soundsEnabled');
    return saved ? saved === 'true' : true;
  });
  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDeviceInfo[]>([]);

  // Load available microphones
  React.useEffect(() => {
    const loadMicrophones = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter(device => device.kind === 'audioinput');
        setAvailableMicrophones(mics);
      } catch (error) {
        console.error('Failed to enumerate microphones:', error);
      }
    };
    loadMicrophones();
  }, []);

  const handleSave = () => {
    // Ensure break doesn't exceed work time
    const validBreak = Math.min(breakMinutes, workMinutes);
    // Calculate max break as 50% of work time
    const maxBreakRatio = Math.floor(workMinutes * 0.5);
    const finalBreak = Math.min(validBreak, Math.max(maxBreakRatio, 5)); // At least 5 minutes
    
    // Ensure idle threshold doesn't exceed work time
    const maxIdle = Math.min(idleMinutes, workMinutes);
    
    // Check if any timer-related settings changed
    const oldWorkDuration = localStorage.getItem('workDuration');
    const oldBreakDuration = localStorage.getItem('breakDuration');
    const workChanged = oldWorkDuration !== String(workMinutes * 60);
    const breakChanged = oldBreakDuration !== String(finalBreak * 60);
    const settingsChanged = workChanged || breakChanged;
    
    // Save to localStorage
    localStorage.setItem('workDuration', String(workMinutes * 60));
    localStorage.setItem('breakDuration', String(finalBreak * 60));
    localStorage.setItem('idleEnabled', String(idleEnabled));
    localStorage.setItem('idleThreshold', String(maxIdle * 60));
    localStorage.setItem('voiceDetection', String(voiceDetection));
    localStorage.setItem('voiceThreshold', String(voiceThreshold));
    localStorage.setItem('selectedMicrophone', selectedMicrophone);
    localStorage.setItem('soundsEnabled', String(soundsEnabled));
    
    onConfigure({
      workDuration: workMinutes * 60,
      breakDuration: finalBreak * 60,
      idleEnabled: idleEnabled,
      idleThreshold: maxIdle * 60, // Convert to seconds
      voiceDetection: voiceDetection,
      soundsEnabled: soundsEnabled
    });
    
    // Only reset timer if work or break duration changed
    if (settingsChanged) {
      console.log('Timer settings changed - resetting timer');
      onReset();
    } else {
      console.log('Only idle/voice settings changed - timer not reset');
    }
    
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙ SETTINGS</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
          <div className="setting-item">
            <label>🔥 Burn Time (Work Duration)</label>
            <div className="input-group">
              <input
                type="number"
                min="1"
                max="90"
                value={workMinutes}
                onChange={(e) => setWorkMinutes(Number(e.target.value))}
              />
              <span>minutes</span>
            </div>
          </div>

          <div className="setting-item">
            <label>✨ Rest Stop (Break Duration)</label>
            <div className="input-group">
              <input
                type="number"
                min="1"
                max={Math.floor(workMinutes * 0.5)}
                value={Math.min(breakMinutes, Math.floor(workMinutes * 0.5))}
                onChange={(e) => setBreakMinutes(Number(e.target.value))}
              />
              <span>minutes</span>
            </div>
            <small>Max break: 50% of work time (currently {Math.floor(workMinutes * 0.5)} min)</small>
          </div>

          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={idleEnabled}
                onChange={(e) => setIdleEnabled(e.target.checked)}
                style={{ marginRight: '8px', width: 'auto' }}
              />
              💤 Idle Detection
            </label>
            <small>Auto-pause timer when inactive</small>
          </div>

          {idleEnabled && (
            <>
              <div className="setting-item">
                <label>⏱️ Idle Threshold</label>
                <div className="input-group">
                  <input
                    type="number"
                    min="1"
                    max={workMinutes}
                    value={Math.min(idleMinutes, workMinutes)}
                    onChange={(e) => setIdleMinutes(Number(e.target.value))}
                  />
                  <span>minutes</span>
                </div>
                <small>Pause after inactivity (max: work duration)</small>
              </div>

              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={voiceDetection}
                    onChange={(e) => setVoiceDetection(e.target.checked)}
                    style={{ marginRight: '8px', width: 'auto' }}
                  />
                  🎤 Voice Detection
                </label>
                <small>Continue timer when voice is detected (requires microphone)</small>
              </div>

              {voiceDetection && (
                <>
                  <div className="setting-item">
                    <label>🎤 Microphone</label>
                    <select 
                      value={selectedMicrophone}
                      onChange={(e) => setSelectedMicrophone(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px' }}
                    >
                      <option value="default">Default Microphone</option>
                      {availableMicrophones.map(mic => (
                        <option key={mic.deviceId} value={mic.deviceId}>
                          {mic.label || `Microphone ${mic.deviceId.substring(0, 8)}`}
                        </option>
                      ))}
                    </select>
                    <small>Select which microphone to use</small>
                  </div>

                  <div className="setting-item">
                    <label>🔊 Voice Sensitivity</label>
                    <div className="input-group">
                      <input
                        type="range"
                        min="-60"
                        max="-20"
                        value={voiceThreshold}
                        onChange={(e) => setVoiceThreshold(Number(e.target.value))}
                        style={{ width: '100%' }}
                      />
                      <span>{voiceThreshold} dB</span>
                    </div>
                    <small>Lower = more sensitive (default: -35 dB)</small>
                  </div>
                </>
              )}
            </>
          )}

          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={soundsEnabled}
                onChange={(e) => setSoundsEnabled(e.target.checked)}
                style={{ marginRight: '8px', width: 'auto' }}
              />
              🔊 Sound Effects
            </label>
            <small>Play sounds on start, pause, stop, break, and complete</small>
          </div>

          <div className="setting-info">
            <p>📊 Current Configuration</p>
            <small>Work: {workMinutes}min | Break: {Math.min(breakMinutes, Math.floor(workMinutes * 0.5))}min</small>
            {idleEnabled && <small> | Idle: {Math.min(idleMinutes, workMinutes)}min</small>}
          </div>
        </div>

        <div className="settings-footer">
          <button className="save-btn" onClick={handleSave}>
            💾 SAVE
          </button>
        </div>
      </div>
    </div>
  );
};

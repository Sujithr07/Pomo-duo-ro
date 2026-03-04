import React, { useState } from 'react';
import type { TimerState } from '../types';

interface Props {
  timer: TimerState;
  onApply: (workSeconds: number, breakMinutes: number, pomodoroMode: boolean) => void;
  onClose: () => void;
}

const PRESETS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1h 30m', minutes: 90 },
  { label: '2h', minutes: 120 },
];

const TimerSettings: React.FC<Props> = ({ timer, onApply, onClose }) => {
  const initialWork = timer.workMinutes;
  const [hours, setHours] = useState(Math.floor(initialWork / 60));
  const [minutes, setMinutes] = useState(initialWork % 60);
  const [breakMin, setBreakMin] = useState(timer.breakMinutes);
  const [pomodoroMode, setPomodoroMode] = useState(false);

  const totalMinutes = hours * 60 + minutes;

  const selectPreset = (m: number) => {
    setHours(Math.floor(m / 60));
    setMinutes(m % 60);
  };

  const incHours = () => setHours((h) => Math.min(4, h + 1));
  const decHours = () => setHours((h) => Math.max(0, h - 1));
  const incMinutes = () => {
    setMinutes((m) => {
      if (m >= 55) { incHours(); return 0; }
      return m + 5;
    });
  };
  const decMinutes = () => {
    setMinutes((m) => {
      if (m <= 0) {
        if (hours > 0) { setHours((h) => h - 1); return 55; }
        return 0;
      }
      return m - 5;
    });
  };

  const handleApply = () => {
    const total = Math.max(1, totalMinutes);
    onApply(total * 60, breakMin, pomodoroMode);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-header">
          <div className="settings-title">
            <span className="settings-icon">⚙️</span>
            <h2>Timer Settings</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Pomodoro Mode Toggle */}
        <div className="settings-card settings-toggle-card">
          <div className="settings-toggle-info">
            <span className="settings-card-title">🍅 Pomodoro Mode</span>
            <p className="settings-card-desc">Automatic work/break cycles with long breaks after completing a set of sessions</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={pomodoroMode}
              onChange={() => setPomodoroMode(!pomodoroMode)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* Focus + Break Settings */}
        <div className="settings-panels">
          {/* Focus Settings */}
          <div className="settings-card settings-focus-card">
            <span className="settings-card-title">🎯 Focus Settings</span>

            <div className="settings-duration-header">
              <span>Custom Duration</span>
              <span className="settings-duration-badge">{totalMinutes}m</span>
            </div>

            <div className="settings-spinners">
              <div className="spinner-group">
                <span className="spinner-label">hours</span>
                <div className="spinner-control">
                  <button className="spinner-btn" onClick={decHours}>−</button>
                  <span className="spinner-value">{String(hours).padStart(2, '0')}</span>
                  <button className="spinner-btn" onClick={incHours}>+</button>
                </div>
              </div>
              <div className="spinner-group">
                <span className="spinner-label">minutes</span>
                <div className="spinner-control">
                  <button className="spinner-btn" onClick={decMinutes}>−</button>
                  <span className="spinner-value">{String(minutes).padStart(2, '0')}</span>
                  <button className="spinner-btn" onClick={incMinutes}>+</button>
                </div>
              </div>
            </div>

            <div className="settings-presets">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  className={`preset-btn ${totalMinutes === p.minutes ? 'active' : ''}`}
                  onClick={() => selectPreset(p.minutes)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Break Settings */}
          <div className="settings-card settings-break-card">
            <span className="settings-card-title">☕ Break Settings</span>

            <div className="settings-duration-header">
              <span>Short Break Duration</span>
              <span className="settings-duration-badge break-badge">{breakMin} minutes</span>
            </div>

            <input
              type="range"
              className="break-slider"
              min={1}
              max={30}
              value={breakMin}
              onChange={(e) => setBreakMin(Number(e.target.value))}
            />
            <div className="break-slider-labels">
              <span>1 min</span>
              <span>30 min</span>
            </div>
          </div>
        </div>

        {/* Apply Button */}
        <button className="btn btn-primary settings-apply" onClick={handleApply}>
          Apply Settings
        </button>
      </div>
    </div>
  );
};

export default TimerSettings;

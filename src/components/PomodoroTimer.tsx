import React, { useEffect, useRef, useCallback } from 'react';
import { database } from '../firebase';
import { ref, update } from 'firebase/database';
import type { TimerState } from '../types';

/* ── sound assets ─────────────────────────────────────────────── */
const SOUNDS = [
  { id: 'cat', label: 'Cat', url: `${process.env.PUBLIC_URL}/sounds/cat.wav` },
  { id: 'dog', label: 'Dog', url: `${process.env.PUBLIC_URL}/sounds/dog.mp3` },
];

/* ── helpers ──────────────────────────────────────────────────── */
const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

/* ── props ────────────────────────────────────────────────────── */
interface Props {
  roomId: string;
  userName: string;      // display name for UI
  userUid: string;       // key under /rooms/{roomId}/users
  timer: TimerState;
  isOwner: boolean;      // true → this is the current user's timer
}

/* ── component ────────────────────────────────────────────────── */
const PomodoroTimer: React.FC<Props> = ({ roomId, userName, userUid, timer, isOwner }) => {
  const rafRef = useRef<number>(0);
  const displayRef = useRef<HTMLSpanElement>(null);

  /* Persist timer changes to Firebase */
  const patch = useCallback(
    (data: Partial<TimerState>) => {
      if (!isOwner) return;
      const timerRef = ref(database, `rooms/${roomId}/users/${userUid}/timer`);
      update(timerRef, { ...data, lastUpdated: Date.now() });
    },
    [isOwner, roomId, userUid],
  );

  /* ── local RAF countdown (display-only, owner also writes back) ─── */
  useEffect(() => {
    if (!timer.isRunning || !timer.endTime) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((timer.endTime! - Date.now()) / 1000));
      if (displayRef.current) displayRef.current.textContent = fmt(remaining);

      if (remaining <= 0) {
        /* session ended */
        const nextIsBreak = !timer.isBreak;
        const nextDuration = nextIsBreak ? timer.breakMinutes * 60 : timer.workMinutes * 60;

        if (isOwner) {
          /* play sound */
          try {
            const audio = new Audio(SOUNDS[0].url);
            audio.volume = 0.4;
            audio.play().catch(() => {});
          } catch { /* ignore */ }

          /* notify */
          if (Notification.permission === 'granted') {
            new Notification(nextIsBreak ? 'Break time!' : 'Focus time!', {
              body: nextIsBreak ? 'Great work — take a break.' : 'Break over — let\'s focus!',
            });
          }

          patch({
            isBreak: nextIsBreak,
            timeLeft: nextDuration,
            isRunning: true,
            endTime: Date.now() + nextDuration * 1000,
          });
        }
        return; // stop RAF, useEffect will re-run with new timer state
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [timer.isRunning, timer.endTime, timer.isBreak, timer.workMinutes, timer.breakMinutes, isOwner, patch]);

  /* Update document title for owner */
  useEffect(() => {
    if (!isOwner) return;
    const label = timer.isBreak ? 'Break' : 'Focus';
    document.title = `${fmt(timer.timeLeft)} · ${label} | Pomodoro`;
    return () => { document.title = 'Pomodoro Duo'; };
  }, [timer.timeLeft, timer.isBreak, isOwner]);

  /* ── controls (owner only) ─────────────────────────────────── */
  const handleStart = () => {
    const now = Date.now();
    patch({ isRunning: true, endTime: now + timer.timeLeft * 1000 });
  };

  const handlePause = () => {
    const remaining = timer.endTime ? Math.max(0, Math.ceil((timer.endTime - Date.now()) / 1000)) : timer.timeLeft;
    patch({ isRunning: false, timeLeft: remaining, endTime: null });
  };

  const handleReset = () => {
    const duration = timer.isBreak ? timer.breakMinutes * 60 : timer.workMinutes * 60;
    patch({ isRunning: false, timeLeft: duration, endTime: null });
  };

  const handleWorkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(1, Math.min(120, Number(e.target.value) || 1));
    const updates: Partial<TimerState> = { workMinutes: v };
    if (!timer.isRunning && !timer.isBreak) updates.timeLeft = v * 60;
    patch(updates);
  };

  const handleBreakChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(1, Math.min(60, Number(e.target.value) || 1));
    const updates: Partial<TimerState> = { breakMinutes: v };
    if (!timer.isRunning && timer.isBreak) updates.timeLeft = v * 60;
    patch(updates);
  };

  /* ── render ─────────────────────────────────────────────────── */
  const modeClass = timer.isBreak ? 'timer-card break' : 'timer-card focus';
  const ownerClass = isOwner ? ' owner' : ' peer';

  return (
    <div className={modeClass + ownerClass}>
      <div className="timer-header">
        <span className="timer-user">{userName}</span>
        <span className={`timer-badge ${timer.isBreak ? 'badge-break' : 'badge-focus'}`}>
          {timer.isBreak ? 'Break' : 'Focus'}
        </span>
      </div>

      <div className="timer-display">
        <span ref={displayRef}>{fmt(timer.timeLeft)}</span>
      </div>

      <div className={`timer-status ${timer.isRunning ? 'running' : 'paused'}`}>
        {timer.isRunning ? 'Running' : 'Paused'}
      </div>

      {isOwner && (
        <>
          <div className="timer-controls">
            {timer.isRunning ? (
              <button className="btn btn-pause" onClick={handlePause}>Pause</button>
            ) : (
              <button className="btn btn-start" onClick={handleStart}>Start</button>
            )}
            <button className="btn btn-reset" onClick={handleReset}>Reset</button>
          </div>

          <div className="timer-settings">
            <label>
              Work
              <input
                type="number"
                min={1}
                max={120}
                value={timer.workMinutes}
                onChange={handleWorkChange}
                disabled={timer.isRunning}
              />
              <span className="unit">min</span>
            </label>
            <label>
              Break
              <input
                type="number"
                min={1}
                max={60}
                value={timer.breakMinutes}
                onChange={handleBreakChange}
                disabled={timer.isRunning}
              />
              <span className="unit">min</span>
            </label>
          </div>
        </>
      )}
    </div>
  );
};

export default PomodoroTimer;

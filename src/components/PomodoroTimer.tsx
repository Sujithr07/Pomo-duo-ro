import React, { useEffect, useRef, useCallback, useState } from 'react';
import { database } from '../firebase';
import { ref, update, get, set } from 'firebase/database';
import type { TimerState } from '../types';
import TimerSettings from './TimerSettings';

/* ── sound assets ─────────────────────────────────────────────── */
const SOUNDS = [
  { id: 'cat', label: 'Cat', url: `${process.env.PUBLIC_URL}/sounds/cat.wav` },
  { id: 'dog', label: 'Dog', url: `${process.env.PUBLIC_URL}/sounds/dog.mp3` },
];

/* ── helpers ──────────────────────────────────────────────────── */
const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

/** Get today's date key in IST (UTC+5:30) */
const getTodayKeyIST = (): string => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const y = ist.getUTCFullYear();
  const mo = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
};

/* ── props ────────────────────────────────────────────────────── */
interface Props {
  roomId: string;
  userName: string;
  userUid: string;
  timer: TimerState;
  isOwner: boolean;
  onSessionComplete?: (duration: number, type: 'focus' | 'break') => void;
  activeTask?: string;
}

/* ── component ────────────────────────────────────────────────── */
const PomodoroTimer: React.FC<Props> = ({ roomId, userName, userUid, timer, isOwner, onSessionComplete, activeTask }) => {
  const rafRef = useRef<number>(0);
  const displayRef = useRef<HTMLSpanElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState(false);
  /** Track the last epoch‑ms we accounted for study time */
  const lastTickRef = useRef<number>(0);

  /* Persist timer changes to Firebase */
  const patch = useCallback(
    (data: Partial<TimerState>) => {
      if (!isOwner) return;
      const timerRef = ref(database, `rooms/${roomId}/users/${userUid}/timer`);
      update(timerRef, { ...data, lastUpdated: Date.now() });
    },
    [isOwner, roomId, userUid],
  );

  /** Add seconds to today's leaderboard entry */
  const addStudyTime = useCallback(
    async (seconds: number) => {
      if (!isOwner || seconds <= 0) return;
      const todayKey = getTodayKeyIST();
      const lbRef = ref(database, `leaderboard/${todayKey}/${userUid}`);
      const snap = await get(lbRef);
      const current = snap.exists() ? (snap.val().totalSeconds || 0) : 0;
      await set(lbRef, { displayName: userName, totalSeconds: current + seconds });
    },
    [isOwner, userUid, userName],
  );

  /** Shared handler for when the timer reaches zero.
   *  Called from both RAF (visible) and setInterval (background). */
  const sessionEndedRef = useRef(false);

  const handleTimerEnd = useCallback(() => {
    if (sessionEndedRef.current) return;       // prevent double-fire
    sessionEndedRef.current = true;

    /* Flush any remaining tracked study time */
    if (isOwner && !timer.isBreak && lastTickRef.current > 0) {
      const finalElapsed = Math.floor((Date.now() - lastTickRef.current) / 1000);
      if (finalElapsed > 0) addStudyTime(finalElapsed);
      lastTickRef.current = 0;
    }

    const nextIsBreak = !timer.isBreak;
    const nextDuration = nextIsBreak ? timer.breakMinutes * 60 : timer.workMinutes * 60;

    if (isOwner) {
      const sessionDuration = timer.isBreak ? timer.breakMinutes * 60 : timer.workMinutes * 60;
      onSessionComplete?.(sessionDuration, timer.isBreak ? 'break' : 'focus');

      /* play sound IMMEDIATELY: cat for focus end, dog for break end */
      try {
        const soundUrl = timer.isBreak ? SOUNDS[1].url : SOUNDS[0].url;
        const audio = new Audio(soundUrl);
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch { /* ignore */ }

      /* Windows system notification — unique tag so each one always shows */
      if (Notification.permission === 'granted') {
        new Notification(nextIsBreak ? '🎉 Focus session complete!' : '⏰ Break is over!', {
          body: nextIsBreak
            ? `Great work — take a ${timer.breakMinutes} minute break.`
            : 'Break over — time to focus!',
          icon: `${process.env.PUBLIC_URL}/manifest.json`.replace('manifest.json', 'favicon.ico'),
          tag: `timer-alert-${Date.now()}`,
          requireInteraction: true,
          silent: false,
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }

      if (pomodoroMode) {
        patch({
          isBreak: nextIsBreak,
          timeLeft: nextDuration,
          isRunning: true,
          endTime: Date.now() + nextDuration * 1000,
        });
      } else {
        patch({
          isBreak: nextIsBreak,
          timeLeft: nextDuration,
          isRunning: false,
          endTime: null,
        });
      }
    }
  }, [isOwner, timer.isBreak, timer.breakMinutes, timer.workMinutes, pomodoroMode, patch, addStudyTime, onSessionComplete]);

  /* ── RAF loop: smooth display updates when tab is visible ─── */
  useEffect(() => {
    if (!timer.isRunning || !timer.endTime) {
      lastTickRef.current = 0;
      sessionEndedRef.current = false;
      return;
    }

    if (lastTickRef.current === 0) lastTickRef.current = Date.now();
    sessionEndedRef.current = false;

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((timer.endTime! - now) / 1000));
      if (displayRef.current) displayRef.current.textContent = fmt(remaining);

      if (isOwner && !timer.isBreak && lastTickRef.current > 0) {
        const elapsed = Math.floor((now - lastTickRef.current) / 1000);
        if (elapsed >= 10) {
          addStudyTime(elapsed);
          lastTickRef.current = now;
        }
      }

      if (remaining <= 0) {
        handleTimerEnd();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [timer.isRunning, timer.endTime, timer.isBreak, timer.workMinutes, timer.breakMinutes, isOwner, handleTimerEnd, addStudyTime]);

  /* ── setInterval: fires even when tab is in background ──── */
  useEffect(() => {
    if (!timer.isRunning || !timer.endTime) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((timer.endTime! - now) / 1000));

      // Update display in case RAF is throttled
      if (displayRef.current) displayRef.current.textContent = fmt(remaining);

      if (remaining <= 0) {
        handleTimerEnd();
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [timer.isRunning, timer.endTime, handleTimerEnd]);

  /* Sync display when timer is NOT running (fixes reset & apply-settings display) */
  useEffect(() => {
    if (!timer.isRunning && displayRef.current) {
      displayRef.current.textContent = fmt(timer.timeLeft);
    }
  }, [timer.timeLeft, timer.isRunning]);

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
    lastTickRef.current = now;
    patch({ isRunning: true, endTime: now + timer.timeLeft * 1000 });
  };

  const handlePause = () => {
    const now = Date.now();
    const remaining = timer.endTime ? Math.max(0, Math.ceil((timer.endTime - now) / 1000)) : timer.timeLeft;
    // Flush study time on pause
    if (!timer.isBreak && lastTickRef.current > 0) {
      const elapsed = Math.floor((now - lastTickRef.current) / 1000);
      if (elapsed > 0) addStudyTime(elapsed);
      lastTickRef.current = 0;
    }
    patch({ isRunning: false, timeLeft: remaining, endTime: null });
  };

  const handleReset = () => {
    const duration = timer.isBreak ? timer.breakMinutes * 60 : timer.workMinutes * 60;
    lastTickRef.current = 0;
    patch({ isRunning: false, timeLeft: duration, endTime: null });
  };

  const handleApplySettings = (workSeconds: number, breakMinutes: number, isPomodoroMode: boolean) => {
    const workMin = Math.ceil(workSeconds / 60);
    setPomodoroMode(isPomodoroMode);
    const updates: Partial<TimerState> = {
      workMinutes: workMin,
      breakMinutes: breakMinutes,
    };
    /* Always update timeLeft when timer is stopped so the new value shows immediately */
    if (!timer.isRunning) {
      updates.timeLeft = timer.isBreak ? breakMinutes * 60 : workSeconds;
    }
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
        {isOwner && (
          <button
            className="timer-settings-btn"
            onClick={() => setShowSettings(true)}
            title="Timer Settings"
            disabled={timer.isRunning}
          >
            ⚙️
          </button>
        )}
      </div>

      <div className="timer-display">
        <span ref={displayRef}>{fmt(timer.timeLeft)}</span>
      </div>

      <div className={`timer-status ${timer.isRunning ? 'running' : 'paused'}`}>
        {timer.isRunning ? 'Running' : 'Paused'}
      </div>

      {isOwner && activeTask && (
        <div className="timer-active-task">
          🎯 {activeTask}
        </div>
      )}

      {isOwner && (
        <div className="timer-controls">
          {timer.isRunning ? (
            <button className="btn btn-pause" onClick={handlePause}>Pause</button>
          ) : (
            <button className="btn btn-start" onClick={handleStart}>Start</button>
          )}
          <button className="btn btn-reset" onClick={handleReset}>Reset</button>
        </div>
      )}

      {isOwner && !timer.isRunning && (
        <div className="timer-info-bar">
          <span>Focus: {timer.workMinutes}m</span>
          <span>Break: {timer.breakMinutes}m</span>
          <span>{pomodoroMode ? '🍅 Auto' : '⏸ Manual'}</span>
        </div>
      )}

      {showSettings && (
        <TimerSettings
          timer={timer}
          onApply={handleApplySettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default PomodoroTimer;

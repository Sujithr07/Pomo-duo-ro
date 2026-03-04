import React, { useEffect, useState, useCallback } from 'react';
import { database } from '../firebase';
import { ref, onValue, set } from 'firebase/database';

interface Props {
  userUid: string;
  userName: string;
}

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

const fmtHM = (sec: number): string => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const PRESETS = [1, 2, 3, 4, 5, 6, 8];

const DailyGoal: React.FC<Props> = ({ userUid, userName }) => {
  const [goalHours, setGoalHours] = useState<number>(0);
  const [todaySeconds, setTodaySeconds] = useState<number>(0);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');

  /* Listen to today's leaderboard entry for real-time progress */
  useEffect(() => {
    const todayKey = getTodayKeyIST();
    const lbRef = ref(database, `leaderboard/${todayKey}/${userUid}`);
    return onValue(lbRef, (snap) => {
      if (snap.exists()) {
        setTodaySeconds(snap.val().totalSeconds || 0);
      } else {
        setTodaySeconds(0);
      }
    });
  }, [userUid]);

  /* Listen to saved goal */
  useEffect(() => {
    const goalRef = ref(database, `goals/${userUid}/dailyHours`);
    return onValue(goalRef, (snap) => {
      if (snap.exists()) {
        setGoalHours(snap.val());
      } else {
        setGoalHours(0);
      }
    });
  }, [userUid]);

  const saveGoal = useCallback((hours: number) => {
    set(ref(database, `goals/${userUid}/dailyHours`), hours);
    setGoalHours(hours);
    setEditing(false);
  }, [userUid]);

  const goalSeconds = goalHours * 3600;
  const pct = goalSeconds > 0 ? Math.min((todaySeconds / goalSeconds) * 100, 100) : 0;
  const pctDisplay = goalSeconds > 0 ? Math.round(pct) : 0;
  const remaining = Math.max(0, goalSeconds - todaySeconds);

  return (
    <div className="daily-goal-panel">
      <div className="dg-header">
        <div className="dg-title-group">
          <span className="dg-icon">🎯</span>
          <h3 className="dg-title">Daily Goal</h3>
        </div>
        <button
          className="dg-edit-btn"
          onClick={() => { setEditing(!editing); setInputVal(String(goalHours || '')); }}
          title="Set goal"
        >
          {editing ? '✕' : '✏️'}
        </button>
      </div>

      {editing && (
        <div className="dg-edit-area">
          <div className="dg-presets">
            {PRESETS.map((h) => (
              <button
                key={h}
                className={`dg-preset ${goalHours === h ? 'active' : ''}`}
                onClick={() => saveGoal(h)}
              >
                {h}h
              </button>
            ))}
          </div>
          <div className="dg-custom-row">
            <input
              className="dg-custom-input"
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              placeholder="Custom hrs"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const v = parseFloat(inputVal);
                if (v > 0 && v <= 24) saveGoal(v);
              }}
              disabled={!inputVal || parseFloat(inputVal) <= 0}
            >
              Set
            </button>
          </div>
        </div>
      )}

      {goalHours > 0 ? (
        <div className="dg-progress-area">
          <div className="dg-stats-row">
            <span className="dg-studied">{fmtHM(todaySeconds)}</span>
            <span className="dg-of">of</span>
            <span className="dg-target">{goalHours}h goal</span>
          </div>
          <div className="dg-bar-track">
            <div
              className={`dg-bar-fill ${pct >= 100 ? 'complete' : ''}`}
              style={{ width: `${Math.max(pct, 1)}%` }}
            />
          </div>
          <div className="dg-info-row">
            <span className={`dg-pct ${pct >= 100 ? 'complete' : ''}`}>{pctDisplay}%</span>
            {pct < 100 ? (
              <span className="dg-remaining">{fmtHM(remaining)} remaining</span>
            ) : (
              <span className="dg-complete-msg">🎉 Goal reached!</span>
            )}
          </div>
        </div>
      ) : (
        <p className="dg-empty">Set a daily focus goal to track your progress!</p>
      )}
    </div>
  );
};

export default DailyGoal;

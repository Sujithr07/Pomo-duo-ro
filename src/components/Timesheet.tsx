import React, { useEffect, useState } from 'react';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';
import type { SessionLog } from '../types';

interface Props {
  userUid: string;
}

const fmtDur = (sec: number): string => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const fmtDate = (epoch: number): string => {
  const d = new Date(epoch);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (epoch: number): string => {
  const d = new Date(epoch);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const Timesheet: React.FC<Props> = ({ userUid }) => {
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessRef = ref(database, `sessions/${userUid}`);
    return onValue(sessRef, (snap) => {
      if (!snap.exists()) { setSessions([]); setLoading(false); return; }
      const data = snap.val() as Record<string, Omit<SessionLog, 'id'>>;
      const list = Object.entries(data)
        .map(([id, s]) => ({ id, ...s }))
        .sort((a, b) => b.date - a.date);
      setSessions(list);
      setLoading(false);
    });
  }, [userUid]);

  // Group sessions by date
  const grouped: Record<string, SessionLog[]> = {};
  sessions.forEach((s) => {
    const key = fmtDate(s.date);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  const totalToday = sessions
    .filter((s) => {
      const now = new Date();
      const d = new Date(s.date);
      return d.toDateString() === now.toDateString() && s.type === 'focus';
    })
    .reduce((acc, s) => acc + s.duration, 0);

  return (
    <div className="timesheet-page">
      <div className="ts-header">
        <div className="ts-title-group">
          <span className="ts-icon">🕐</span>
          <h2 className="ts-title">Timesheet</h2>
        </div>
        <div className="ts-stat">
          <span className="ts-stat-label">Today's Focus</span>
          <span className="ts-stat-value">{fmtDur(totalToday)}</span>
        </div>
      </div>

      {loading ? (
        <div className="ts-loading"><div className="spinner" /></div>
      ) : sessions.length === 0 ? (
        <div className="ts-empty">
          <p>No sessions recorded yet.</p>
          <p className="ts-empty-sub">Complete a focus session to see it here!</p>
        </div>
      ) : (
        <div className="ts-groups">
          {Object.entries(grouped).map(([dateStr, daySessions]) => {
            const focusTotal = daySessions.filter((s) => s.type === 'focus').reduce((a, s) => a + s.duration, 0);
            return (
              <div key={dateStr} className="ts-day">
                <div className="ts-day-header">
                  <span className="ts-day-date">{dateStr}</span>
                  <span className="ts-day-total">{fmtDur(focusTotal)} focus</span>
                </div>
                <div className="ts-day-rows">
                  {daySessions.map((s) => (
                    <div key={s.id} className={`ts-row ${s.type}`}>
                      <span className={`ts-type-dot ${s.type}`} />
                      <span className="ts-task-name">{s.taskName || 'Untitled'}</span>
                      <span className="ts-duration">{fmtDur(s.duration)}</span>
                      <span className="ts-time">{fmtTime(s.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Timesheet;

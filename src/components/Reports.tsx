import React, { useEffect, useState, useMemo } from 'react';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';
import type { SessionLog } from '../types';

interface Props {
  userUid: string;
}

const fmtDur = (sec: number): string => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const Reports: React.FC<Props> = ({ userUid }) => {
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessRef = ref(database, `sessions/${userUid}`);
    return onValue(sessRef, (snap) => {
      if (!snap.exists()) { setSessions([]); setLoading(false); return; }
      const data = snap.val() as Record<string, Omit<SessionLog, 'id'>>;
      const list = Object.entries(data)
        .map(([id, s]) => ({ id, ...s }))
        .filter((s) => s.type === 'focus');
      setSessions(list);
      setLoading(false);
    });
  }, [userUid]);

  /* ── computed stats ────────────────────────────────────── */
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - now.getDay() * 86400000;

    let todayTotal = 0;
    let weekTotal = 0;
    let allTotal = 0;
    let totalSessions = 0;

    // Daily breakdown for last 7 days
    const dailyMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart - i * 86400000);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      dailyMap[key] = 0;
    }

    // Per-task breakdown
    const taskMap: Record<string, number> = {};

    sessions.forEach((s) => {
      allTotal += s.duration;
      totalSessions++;

      if (s.date >= todayStart) todayTotal += s.duration;
      if (s.date >= weekStart) weekTotal += s.duration;

      // Daily
      const d = new Date(s.date);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (key in dailyMap) dailyMap[key] += s.duration;

      // Per task
      const tname = s.taskName || 'Untitled';
      taskMap[tname] = (taskMap[tname] || 0) + s.duration;
    });

    const dailyEntries = Object.entries(dailyMap);
    const maxDaily = Math.max(...dailyEntries.map(([, v]) => v), 1);

    const taskEntries = Object.entries(taskMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    const maxTask = taskEntries.length > 0 ? taskEntries[0][1] : 1;

    // Weekly breakdown (last 4 weeks)
    const weeklyMap: { label: string; seconds: number }[] = [];
    for (let w = 3; w >= 0; w--) {
      const wStart = weekStart - w * 7 * 86400000;
      const wEnd = wStart + 7 * 86400000;
      const wSec = sessions
        .filter((s) => s.date >= wStart && s.date < wEnd)
        .reduce((a, s) => a + s.duration, 0);
      const wd = new Date(wStart);
      weeklyMap.push({
        label: `${wd.getMonth() + 1}/${wd.getDate()}`,
        seconds: wSec,
      });
    }
    const maxWeekly = Math.max(...weeklyMap.map((w) => w.seconds), 1);

    const avgDaily = totalSessions > 0 ? Math.round(allTotal / Math.max(Object.keys(dailyMap).length, 1)) : 0;

    return {
      todayTotal, weekTotal, allTotal, totalSessions, avgDaily,
      dailyEntries, maxDaily,
      weeklyMap, maxWeekly,
      taskEntries, maxTask,
    };
  }, [sessions]);

  if (loading) {
    return (
      <div className="reports-page">
        <div className="ts-loading"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="rp-header">
        <span className="rp-icon">📊</span>
        <h2 className="rp-title">Reports</h2>
      </div>

      {/* summary cards */}
      <div className="rp-summary">
        <div className="rp-card">
          <span className="rp-card-label">Today</span>
          <span className="rp-card-value">{fmtDur(stats.todayTotal)}</span>
        </div>
        <div className="rp-card">
          <span className="rp-card-label">This Week</span>
          <span className="rp-card-value">{fmtDur(stats.weekTotal)}</span>
        </div>
        <div className="rp-card">
          <span className="rp-card-label">All Time</span>
          <span className="rp-card-value">{fmtDur(stats.allTotal)}</span>
        </div>
        <div className="rp-card">
          <span className="rp-card-label">Sessions</span>
          <span className="rp-card-value">{stats.totalSessions}</span>
        </div>
      </div>

      {/* daily chart (last 7 days) */}
      <div className="rp-section">
        <h3 className="rp-section-title">📅 Daily Productivity (Last 7 Days)</h3>
        <div className="rp-bar-chart">
          {stats.dailyEntries.map(([day, sec]) => {
            const pct = (sec / stats.maxDaily) * 100;
            const d = new Date();
            const todayKey = `${d.getMonth() + 1}/${d.getDate()}`;
            return (
              <div key={day} className={`rp-bar-col ${day === todayKey ? 'today' : ''}`}>
                <span className="rp-bar-val">{sec > 0 ? fmtDur(sec) : '—'}</span>
                <div className="rp-bar-track">
                  <div className="rp-bar-fill" style={{ height: `${Math.max(pct, 2)}%` }} />
                </div>
                <span className="rp-bar-label">{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* weekly chart */}
      <div className="rp-section">
        <h3 className="rp-section-title">📆 Weekly Productivity (Last 4 Weeks)</h3>
        <div className="rp-bar-chart rp-bar-chart-wide">
          {stats.weeklyMap.map((w, i) => {
            const pct = (w.seconds / stats.maxWeekly) * 100;
            return (
              <div key={i} className={`rp-bar-col ${i === stats.weeklyMap.length - 1 ? 'today' : ''}`}>
                <span className="rp-bar-val">{w.seconds > 0 ? fmtDur(w.seconds) : '—'}</span>
                <div className="rp-bar-track">
                  <div className="rp-bar-fill weekly" style={{ height: `${Math.max(pct, 2)}%` }} />
                </div>
                <span className="rp-bar-label">W{w.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* time per task */}
      <div className="rp-section">
        <h3 className="rp-section-title">🎯 Time per Task</h3>
        {stats.taskEntries.length === 0 ? (
          <p className="ts-empty">No task data yet.</p>
        ) : (
          <div className="rp-task-bars">
            {stats.taskEntries.map(([name, sec]) => {
              const pct = (sec / stats.maxTask) * 100;
              return (
                <div key={name} className="rp-task-row">
                  <span className="rp-task-name">{name}</span>
                  <div className="rp-task-bar-track">
                    <div className="rp-task-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="rp-task-time">{fmtDur(sec)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;

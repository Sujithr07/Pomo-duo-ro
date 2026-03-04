import React, { useEffect, useState, useCallback } from 'react';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';

interface LeaderboardEntry {
  uid: string;
  displayName: string;
  totalSeconds: number;
}

/** Get today's date key in IST (UTC+5:30), resets at midnight IST */
const getTodayKeyIST = (): string => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const fmtDuration = (totalSec: number): string => {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const RANK_ICONS = ['🥇', '🥈', '🥉'];

interface Props {
  /** If true, renders as an inline panel instead of a modal */
  inline?: boolean;
  onClose?: () => void;
}

const Leaderboard: React.FC<Props> = ({ inline, onClose }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const todayKey = getTodayKeyIST();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const lbRef = ref(database, `leaderboard/${todayKey}`);
      const snap = await get(lbRef);
      if (!snap.exists()) { setEntries([]); return; }
      const data = snap.val() as Record<string, { displayName: string; totalSeconds: number }>;
      const list: LeaderboardEntry[] = Object.entries(data)
        .map(([uid, v]) => ({ uid, displayName: v.displayName, totalSeconds: v.totalSeconds }))
        .sort((a, b) => b.totalSeconds - a.totalSeconds);
      setEntries(list);
    } finally {
      setLoading(false);
    }
  }, [todayKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => {
    setSpinning(true);
    fetchData().finally(() => setTimeout(() => setSpinning(false), 600));
  };

  const content = (
    <>
      <div className="lb-header">
        <div className="lb-title-group">
          <span className="lb-icon">🏆</span>
          <h2 className="lb-title">Leaderboard</h2>
        </div>
        <div className="lb-header-actions">
          <button
            className={`lb-refresh-btn ${spinning ? 'spinning' : ''}`}
            onClick={handleRefresh}
            title="Refresh"
          >
            🔄
          </button>
          {onClose && (
            <button className="modal-close" onClick={onClose}>✕</button>
          )}
        </div>
      </div>

      <p className="lb-date">{todayKey} (IST)</p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner" />
        </div>
      ) : entries.length === 0 ? (
        <p className="lb-empty">No study time recorded today yet. Start a focus session!</p>
      ) : (
        <div className="lb-list">
          {entries.map((entry, i) => (
            <div key={entry.uid} className={`lb-row ${i < 3 ? 'lb-top' : ''}`}>
              <span className="lb-rank">
                {i < 3 ? RANK_ICONS[i] : `#${i + 1}`}
              </span>
              <span className="lb-name">{entry.displayName}</span>
              <span className="lb-time">{fmtDuration(entry.totalSeconds)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (inline) {
    return <div className="leaderboard-panel">{content}</div>;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content leaderboard-modal" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
};

export default Leaderboard;

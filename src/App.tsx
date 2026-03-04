import React, { useEffect, useState, useCallback } from 'react';
import PomodoroTimer from './components/PomodoroTimer';
import Chat from './components/Chat';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import Leaderboard from './components/Leaderboard';
import TaskManager from './components/TaskManager';
import Timesheet from './components/Timesheet';
import Reports from './components/Reports';
import DailyGoal from './components/DailyGoal';
import {
  database,
  auth,
  onAuthStateChanged,
  setupPresence,
  setupRoomDisconnect,
  cancelRoomDisconnect,
  type User,
} from './firebase';
import { ref, onValue, set, get, update, remove, push } from 'firebase/database';
import { TimerState, RoomUser, defaultTimer } from './types';
import './App.css';

type AppView = 'study' | 'timesheet' | 'reports';

function App() {
  /* ── auth state ─────────────────────────────────────────────── */
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        setupPresence(u.uid);
        update(ref(database, `users/${u.uid}`), {
          online: true,
          lastSeen: Date.now(),
          displayName: u.displayName || 'User',
        });
      }
    });
    return unsub;
  }, []);

  /* ── room state ─────────────────────────────────────────────── */
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomUsers, setRoomUsers] = useState<Record<string, TimerState>>({});
  const [roomDisplayNames, setRoomDisplayNames] = useState<Record<string, string>>({});
  const [appView, setAppView] = useState<AppView>('study');
  const [activeTask, setActiveTask] = useState<string>('');

  /* Listen to room users */
  useEffect(() => {
    if (!roomId) { setRoomUsers({}); setRoomDisplayNames({}); return; }
    const usersRef = ref(database, `rooms/${roomId}/users`);
    const unsub = onValue(usersRef, (snap) => {
      if (!snap.exists()) { setRoomUsers({}); setRoomDisplayNames({}); return; }
      const data = snap.val() as Record<string, RoomUser>;
      const timers: Record<string, TimerState> = {};
      const names: Record<string, string> = {};
      for (const [uid, u] of Object.entries(data)) {
        timers[uid] = u.timer ?? defaultTimer();
        names[uid] = u.displayName;
      }
      setRoomUsers(timers);
      setRoomDisplayNames(names);
    });
    return unsub;
  }, [roomId]);

  /* Request notification permission */
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  /* ── join room ──────────────────────────────────────────────── */
  const joinRoom = useCallback(async (rid: string) => {
    if (!user) return;
    // Check room capacity
    const snap = await get(ref(database, `rooms/${rid}/users`));
    if (snap.exists()) {
      const existing = snap.val() as Record<string, RoomUser>;
      const uids = Object.keys(existing);
      if (!uids.includes(user.uid) && uids.length >= 2) {
        alert('Room is full (max 2 users).');
        return;
      }
    }
    // Add self to room
    const roomUser: RoomUser = {
      displayName: user.displayName || 'User',
      joinedAt: Date.now(),
      timer: defaultTimer(),
    };
    await set(ref(database, `rooms/${rid}/users/${user.uid}`), roomUser);
    await update(ref(database, `users/${user.uid}`), { currentRoom: rid });
    // Auto-remove from room on disconnect (browser crash, network loss)
    setupRoomDisconnect(rid, user.uid);
    setRoomId(rid);
    window.history.pushState({}, '', `?room=${rid}`);
  }, [user]);

  /* ── leave room ─────────────────────────────────────────────── */
  const leaveRoom = async () => {
    if (user && roomId) {
      cancelRoomDisconnect(roomId, user.uid);
      await remove(ref(database, `rooms/${roomId}/users/${user.uid}`));
      await update(ref(database, `users/${user.uid}`), { currentRoom: null });
    }
    setRoomId(null);
    setRoomUsers({});
    window.history.pushState({}, '', window.location.pathname);
  };

  /* ── copy link ──────────────────────────────────────────────── */
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    if (!roomId) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ── log completed session ──────────────────────────────────── */
  const logSession = useCallback(
    (duration: number, type: 'focus' | 'break') => {
      if (!user || duration <= 0) return;
      const sessRef = ref(database, `sessions/${user.uid}`);
      push(sessRef, {
        taskName: activeTask || '',
        duration,
        date: Date.now(),
        type,
      });
    },
    [user, activeTask],
  );

  /* ── auto-join from URL ─────────────────────────────────────── */
  useEffect(() => {
    if (!user) return;
    const p = new URLSearchParams(window.location.search);
    const r = p.get('room');
    if (r && !roomId) joinRoom(r);
  }, [user, roomId, joinRoom]);

  /* ── cleanup on tab close ───────────────────────────────────── */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user && roomId) {
        // Best-effort sync removal (onDisconnect is the real safety net)
        navigator.sendBeacon?.('about:blank'); // keep connection alive briefly
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user, roomId]);

  /* ── loading / auth gate ────────────────────────────────────── */
  if (!authReady) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="spinner" />
          <p style={{ color: 'var(--text-dim)' }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  /* ── dashboard (no room) ────────────────────────────────────── */
  if (!roomId) {
    return <Dashboard user={user} onJoinRoom={joinRoom} />;
  }

  /* ── study room ─────────────────────────────────────────────── */
  const userUids = Object.keys(roomUsers);

  return (
    <div className="app">
      {/* ── nav bar ─────────────────────────────────────────── */}
      <div className="nav-bar">
        <button
          className={`nav-tab ${appView === 'study' ? 'active' : ''}`}
          onClick={() => setAppView('study')}
        >
          🍅 Study Room
        </button>
        <button
          className={`nav-tab ${appView === 'timesheet' ? 'active' : ''}`}
          onClick={() => setAppView('timesheet')}
        >
          🕐 Timesheet
        </button>
        <button
          className={`nav-tab ${appView === 'reports' ? 'active' : ''}`}
          onClick={() => setAppView('reports')}
        >
          📊 Reports
        </button>
      </div>

      {/* ── compact room strip ──────────────────────────────── */}
      <div className="room-strip">
        <span className="room-strip-id">
          Room: <strong>{roomId}</strong>
        </span>
        <button className="room-strip-btn" onClick={copyLink} title="Copy invite link">
          {copied ? '✓ Copied' : '🔗 Invite'}
        </button>
        <button className="room-strip-btn danger" onClick={leaveRoom} title="Leave room">
          ✕ Leave
        </button>
      </div>

      {/* ── view: study ─────────────────────────────────────── */}
      {appView === 'study' && (
        <div className="study-layout">
          <div className="timers-col">
            <div className="timers-row">
              {userUids.length === 0 && <p>Connecting…</p>}

              {userUids.map((uid) => (
                <PomodoroTimer
                  key={uid}
                  roomId={roomId}
                  userName={roomDisplayNames[uid] || 'User'}
                  userUid={uid}
                  timer={roomUsers[uid]}
                  isOwner={uid === user.uid}
                  onSessionComplete={uid === user.uid ? logSession : undefined}
                  activeTask={activeTask}
                />
              ))}

              {userUids.length === 1 && (
                <div className="timer-card placeholder">
                  <p>Waiting for your study partner…</p>
                  <p className="small">Invite a friend from the dashboard, or share the room link.</p>
                </div>
              )}
            </div>

            {/* task manager below timers */}
            <TaskManager
              userUid={user.uid}
              onSelectTask={setActiveTask}
              activeTask={activeTask}
            />
          </div>

          <div className="sidebar-col">
            <Leaderboard inline />
            <DailyGoal userUid={user.uid} userName={user.displayName || 'User'} />
          </div>
        </div>
      )}

      {/* ── view: timesheet ─────────────────────────────────── */}
      {appView === 'timesheet' && <Timesheet userUid={user.uid} />}

      {/* ── view: reports ───────────────────────────────────── */}
      {appView === 'reports' && <Reports userUid={user.uid} />}

      <Chat roomId={roomId} userName={user.displayName || 'User'} />
    </div>
  );
}

export default App;

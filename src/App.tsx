import React, { useEffect, useState } from 'react';
import PomodoroTimer from './components/PomodoroTimer';
import Chat from './components/Chat';
import { database } from './firebase';
import { ref, onValue, set, get } from 'firebase/database';
import { TimerState, UserData, defaultTimer } from './types';
import './App.css';

/* ── helpers ──────────────────────────────────────────────────── */
const generateRoomId = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

/* ── component ────────────────────────────────────────────────── */
function App() {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // All users in the room: { userName: TimerState }
  const [users, setUsers] = useState<Record<string, TimerState>>({});

  /* Pre-fill room id from URL */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get('room');
    if (r) setRoomId(r);
  }, []);

  /* Listen to room users once joined */
  useEffect(() => {
    if (!joined || !roomId) return;
    const usersRef = ref(database, `rooms/${roomId}/users`);
    const unsub = onValue(usersRef, (snap) => {
      if (!snap.exists()) { setUsers({}); return; }
      const data = snap.val() as Record<string, UserData>;
      const mapped: Record<string, TimerState> = {};
      for (const [name, u] of Object.entries(data)) {
        mapped[name] = u.timer ?? defaultTimer();
      }
      setUsers(mapped);
    });
    return unsub;
  }, [joined, roomId]);

  /* Request notification permission once */
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  /* ── create room ────────────────────────────────────────────── */
  const createRoom = async () => {
    if (!userName.trim()) { setError('Enter your name.'); return; }
    setLoading(true);
    setError('');
    try {
      const id = generateRoomId();
      const userData: UserData = {
        name: userName.trim(),
        joinedAt: Date.now(),
        timer: defaultTimer(),
      };
      await set(ref(database, `rooms/${id}/users/${userName.trim()}`), userData);
      setRoomId(id);
      window.history.pushState({}, '', `?room=${id}`);
      setJoined(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── join room ──────────────────────────────────────────────── */
  const joinRoom = async () => {
    const name = userName.trim();
    const rid = roomId.trim().toUpperCase();
    if (!name) { setError('Enter your name.'); return; }
    if (!rid) { setError('Enter a room ID.'); return; }
    setLoading(true);
    setError('');
    try {
      const roomSnap = await get(ref(database, `rooms/${rid}/users`));
      if (!roomSnap.exists()) {
        setError('Room not found.');
        setLoading(false);
        return;
      }
      const existing = roomSnap.val() as Record<string, UserData>;
      const names = Object.keys(existing);

      /* already in room → rejoin */
      if (names.includes(name)) {
        setRoomId(rid);
        window.history.pushState({}, '', `?room=${rid}`);
        setJoined(true);
        setLoading(false);
        return;
      }

      /* enforce 2-user max */
      if (names.length >= 2) {
        setError('Room is full (max 2 users).');
        setLoading(false);
        return;
      }

      const userData: UserData = {
        name,
        joinedAt: Date.now(),
        timer: defaultTimer(),
      };
      await set(ref(database, `rooms/${rid}/users/${name}`), userData);
      setRoomId(rid);
      window.history.pushState({}, '', `?room=${rid}`);
      setJoined(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── leave room ─────────────────────────────────────────────── */
  const leaveRoom = () => {
    setJoined(false);
    setUsers({});
    setRoomId('');
    window.history.pushState({}, '', window.location.pathname);
  };

  /* ── copy link ──────────────────────────────────────────────── */
  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /* ── render: lobby ──────────────────────────────────────────── */
  if (!joined) {
    return (
      <div className="app">
        <div className="lobby">
          <h1 className="logo">Pomodoro Duo</h1>
          <p className="tagline">Study side-by-side with a friend</p>

          <div className="field">
            <label htmlFor="name">Your Name</label>
            <input
              id="name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              disabled={loading}
              maxLength={20}
            />
          </div>

          <div className="field">
            <label htmlFor="room">Room ID (leave blank to create)</label>
            <input
              id="room"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="e.g. A1B2C3"
              disabled={loading}
              maxLength={6}
            />
          </div>

          {error && <p className="error">{error}</p>}

          <div className="lobby-buttons">
            <button className="btn btn-primary" onClick={createRoom} disabled={loading}>
              {loading ? 'Creating…' : 'Create Room'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={joinRoom}
              disabled={loading || !roomId.trim()}
            >
              {loading ? 'Joining…' : 'Join Room'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── render: study room ─────────────────────────────────────── */
  const userNames = Object.keys(users);

  return (
    <div className="app">
      <div className="topbar">
        <span className="topbar-room">
          Room: <strong>{roomId}</strong>
        </span>
        <button className="btn-link" onClick={copyLink}>
          {copied ? 'Copied!' : 'Copy invite link'}
        </button>
        <button className="btn-link danger" onClick={leaveRoom}>
          Leave
        </button>
      </div>

      <div className="timers-row">
        {userNames.length === 0 && <p>Connecting…</p>}

        {userNames.map((name) => (
          <PomodoroTimer
            key={name}
            roomId={roomId}
            userName={name}
            timer={users[name]}
            isOwner={name === userName.trim()}
          />
        ))}

        {userNames.length === 1 && (
          <div className="timer-card placeholder">
            <p>Waiting for your study partner…</p>
            <p className="small">Share the room link to invite them.</p>
          </div>
        )}
      </div>

      <Chat roomId={roomId} userName={userName.trim()} />
    </div>
  );
}

export default App;

import React, { useEffect, useState } from 'react';
import { database, auth, signOut } from '../firebase';
import { ref, onValue, set, get, remove, push, update } from 'firebase/database';
import type { User } from '../firebase';
import type { UserProfile, FriendRequest, RoomInvite } from '../types';

interface Props {
  user: User;
  onJoinRoom: (roomId: string) => void;
}

const Dashboard: React.FC<Props> = ({ user, onJoinRoom }) => {
  const [friends, setFriends] = useState<Record<string, UserProfile>>({});
  const [friendUids, setFriendUids] = useState<string[]>([]);
  const [requests, setRequests] = useState<(FriendRequest & { key: string })[]>([]);
  const [invites, setInvites] = useState<(RoomInvite & { key: string })[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<{ uid: string; profile: UserProfile } | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);

  const uid = user.uid;
  const displayName = user.displayName || 'User';

  /* ── listen: friends list ───────────────────────────────────── */
  useEffect(() => {
    const fRef = ref(database, `friends/${uid}`);
    return onValue(fRef, (snap) => {
      if (!snap.exists()) { setFriendUids([]); return; }
      setFriendUids(Object.keys(snap.val()));
    });
  }, [uid]);

  /* ── listen: friend profiles (online status) ────────────────── */
  useEffect(() => {
    if (friendUids.length === 0) { setFriends({}); return; }
    const unsubs = friendUids.map((fuid) => {
      const pRef = ref(database, `users/${fuid}`);
      return onValue(pRef, (snap) => {
        if (snap.exists()) {
          setFriends((prev) => ({ ...prev, [fuid]: snap.val() as UserProfile }));
        }
      });
    });
    return () => unsubs.forEach((u) => u());
  }, [friendUids]);

  /* ── listen: friend requests ────────────────────────────────── */
  useEffect(() => {
    const rRef = ref(database, `friendRequests/${uid}`);
    return onValue(rRef, (snap) => {
      if (!snap.exists()) { setRequests([]); return; }
      const data = snap.val() as Record<string, FriendRequest>;
      setRequests(Object.entries(data).map(([key, v]) => ({ key, ...v })));
    });
  }, [uid]);

  /* ── listen: room invites ───────────────────────────────────── */
  useEffect(() => {
    const iRef = ref(database, `roomInvites/${uid}`);
    return onValue(iRef, (snap) => {
      if (!snap.exists()) { setInvites([]); return; }
      const data = snap.val() as Record<string, RoomInvite>;
      setInvites(Object.entries(data).map(([key, v]) => ({ key, ...v })));
    });
  }, [uid]);

  /* ── search user by email ───────────────────────────────────── */
  const handleSearch = async () => {
    const q = searchEmail.trim().toLowerCase();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    try {
      const snap = await get(ref(database, 'users'));
      if (!snap.exists()) { setSearchError('No users found.'); return; }
      const allUsers = snap.val() as Record<string, UserProfile>;
      const found = Object.entries(allUsers).find(
        ([id, p]) => p.email === q && id !== uid,
      );
      if (!found) { setSearchError('No user with that email.'); return; }
      setSearchResult({ uid: found[0], profile: found[1] });
    } catch {
      setSearchError('Search failed.');
    } finally {
      setSearching(false);
    }
  };

  /* ── send friend request ────────────────────────────────────── */
  const sendRequest = async (toUid: string) => {
    // Check already friends
    if (friendUids.includes(toUid)) { setSearchError('Already friends!'); return; }
    const req: FriendRequest = {
      fromUid: uid,
      fromName: displayName,
      timestamp: Date.now(),
    };
    await set(ref(database, `friendRequests/${toUid}/${uid}`), req);
    setSearchResult(null);
    setSearchEmail('');
    setSearchError('Friend request sent!');
  };

  /* ── accept friend request ──────────────────────────────────── */
  const acceptRequest = async (fromUid: string, key: string) => {
    // Add both directions
    await set(ref(database, `friends/${uid}/${fromUid}`), true);
    await set(ref(database, `friends/${fromUid}/${uid}`), true);
    // Remove the request
    await remove(ref(database, `friendRequests/${uid}/${key}`));
  };

  /* ── decline friend request ─────────────────────────────────── */
  const declineRequest = async (key: string) => {
    await remove(ref(database, `friendRequests/${uid}/${key}`));
  };

  /* ── invite friend to a room ────────────────────────────────── */
  const inviteFriend = async (friendUid: string) => {
    // Create a new room
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const invite: RoomInvite = {
      fromUid: uid,
      fromName: displayName,
      roomId,
      timestamp: Date.now(),
    };
    await push(ref(database, `roomInvites/${friendUid}`), invite);
    // Join the room ourselves
    onJoinRoom(roomId);
  };

  /* ── accept room invite ─────────────────────────────────────── */
  const acceptInvite = async (invite: RoomInvite & { key: string }) => {
    await remove(ref(database, `roomInvites/${uid}/${invite.key}`));
    onJoinRoom(invite.roomId);
  };

  const declineInvite = async (key: string) => {
    await remove(ref(database, `roomInvites/${uid}/${key}`));
  };

  /* ── remove friend ──────────────────────────────────────────── */
  const removeFriend = async (friendUid: string) => {
    await remove(ref(database, `friends/${uid}/${friendUid}`));
    await remove(ref(database, `friends/${friendUid}/${uid}`));
    setFriends((prev) => {
      const next = { ...prev };
      delete next[friendUid];
      return next;
    });
  };

  /* ── sign out ───────────────────────────────────────────────── */
  const handleSignOut = async () => {
    await update(ref(database, `users/${uid}`), { online: false, lastSeen: Date.now() });
    await signOut(auth);
  };

  return (
    <div className="app">
      <div className="dashboard">
        {/* header */}
        <div className="dash-header">
          <div>
            <h1 className="logo">Pomodoro Duo</h1>
            <p className="dash-greeting">Welcome, <strong>{displayName}</strong></p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleSignOut}>Sign Out</button>
        </div>

        {/* incoming invites */}
        {invites.length > 0 && (
          <div className="dash-section">
            <h3 className="dash-section-title">Room Invites</h3>
            {invites.map((inv) => (
              <div key={inv.key} className="dash-row">
                <span><strong>{inv.fromName}</strong> invited you to study</span>
                <div className="dash-row-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => acceptInvite(inv)}>Join</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => declineInvite(inv.key)}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* friend requests */}
        {requests.length > 0 && (
          <div className="dash-section">
            <h3 className="dash-section-title">Friend Requests</h3>
            {requests.map((r) => (
              <div key={r.key} className="dash-row">
                <span><strong>{r.fromName}</strong> wants to be friends</span>
                <div className="dash-row-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => acceptRequest(r.fromUid, r.key)}>Accept</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => declineRequest(r.key)}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* friends list */}
        <div className="dash-section">
          <h3 className="dash-section-title">Friends</h3>
          {friendUids.length === 0 ? (
            <p className="dash-empty">No friends yet. Search by email to add someone!</p>
          ) : (
            friendUids.map((fuid) => {
              const f = friends[fuid];
              if (!f) return null;
              return (
                <div key={fuid} className="dash-row">
                  <div className="dash-friend-info">
                    <span className={`status-dot ${f.online ? 'online' : 'offline'}`} />
                    <span className="dash-friend-name">{f.displayName}</span>
                    <span className="dash-friend-status">
                      {f.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="dash-row-actions">
                    {f.online && (
                      <button className="btn btn-primary btn-sm" onClick={() => inviteFriend(fuid)}>
                        Invite to study
                      </button>
                    )}
                    <button className="btn btn-secondary btn-sm btn-danger-text" onClick={() => removeFriend(fuid)}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* add friend */}
        <div className="dash-section">
          <h3 className="dash-section-title">Add Friend</h3>
          <div className="dash-search">
            <input
              className="dash-search-input"
              type="email"
              placeholder="Enter friend's email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn btn-primary btn-sm" onClick={handleSearch} disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {searchError && <p className={searchError.includes('sent') ? 'success-msg' : 'error'} style={{ marginTop: '0.5rem' }}>{searchError}</p>}
          {searchResult && (
            <div className="dash-row" style={{ marginTop: '0.5rem' }}>
              <div className="dash-friend-info">
                <span className={`status-dot ${searchResult.profile.online ? 'online' : 'offline'}`} />
                <span className="dash-friend-name">{searchResult.profile.displayName}</span>
                <span className="dash-friend-status">{searchResult.profile.email}</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => sendRequest(searchResult.uid)}>
                Send Request
              </button>
            </div>
          )}
        </div>

        {/* create / join room manually */}
        <div className="dash-section">
          <h3 className="dash-section-title">Quick Room</h3>
          <p className="dash-empty" style={{ marginBottom: '0.5rem' }}>
            Create a room or invite an online friend above.
          </p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => {
            const rid = Math.random().toString(36).substring(2, 8).toUpperCase();
            onJoinRoom(rid);
          }}>
            Create New Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

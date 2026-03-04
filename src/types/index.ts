/** Timer state stored in Firebase per user */
export interface TimerState {
  timeLeft: number;
  isRunning: boolean;
  isBreak: boolean;
  workMinutes: number;
  breakMinutes: number;
  lastUpdated: number;
  /** Absolute epoch-ms when the current countdown reaches zero */
  endTime: number | null;
}

/** Per-user data stored under rooms/{roomId}/users/{uid} */
export interface RoomUser {
  displayName: string;
  joinedAt: number;
  timer: TimerState;
}

/** User profile stored under users/{uid} */
export interface UserProfile {
  displayName: string;
  email: string;
  online: boolean;
  lastSeen: number;
  currentRoom: string | null;
}

/** Friend request stored under friendRequests/{toUid}/{fromUid} */
export interface FriendRequest {
  fromUid: string;
  fromName: string;
  timestamp: number;
}

/** Room invite stored under roomInvites/{toUid}/{inviteId} */
export interface RoomInvite {
  fromUid: string;
  fromName: string;
  roomId: string;
  timestamp: number;
}

/** Chat message */
export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
}

/** Default timer state factory */
export const defaultTimer = (work = 25, brk = 5): TimerState => ({
  timeLeft: work * 60,
  isRunning: false,
  isBreak: false,
  workMinutes: work,
  breakMinutes: brk,
  lastUpdated: Date.now(),
  endTime: null,
});

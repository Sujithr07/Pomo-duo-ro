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

/** Per-user data stored under rooms/{roomId}/users/{userName} */
export interface UserData {
  name: string;
  joinedAt: number;
  timer: TimerState;
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

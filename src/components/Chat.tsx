import React, { useState, useEffect, useRef } from 'react';
import { database } from '../firebase';
import { ref, onValue, push, set } from 'firebase/database';
import { ChatMessage } from '../types';

interface Props {
  roomId: string;
  userName: string;
}

const Chat: React.FC<Props> = ({ roomId, userName }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [minimized, setMinimized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* listen for messages */
  useEffect(() => {
    const messagesRef = ref(database, `rooms/${roomId}/messages`);
    const unsub = onValue(messagesRef, (snap) => {
      if (!snap.exists()) { setMessages([]); return; }
      const data = snap.val() as Record<string, Omit<ChatMessage, 'id'>>;
      const list = Object.entries(data)
        .map(([id, m]) => ({ id, ...m }))
        .sort((a, b) => a.timestamp - b.timestamp);
      setMessages(list);
    });
    return unsub;
  }, [roomId]);

  /* auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* send */
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const newRef = push(ref(database, `rooms/${roomId}/messages`));
    set(newRef, { text, sender: userName, timestamp: Date.now() });
    setDraft('');
  };

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`chat-container ${minimized ? 'chat-minimized' : ''}`}>
      <div className="chat-header" onClick={() => setMinimized((v) => !v)}>
        <span>Chat {!minimized && messages.length > 0 && `(${messages.length})`}</span>
        <span>{minimized ? '▲' : '▼'}</span>
      </div>

      {!minimized && (
        <>
          <div className="chat-messages">
            {messages.length === 0 && (
              <p className="chat-empty">No messages yet.</p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`chat-bubble ${m.sender === userName ? 'mine' : 'theirs'}`}
              >
                <span className="chat-sender">{m.sender}</span>
                <span className="chat-text">{m.text}</span>
                <span className="chat-time">{fmtTime(m.timestamp)}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form className="chat-input" onSubmit={send}>
            <input
              type="text"
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" disabled={!draft.trim()}>
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default Chat;

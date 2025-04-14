import React, { useState, useEffect } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { io, Socket } from 'socket.io-client';
import PomodoroTimer from './components/PomodoroTimer';

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    background: #2d1b69;
    color: #e2e8f0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }

  * {
    box-sizing: border-box;
  }

  :root {
    color-scheme: dark;
  }
`;

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(
    135deg,
    #2d1b69 0%,
    #a259ff 25%,
    rgba(255, 255, 255, 0.8) 50%,
    #ff69b4 75%,
    #7b2c70 100%
  );
  padding: 2rem;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(255, 105, 180, 0.15) 0%, transparent 50%);
    z-index: 0;
    animation: shimmer 15s infinite linear;
  }

  @keyframes shimmer {
    0% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.8;
    }
    100% {
      opacity: 0.5;
    }
  }
`;

const LoginContainer = styled.div`
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 20px;
  padding: 2rem;
  margin: 1rem;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
`;

const Input = styled.input`
  padding: 0.75rem;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 8px;
  width: 100%;
  font-size: 1rem;
  color: #e2e8f0;
  
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  background: ${props => props.variant === 'secondary' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(124, 58, 237, 0.5)'};
  border: 1px solid ${props => props.variant === 'secondary' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(124, 58, 237, 0.3)'};
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
  width: 100%;

  &:hover {
    background: ${props => props.variant === 'secondary' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(124, 58, 237, 0.6)'};
    transform: translateY(-2px);
  }
`;

const TimersContainer = styled.div`
  display: flex;
  gap: 3rem;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  max-width: 1600px;
  width: 100%;
  position: relative;
  z-index: 1;
  padding: 0 2rem;

  @media (max-width: 1200px) {
    flex-direction: column;
    align-items: center;
    gap: 2rem;
  }
`;

interface User {
  id: string;
  username: string;
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [serverUrl, setServerUrl] = useState(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000');
  const [sessionId, setSessionId] = useState('');
  const [showJoinOptions, setShowJoinOptions] = useState(false);
  const [sessionCreated, setSessionCreated] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    const newSocket = io(serverUrl);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    return () => {
      newSocket.close();
    };
  }, [serverUrl]);

  const handleCreateSession = () => {
    if (socket && username) {
      // Generate a random session ID
      const newSessionId = Math.random().toString(36).substring(2, 10);
      setSessionId(newSessionId);
      setSessionCreated(true);
      setShowJoinOptions(false);
      setIsCreator(true);
    }
  };

  const handleJoinSession = () => {
    if (socket && username && sessionId) {
      socket.emit('joinRoom', { roomId: sessionId, userId: username });
      setUser({ id: username, username });
      setRoomId(sessionId);
      setIsCreator(false);
    }
  };

  if (!user) {
    return (
      <>
        <GlobalStyle />
        <AppContainer>
          <LoginContainer>
            <h2>Pomodoro Duo Study</h2>
            
            {!showJoinOptions && !sessionCreated ? (
              <>
                <Input
                  type="text"
                  placeholder="Your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Input
                  type="text"
                  placeholder="Server URL (default: http://localhost:5000)"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                />
                <Button 
                  onClick={() => setShowJoinOptions(true)} 
                  disabled={!isConnected || !username}
                >
                  {isConnected ? 'Continue' : 'Connecting...'}
                </Button>
                {!isConnected && <p>Connecting to server... Make sure the server is running.</p>}
              </>
            ) : sessionCreated ? (
              <>
                <h3>Session Created!</h3>
                <p>Share this session ID with your study partner:</p>
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.1)', 
                  padding: '10px', 
                  borderRadius: '5px',
                  marginBottom: '20px',
                  textAlign: 'center',
                  fontSize: '1.2rem',
                  fontWeight: 'bold'
                }}>
                  {sessionId}
                </div>
                <Button onClick={handleJoinSession} disabled={!isConnected}>
                  Join My Session
                </Button>
                <Button 
                  onClick={() => {
                    setSessionCreated(false);
                    setShowJoinOptions(true);
                  }}
                  style={{ marginTop: '10px', background: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.2)' }}
                >
                  Back
                </Button>
              </>
            ) : (
              <>
                <h3>Are you creating or joining a session?</h3>
                <div style={{ marginBottom: '20px' }}>
                  <Button 
                    onClick={handleCreateSession} 
                    style={{ marginBottom: '10px' }}
                  >
                    I'm Creating a New Session
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowJoinOptions(false);
                      setSessionCreated(true);
                      setIsCreator(false);
                    }}
                    style={{ marginBottom: '10px', background: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.2)' }}
                  >
                    Back
                  </Button>
                </div>
                
                <h3>I'm Joining an Existing Session</h3>
                <Input
                  type="text"
                  placeholder="Enter session ID from your partner"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                />
                <Button 
                  onClick={handleJoinSession} 
                  disabled={!isConnected || !sessionId}
                  style={{ marginBottom: '20px' }}
                >
                  Join Session
                </Button>
              </>
            )}
          </LoginContainer>
        </AppContainer>
      </>
    );
  }

  return (
    <>
      <GlobalStyle />
      <AppContainer>
        <TimersContainer>
          <PomodoroTimer 
            user={username} 
            socket={socket} 
            roomId={roomId}
            isHost={isCreator}
          />
          <PomodoroTimer 
            user={isCreator ? "Partner" : username}
            socket={socket}
            roomId={roomId}
            isHost={!isCreator}
          />
        </TimersContainer>
      </AppContainer>
    </>
  );
}

export default App; 
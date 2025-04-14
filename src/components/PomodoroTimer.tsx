import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { css } from 'styled-components';
import { Socket } from 'socket.io-client';

// Update the audio file paths
const CAT_SOUND = `${process.env.PUBLIC_URL}/sounds/cat.wav`;
const DOG_SOUND = `${process.env.PUBLIC_URL}/sounds/dog.mp3`;

const TimerContainer = styled.div<{ isBreak: boolean }>`
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 20px;
  padding: 2.5rem;
  margin: 1rem;
  width: 100%;
  max-width: 600px;
  min-width: 550px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 8px 32px 0 rgba(15, 23, 42, 0.5);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 40px 0 rgba(15, 23, 42, 0.6);
  }
`;

const UserName = styled.div`
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 1.2rem;
  font-weight: 500;
  text-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
`;

const TimeDisplay = styled.div<{ isBreak: boolean }>`
  font-size: 4.5rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  margin: 1.5rem 0;
  transition: all 0.3s ease;
  font-family: 'JetBrains Mono', monospace;
  text-shadow: 0 0 20px ${props => props.isBreak ? 'rgba(236, 72, 153, 0.5)' : 'rgba(99, 102, 241, 0.5)'};
  
  &::after {
    content: '';
    display: block;
    width: 100px;
    height: 2px;
    background: linear-gradient(90deg, 
      transparent, 
      ${props => props.isBreak ? '#ec4899' : '#6366f1'}, 
      transparent
    );
    margin: 1rem auto;
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
  backdrop-filter: blur(5px);

  &:hover {
    background: ${props => props.variant === 'secondary' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(124, 58, 237, 0.6)'};
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    background: rgba(75, 85, 99, 0.3);
    border-color: rgba(75, 85, 99, 0.3);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const SettingsContainer = styled.div`
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: rgba(15, 23, 42, 0.7);
  border-radius: 15px;
  border: 1px solid rgba(99, 102, 241, 0.2);
  backdrop-filter: blur(5px);
`;

const Input = styled.input`
  padding: 0.75rem;
  margin: 0.5rem;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 8px;
  width: 70px;
  font-size: 1rem;
  text-align: center;
  color: #e2e8f0;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
  }
`;

const Label = styled.label`
  display: block;
  margin: 0.75rem 0;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  font-size: 0.95rem;
`;

const PresetButton = styled(Button)`
  margin: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
`;

const SoundSelect = styled.select`
  padding: 0.75rem;
  margin: 0.5rem;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 8px;
  width: 200px;
  font-size: 1rem;
  color: #e2e8f0;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
  }

  option {
    background: #1e293b;
    color: #e2e8f0;
  }
`;

const StatusIndicator = styled.div<{ isBreak: boolean }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${props => props.isBreak ? '#ec4899' : '#6366f1'};
  box-shadow: 0 0 10px ${props => props.isBreak ? 'rgba(236, 72, 153, 0.5)' : 'rgba(99, 102, 241, 0.5)'};
  margin: 1rem auto;
`;

const FlashAnimation = styled.div<{ show: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.8) 0%, transparent 70%);
  opacity: ${props => props.show ? 1 : 0};
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: 1000;
`;

const ResetButton = styled(Button)`
  margin-top: 1rem;
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.3);
  color: rgba(255, 255, 255, 0.9);
  
  &:hover {
    background: rgba(239, 68, 68, 0.3);
    border-color: rgba(239, 68, 68, 0.4);
  }
`;

interface UserStats {
  completedPomodoros: number;
  totalWorkTime: number;  // in minutes
  totalBreakTime: number; // in minutes
  score: number;
  pauseCount: number;
}

interface UserReport {
  [username: string]: UserStats;
}

interface PomodoroTimerProps {
  user: string;
  socket: Socket | null;
  roomId: string;
  isHost: boolean;
}

interface TimerState {
  timeLeft: number;
  isRunning: boolean;
  isBreak: boolean;
  workTime: number;
  breakTime: number;
}

const SOUND_OPTIONS = [
  { 
    id: 'cat',
    name: '🐱 Cat Meow',
    url: `${process.env.PUBLIC_URL}/sounds/cat.wav`
  },
  { 
    id: 'dog',
    name: '🐕 Dog Bark',
    url: `${process.env.PUBLIC_URL}/sounds/dog.mp3`
  },
  {
    id: 'bell',
    name: '🔔 Bell',
    url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_12b0c7443c.mp3'
  },
  {
    id: 'chime',
    name: '✨ Chime',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/24/audio_d3c4d2c0bf.mp3'
  },
  {
    id: 'ding',
    name: '🎵 Ding',
    url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_c8c8df85ab.mp3'
  }
];

const TIMER_PRESETS = [
  { name: 'Classic', work: 25, break: 5 },
  { name: 'Short', work: 15, break: 3 },
  { name: 'Long', work: 50, break: 10 },
];

const ReportContainer = styled.div`
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 15px;
  padding: 1.5rem;
  margin-top: 2rem;
  width: 100%;
  box-shadow: 0 4px 16px 0 rgba(15, 23, 42, 0.4);
`;

const ReportTitle = styled.h2`
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.2rem;
  margin-bottom: 1rem;
  text-align: left;
`;

const ReportTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  color: #e2e8f0;
  
  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid rgba(99, 102, 241, 0.2);
  }
  
  th {
    font-weight: 500;
    color: rgba(226, 232, 240, 0.7);
  }
  
  tr:last-child td {
    border-bottom: none;
  }

  tbody tr:hover {
    background: rgba(99, 102, 241, 0.1);
  }
`;

const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ user: initialUser, socket, roomId, isHost }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [workTime, setWorkTime] = useState(25);
  const [breakTime, setBreakTime] = useState(5);
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const workSoundRef = useRef<HTMLAudioElement | null>(null);
  const breakSoundRef = useRef<HTMLAudioElement | null>(null);
  const [workSound, setWorkSound] = useState(SOUND_OPTIONS[0]);
  const [breakSound, setBreakSound] = useState(SOUND_OPTIONS[1]);
  const [userReports, setUserReports] = useState<UserReport>(() => {
    const savedReports = localStorage.getItem('pomodoroReports');
    return savedReports ? JSON.parse(savedReports) : {};
  });

  // Initialize audio elements
  useEffect(() => {
    const setupAudio = () => {
      try {
        // Create audio elements
        const workAudio = new Audio(CAT_SOUND);
        const breakAudio = new Audio(DOG_SOUND);

        // Set volume
        workAudio.volume = 0.4;
        breakAudio.volume = 0.3;

        // Store refs
        workSoundRef.current = workAudio;
        breakSoundRef.current = breakAudio;

        // Test load the audio
        workAudio.load();
        breakAudio.load();

        console.log('Audio elements initialized');
      } catch (error) {
        console.error('Error setting up audio:', error);
      }
    };

    setupAudio();

    return () => {
      if (workSoundRef.current) {
        workSoundRef.current.pause();
      }
      if (breakSoundRef.current) {
        breakSoundRef.current.pause();
      }
    };
  }, []);

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  }, []);

  const showNotification = (isBreakTime: boolean) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = isBreakTime ? '🎯 Break Time Over!' : '✨ Work Session Complete!';
      const body = isBreakTime 
        ? 'Time to get back to work!' 
        : 'Great job! Take a break now.';
      
      new Notification(title, {
        body: body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        silent: true // We'll play our own sound
      });
    }
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on('timerUpdated', ({ userId, timerState }: { userId: string; timerState: TimerState }) => {
      if (userId !== currentUser && !isHost) {
        setTimeLeft(timerState.timeLeft);
        setIsRunning(timerState.isRunning);
        setIsBreak(timerState.isBreak);
        setWorkTime(timerState.workTime);
        setBreakTime(timerState.breakTime);
      }
    });

    socket.on('statsUpdated', ({ userId, stats }) => {
      if (userId !== currentUser) {
        setUserReports(prev => ({
          ...prev,
          [userId]: stats
        }));
      }
    });

    return () => {
      socket.off('timerUpdated');
      socket.off('statsUpdated');
    };
  }, [socket, currentUser, isHost]);

  // Emit timer updates
  const emitTimerUpdate = useCallback(() => {
    if (socket && isHost) {
      socket.emit('timerUpdate', {
        roomId,
        userId: currentUser,
        timerState: {
          timeLeft,
          isRunning,
          isBreak,
          workTime,
          breakTime
        }
      });
    }
  }, [socket, roomId, currentUser, timeLeft, isRunning, isBreak, workTime, breakTime, isHost]);

  // Emit stats updates
  const emitStatsUpdate = useCallback((stats: UserStats) => {
    if (socket) {
      socket.emit('statsUpdate', {
        roomId,
        userId: currentUser,
        stats
      });
    }
  }, [socket, roomId, currentUser]);

  const playSound = useCallback(async (isBreakTime: boolean) => {
    try {
      const sound = isBreakTime ? breakSound : workSound;
      const audio = new Audio(sound.url);
      await audio.play();
    } catch (error) {
      console.error('Error playing sound:', error);
      // Fallback to browser notification if audio fails
      if (Notification.permission === 'granted') {
        new Notification(isBreakTime ? 'Break time!' : 'Work time!');
      }
    }
  }, [breakSound, workSound]);

  const previewSound = async (soundUrl: string) => {
    try {
      const audio = new Audio(soundUrl);
      await audio.play();
    } catch (error) {
      console.error('Error playing preview sound:', error);
    }
  };

  const updateUserStats = useCallback((username: string, workMinutes: number, breakMinutes: number) => {
    setUserReports(prev => {
      const userStats = prev[username] || {
        completedPomodoros: 0,
        totalWorkTime: 0,
        totalBreakTime: 0,
        score: 0,
        pauseCount: 0
      };

      const newStats = {
        ...userStats,
        completedPomodoros: userStats.completedPomodoros + 1,
        totalWorkTime: userStats.totalWorkTime + workMinutes,
        totalBreakTime: userStats.totalBreakTime + breakMinutes,
        score: userStats.score + (workMinutes === 25 ? 5 : workMinutes === 15 ? 2 : 10),
        pauseCount: 0
      };

      emitStatsUpdate(newStats);
      return {
        ...prev,
        [username]: newStats
      };
    });
  }, [emitStatsUpdate]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => {
          const newTime = prevTime - 1;
          if (isHost) {
            emitTimerUpdate();
          }
          return newTime;
        });
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      const wasBreak = isBreak;
      setIsBreak(!wasBreak);
      setTimeLeft(wasBreak ? workTime * 60 : breakTime * 60);
      
      if (!wasBreak) {
        updateUserStats(currentUser, workTime, 0);
      } else {
        updateUserStats(currentUser, 0, breakTime);
      }
      
      playSound(wasBreak);
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 1000);

      if (isHost) {
        emitTimerUpdate();
      }
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, isBreak, workTime, breakTime, currentUser, playSound, updateUserStats, isHost, emitTimerUpdate]);

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsBreak(false);
    setTimeLeft(workTime * 60);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleWorkTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setWorkTime(value);
      if (!isRunning && !isBreak) {
        setTimeLeft(value * 60);
      }
    }
  };

  const handleBreakTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setBreakTime(value);
    }
  };

  const applyPreset = (preset: typeof TIMER_PRESETS[0]) => {
    setWorkTime(preset.work);
    setBreakTime(preset.break);
    if (!isRunning && !isBreak) {
      setTimeLeft(preset.work * 60);
    }
  };

  const resetDashboard = () => {
    setUserReports({});
    localStorage.removeItem('userReports');
    alert('Student dashboard has been reset!');
  };

  return (
    <>
      <FlashAnimation show={showFlash} />
      <TimerContainer isBreak={isBreak}>
        <UserName>
          {isEditingName ? (
            <input
              type="text"
              value={currentUser}
              onChange={(e) => setCurrentUser(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyPress={(e) => e.key === 'Enter' && setIsEditingName(false)}
              autoFocus
            />
          ) : (
            <span onClick={() => setIsEditingName(true)}>
              {currentUser}
            </span>
          )}
        </UserName>
        <TimeDisplay isBreak={isBreak}>{formatTime(timeLeft)}</TimeDisplay>
        <div>
          <Button onClick={toggleTimer}>
            {isRunning ? 'Pause' : 'Start'}
          </Button>
          <Button onClick={resetTimer} disabled={isRunning}>
            Reset
          </Button>
          <Button onClick={() => setShowSettings(!showSettings)}>
            {showSettings ? 'Hide Settings' : 'Settings'}
          </Button>
        </div>
        <StatusIndicator isBreak={isBreak} />
        
        {showSettings && (
          <SettingsContainer>
            <div style={{ marginBottom: '2rem' }}>
              <Label>Quick Presets:</Label>
              <div>
                {TIMER_PRESETS.map(preset => (
                  <PresetButton
                    key={preset.name}
                    variant="secondary"
                    onClick={() => applyPreset(preset)}
                    disabled={isRunning}
                  >
                    {preset.name}
                  </PresetButton>
                ))}
              </div>
            </div>

            <Label>
              Work Time (minutes):
              <Input
                type="number"
                value={workTime}
                onChange={handleWorkTimeChange}
                min="1"
                disabled={isRunning}
              />
            </Label>
            <Label>
              Break Time (minutes):
              <Input
                type="number"
                value={breakTime}
                onChange={handleBreakTimeChange}
                min="1"
                disabled={isRunning}
              />
            </Label>
            
            <div style={{ marginTop: '1rem' }}>
              <Label>Work Session Sound:</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <SoundSelect
                  value={workSound.id}
                  onChange={(e) => {
                    const selected = SOUND_OPTIONS.find(s => s.id === e.target.value);
                    if (selected) setWorkSound(selected);
                  }}
                >
                  {SOUND_OPTIONS.map(sound => (
                    <option key={sound.id} value={sound.id}>
                      {sound.name}
                    </option>
                  ))}
                </SoundSelect>
                <Button
                  variant="secondary"
                  onClick={() => previewSound(workSound.url)}
                >
                  ▶️ Preview
                </Button>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <Label>Break Session Sound:</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <SoundSelect
                  value={breakSound.id}
                  onChange={(e) => {
                    const selected = SOUND_OPTIONS.find(s => s.id === e.target.value);
                    if (selected) setBreakSound(selected);
                  }}
                >
                  {SOUND_OPTIONS.map(sound => (
                    <option key={sound.id} value={sound.id}>
                      {sound.name}
                    </option>
                  ))}
                </SoundSelect>
                <Button
                  variant="secondary"
                  onClick={() => previewSound(breakSound.url)}
                >
                  ▶️ Preview
                </Button>
              </div>
            </div>
          </SettingsContainer>
        )}

        <ReportContainer>
          <ReportTitle>📊 Study Dashboard</ReportTitle>
          <ReportTable>
            <thead>
              <tr>
                <th>Completed</th>
                <th>Work Time</th>
                <th>Break Time</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(userReports).map(([username, stats]) => (
                <tr key={username}>
                  <td>{stats.completedPomodoros} pomodoros</td>
                  <td>{Math.round(stats.totalWorkTime)} mins</td>
                  <td>{Math.round(stats.totalBreakTime)} mins</td>
                  <td>{stats.score} points</td>
                </tr>
              ))}
              {Object.keys(userReports).length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                    No sessions completed yet. Start your first pomodoro!
                  </td>
                </tr>
              )}
            </tbody>
          </ReportTable>
          <ResetButton onClick={resetDashboard} variant="secondary">
            Reset Dashboard
          </ResetButton>
        </ReportContainer>
      </TimerContainer>
    </>
  );
};

export default PomodoroTimer; 
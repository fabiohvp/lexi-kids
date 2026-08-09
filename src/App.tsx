import React, { useState } from 'react';
import Menu from './Menu';
import WritingGame from './WritingGame';
import ReadingGame from './ReadingGame';
import Test from './Test';

type GameMode = 'menu' | 'writing' | 'reading' | 'test';

const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export default function App() {
  const [gameMode, setGameMode] = useState<GameMode>('menu');

  const [levelPoints, setLevelPoints] = useState<number>(() => {
    const saved = localStorage.getItem('lexi_kids_level_points');
    const parsed = Number(saved);
    return (parsed >= 10 && parsed <= 200) ? parsed : 100;
  });

  const [startLevel, setStartLevel] = useState<number>(() => {
    const saved = localStorage.getItem('lexi_kids_start_level');
    const parsed = Number(saved);
    return (parsed >= 1 && parsed <= 8) ? parsed : 1;
  });

  const handleLevelPointsChange = (value: number) => {
    const val = Math.max(10, Math.min(200, value));
    setLevelPoints(val);
    localStorage.setItem('lexi_kids_level_points', val.toString());
  };

  const handleStartLevelChange = (value: number) => {
    const val = Math.max(1, Math.min(8, value));
    setStartLevel(val);
    localStorage.setItem('lexi_kids_start_level', val.toString());
  };

  if (gameMode === 'test') {
    return <Test onBack={() => setGameMode('menu')} />;
  }

  if (gameMode === 'writing') {
    return (
      <WritingGame
        levelPoints={levelPoints}
        startLevel={startLevel}
        onBackToMenu={() => setGameMode('menu')}
        onSwitchToReading={() => setGameMode('reading')}
        onSwitchToTest={() => setGameMode('test')}
        isLocalhost={isLocalhost}
      />
    );
  }

  if (gameMode === 'reading') {
    return (
      <ReadingGame
        levelPoints={levelPoints}
        startLevel={startLevel}
        onBackToMenu={() => setGameMode('menu')}
        onSwitchToWriting={() => setGameMode('writing')}
        onSwitchToTest={() => setGameMode('test')}
        isLocalhost={isLocalhost}
      />
    );
  }

  return (
    <Menu
      onStartWritingGame={() => setGameMode('writing')}
      onStartReadingGame={() => setGameMode('reading')}
      onStartTest={() => setGameMode('test')}
      isLocalhost={isLocalhost}
      levelPoints={levelPoints}
      onLevelPointsChange={handleLevelPointsChange}
      startLevel={startLevel}
      onStartLevelChange={handleStartLevelChange}
    />
  );
}

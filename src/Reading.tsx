import { Award, Mic, Play, RotateCcw, Settings, SkipForward, Sparkles, Trophy } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { PALAVRAS_BASE } from './syllables';
import { evaluateSyllablePhonetically, PhoneticMatchResult } from './phonetics';

const audioCache = new Map();

interface ReadingProps {
  onBackToMenu?: () => void;
}

export default function Reading({ onBackToMenu }: ReadingProps) {
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [currentWord, setCurrentWord] = useState<any>(null);
  const [currentSyllableIndex, setCurrentSyllableIndex] = useState(0); // 0..syllables.length-1 for syllables, syllables.length for full word
  const [completedWord, setCompletedWord] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [phoneticInfo, setPhoneticInfo] = useState<PhoneticMatchResult | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | 'idle'>('idle');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [levelPoints, setLevelPoints] = useState(() => {
    const saved = localStorage.getItem('lexi_kids_reading_level_points');
    const parsed = Number(saved);
    return parsed >= 5 && parsed <= 50 ? parsed : 10;
  });

  const [startLevel, setStartLevel] = useState(() => {
    const saved = localStorage.getItem('lexi_kids_reading_start_level');
    const parsed = Number(saved);
    return parsed >= 1 && parsed <= 8 ? parsed : 1;
  });

  const recognitionRef = useRef<any>(null);
  const wordHistoryRef = useRef<string[]>([]);

  // Sound effect handler
  async function playSound(src: string) {
    let audio = audioCache.get(src);
    if (!audio) {
      audio = new Audio(src);
      audioCache.set(src, audio);
    }
    audio.currentTime = 0;
    try {
      await audio.play();
    } catch {
      // Audio autoplay policy catch
    }
  }

  // TTS utterance helper
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
      utterance.lang = 'pt-BR';
      utterance.rate = 0.85;
      utterance.pitch = 1.25;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Level update based on score
  useEffect(() => {
    const calculatedLevel = Math.floor(score / levelPoints) + startLevel;
    setLevel(calculatedLevel);

    if (score > 0 && score % levelPoints === 0) {
      playSound('/level-up.mp3');
    }
  }, [score, levelPoints, startLevel]);

  const handleLevelPointsChange = (value: number) => {
    const val = Math.max(5, Math.min(50, value));
    setLevelPoints(val);
    localStorage.setItem('lexi_kids_reading_level_points', String(val));
  };

  const handleStartLevelChange = (value: number) => {
    const val = Math.max(1, Math.min(8, value));
    setStartLevel(val);
    localStorage.setItem('lexi_kids_reading_start_level', String(val));
  };

  // Pick word based on level
  const selectNextWord = (currentLvl: number) => {
    let filtered = PALAVRAS_BASE.filter((w) => {
      const sylCount = w.syllableCount || w.syllables.length;
      if (currentLvl <= 2) return sylCount <= 2;
      if (currentLvl <= 4) return sylCount <= 3;
      if (currentLvl <= 6) return sylCount <= 4;
      return true;
    });

    if (filtered.length === 0) filtered = PALAVRAS_BASE;

    const history = wordHistoryRef.current;
    const available = filtered.filter((w) => !history.includes(w.name));
    const pool = available.length > 0 ? available : filtered;

    const wordObj = pool[Math.floor(Math.random() * pool.length)];

    const nextHistory = [...history, wordObj.name];
    if (nextHistory.length > 5) nextHistory.shift();
    wordHistoryRef.current = nextHistory;

    setCurrentWord(wordObj);
    setCurrentSyllableIndex(0);
    setCompletedWord(false);
    setTranscript('');
    setPhoneticInfo(null);
    setFeedback('idle');
    setIsTransitioning(false);
  };

  const startGame = () => {
    setGameStarted(true);
    selectNextWord(level);
  };

  // Speech Recognition setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += ' ' + event.results[i][0].transcript;
        }
        currentTranscript = currentTranscript.trim();
        setTranscript(currentTranscript);

        evaluateSpeech(currentTranscript, event.results[0].isFinal);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setFeedback('incorrect');
        setTimeout(() => setFeedback('idle'), 1500);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [currentWord, currentSyllableIndex]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert(
        'Reconhecimento de voz não suportado neste navegador. Use o botão "OUVI CERTO" para jogar!'
      );
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setFeedback('idle');
      try {
        recognitionRef.current.start();
      } catch {
        recognitionRef.current.stop();
      }
    }
  };

  // Speech evaluation logic
  const normalize = (str: string) => {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const isSyllableMatch = (spokenText: string, syllable: string) => {
    const normSpoken = normalize(spokenText).replace(/\s+/g, '');
    const normTarget = normalize(syllable).replace(/\s+/g, '');

    if (!normSpoken || !normTarget) return false;

    if (normSpoken === normTarget) return true;
    if (normSpoken.startsWith(normTarget)) return true;
    if (normSpoken.includes(normTarget)) return true;
    if (normTarget.startsWith(normSpoken)) return true;

    const phoneticSpoken = normSpoken.replace(/k/g, 'c').replace(/q/g, 'c').replace(/h/g, '');
    const phoneticTarget = normTarget.replace(/k/g, 'c').replace(/q/g, 'c').replace(/h/g, '');

    if (
      phoneticSpoken === phoneticTarget ||
      phoneticSpoken.startsWith(phoneticTarget) ||
      phoneticSpoken.includes(phoneticTarget) ||
      phoneticTarget.startsWith(phoneticSpoken)
    ) {
      return true;
    }

    return false;
  };

  const LETTER_NAMES: Record<string, string[]> = {
    a: ['a', 'ah', 'ha', 'á', 'ã'],
    b: ['b', 'be', 'bê'],
    c: ['c', 'ce', 'cê', 'ka', 'cá'],
    d: ['d', 'de', 'dê'],
    e: ['e', 'eh', 'é', 'ê'],
    f: ['f', 'ef', 'efe'],
    g: ['g', 'ge', 'gê'],
    h: ['h', 'aga', 'agá'],
    i: ['i', 'ih', 'í'],
    j: ['j', 'jota'],
    k: ['k', 'ka', 'cá'],
    l: ['l', 'el', 'ele'],
    m: ['m', 'em', 'eme'],
    n: ['n', 'en', 'ene'],
    o: ['o', 'oh', 'ó', 'ô'],
    p: ['p', 'pe', 'pê'],
    q: ['q', 'qu', 'que', 'quê'],
    r: ['r', 'er', 'erre'],
    s: ['s', 'es', 'esse'],
    t: ['t', 'te', 'tê'],
    u: ['u', 'uh', 'ú'],
    v: ['v', 've', 'vê'],
    w: ['w', 'dablio', 'dablho'],
    x: ['x', 'xis'],
    y: ['y', 'ipsilon'],
    z: ['z', 'ze', 'zê'],
  };

  const isSyllableSpelledCorrectly = (spokenText: string, syllable: string) => {
    const normSpokenWithSpaces = normalize(spokenText);
    const normSyl = normalize(syllable).replace(/\s+/g, '');

    if (!normSpokenWithSpaces || !normSyl) return false;

    const letters = normSyl.split('');

    if (letters.length <= 1) {
      return isSyllableMatch(spokenText, syllable);
    }

    const normTokens = normSpokenWithSpaces.split(/\s+/).filter(Boolean);

    // If player ONLY spoke the individual letters (e.g. ["c", "a", "o"]),
    // do NOT accept yet because the syllable at the end is missing!
    const isOnlyLetterSpellingWithoutSyllable =
      normTokens.length <= letters.length &&
      normTokens.every((token, idx) => {
        const letterChar = letters[idx];
        if (!letterChar) return false;
        const names = LETTER_NAMES[letterChar] || [letterChar];
        return (
          token === letterChar ||
          names.some((n) => normalize(n) === token) ||
          token.startsWith(letterChar)
        );
      });

    if (isOnlyLetterSpellingWithoutSyllable) {
      return false;
    }

    // Check token window for [Letter 1], [Letter 2], ..., [Syllable]
    const windowSize = letters.length + 1;

    for (let i = 0; i <= normTokens.length - windowSize; i++) {
      let lettersMatched = true;

      for (let l = 0; l < letters.length; l++) {
        const letterChar = letters[l];
        const token = normTokens[i + l];
        const names = LETTER_NAMES[letterChar] || [letterChar];

        const isMatch =
          token === letterChar ||
          names.some((n) => normalize(n) === token) ||
          token.startsWith(letterChar);

        if (!isMatch) {
          lettersMatched = false;
          break;
        }
      }

      if (lettersMatched) {
        const syllableToken = normTokens[i + letters.length];
        const isSylMatch =
          syllableToken === normSyl ||
          syllableToken.includes(normSyl) ||
          normSyl.includes(syllableToken) ||
          isSyllableMatch(syllableToken, normSyl);

        if (isSylMatch) return true;
      }
    }

    // Check direct sequence string
    const expectedDirect1 = letters.join(' ') + ' ' + normSyl;
    if (normSpokenWithSpaces.includes(expectedDirect1)) {
      return true;
    }

    // Merged transcription fallback (e.g. "peppa" for "p a pa")
    const normSpokenNoSpaces = normSpokenWithSpaces.replace(/\s+/g, '');
    const firstLetter = letters[0];
    const lastLetter = letters[letters.length - 1];

    const startsWithFirst =
      normSpokenNoSpaces.startsWith(firstLetter) ||
      (LETTER_NAMES[firstLetter] || []).some((n) => normSpokenNoSpaces.startsWith(normalize(n)));

    const endsWithSylOrLast =
      normSpokenNoSpaces.endsWith(normSyl) ||
      normSpokenNoSpaces.endsWith(lastLetter) ||
      normSpokenNoSpaces.includes(normSyl);

    const isMergedSyllableSpell =
      startsWithFirst &&
      endsWithSylOrLast &&
      normSpokenNoSpaces.length >= letters.length + 2 &&
      normSpokenNoSpaces.length <= letters.length * 3 + 3;

    if (isMergedSyllableSpell) {
      return true;
    }

    return false;
  };

  const evaluateSpeech = (spokenText: string, isFinal: boolean) => {
    if (!currentWord) return;

    const isFullWordStep = currentSyllableIndex === currentWord.syllables.length;

    if (!isFullWordStep) {
      const targetSyllable = currentWord.syllables[currentSyllableIndex];
      const phoneticRes = evaluateSyllablePhonetically(spokenText, targetSyllable, 0.70);
      const isSpelled = isSyllableSpelledCorrectly(spokenText, targetSyllable);
      const isDirectMatch = isSyllableMatch(spokenText, targetSyllable);

      const matched = phoneticRes.matched || isSpelled || isDirectMatch;

      setPhoneticInfo(phoneticRes);

      if (matched) {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {}
        }
        setFeedback('correct');
        playSound('/point-up.mp3');
        setScore((prev) => prev + 1);

        const nextIndex = currentSyllableIndex + 1;
        setCurrentSyllableIndex(nextIndex);

        if (nextIndex === currentWord.syllables.length) {
          setTimeout(() => {
            speakText(`Muito bem! Agora fale a palavra inteira`);
          }, 600);
        } else {
          setTimeout(() => {
            setFeedback('idle');
          }, 1000);
        }
      } else if (isFinal) {
        setFeedback('incorrect');
        setTimeout(() => setFeedback('idle'), 2500);
      }
    } else {
      const normWord = normalize(currentWord.name);
      const normSpoken = normalize(spokenText);
      const matched =
        normSpoken === normWord ||
        normSpoken.includes(normWord) ||
        normWord.includes(normSpoken) ||
        isSyllableMatch(spokenText, currentWord.name);

      if (matched) {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {}
        }
        setFeedback('correct');
        setCompletedWord(true);
        playSound('/point-up.mp3');

        const bonusPoints = currentWord.syllables.length;
        setScore((prev) => prev + bonusPoints);

        setTimeout(() => {
          setIsTransitioning(true);
          setTimeout(() => {
            const nextLvl = Math.floor((score + bonusPoints) / levelPoints) + startLevel;
            selectNextWord(nextLvl);
          }, 500);
        }, 1800);
      } else if (isFinal) {
        setFeedback('incorrect');
        setTimeout(() => setFeedback('idle'), 1500);
      }
    }
  };

  // Manual trigger for testing/fallback
  const handleManualPass = () => {
    if (!currentWord || completedWord) return;
    const isFullWordStep = currentSyllableIndex === currentWord.syllables.length;
    if (!isFullWordStep) {
      setFeedback('correct');
      playSound('/point-up.mp3');
      setScore((prev) => prev + 1);
      const nextIndex = currentSyllableIndex + 1;
      setCurrentSyllableIndex(nextIndex);
      setTimeout(() => setFeedback('idle'), 1000);
    } else {
      setFeedback('correct');
      setCompletedWord(true);
      playSound('/point-up.mp3');
      const bonusPoints = currentWord.syllables.length;
      setScore((prev) => prev + bonusPoints);
      setTimeout(() => {
        setIsTransitioning(true);
        setTimeout(() => {
          const nextLvl = Math.floor((score + bonusPoints) / levelPoints) + startLevel;
          selectNextWord(nextLvl);
        }, 500);
      }, 1800);
    }
  };

  // Global key listener for SPACE bar
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (gameStarted && !completedWord && !isTransitioning) {
          toggleListening();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [gameStarted, completedWord, isTransitioning, isListening]);

  const handleSkip = () => {
    if (completedWord || isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      const currentLvl = Math.floor(score / levelPoints) + startLevel;
      selectNextWord(currentLvl);
    }, 500);
  };

  const isFullWordStep = currentWord && currentSyllableIndex === currentWord.syllables.length;

  if (!gameStarted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center overflow-x-hidden bg-emerald-50/50">
        <div className="relative bg-white rounded-[40px] p-8 md:p-12 kid-shadow border-8 border-emerald-400 max-w-md w-full transform hover:scale-102 transition-transform">
          <button
            onClick={() => setShowSettings(true)}
            className="absolute top-4 right-4 p-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 rounded-full border-b-4 border-emerald-300 transition-all shadow-sm z-10"
            title="Configurações"
          >
            <Settings className="w-6 h-6" />
          </button>

          <div className="w-32 h-32 mx-auto mb-6 rounded-[32px] bg-emerald-100 border-4 border-emerald-300 flex items-center justify-center text-6xl shadow-md animate-bounce-gentle">
            📖
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-emerald-600 tracking-wide mb-2">
            MODO LEITURA
          </h1>
          <p className="text-base font-bold text-gray-500 mb-6">
            Leia as sílabas em voz alta pressionando ESPAÇO!
          </p>

          <div className="flex flex-col gap-4">
            <button
              onClick={startGame}
              className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-2xl rounded-3xl border-b-8 border-emerald-700 hover:border-b-4 hover:translate-y-[4px] active:translate-y-[8px] active:border-b-0 transition-all shadow-lg"
            >
              <Play className="w-8 h-8 fill-current" />
              LER AGORA!
            </button>
            {onBackToMenu && (
              <button
                onClick={onBackToMenu}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-black text-xl rounded-2xl border-b-4 border-gray-400 transition-all"
              >
                <RotateCcw className="w-6 h-6" />
                VOLTAR MENU
              </button>
            )}
          </div>
        </div>

        {showSettings && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-[45px] p-8 kid-shadow border-8 border-emerald-400 max-w-sm w-full">
              <h2 className="text-2xl font-black text-emerald-600 mb-6 flex items-center justify-center gap-2">
                <Settings className="w-8 h-8" />
                Ajustes da Leitura
              </h2>

              <div className="space-y-6 mb-8 text-left">
                <div>
                  <label className="block text-base font-black text-emerald-900 mb-3 text-center">
                    Pontos para nível:
                  </label>
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <button
                      onClick={() => handleLevelPointsChange(levelPoints - 1)}
                      className="w-12 h-12 bg-emerald-100 text-emerald-700 font-black text-2xl rounded-2xl flex items-center justify-center border-b-4 border-emerald-300"
                    >
                      -
                    </button>
                    <span className="text-4xl font-black text-emerald-600 w-16 text-center">
                      {levelPoints}
                    </span>
                    <button
                      onClick={() => handleLevelPointsChange(levelPoints + 1)}
                      className="w-12 h-12 bg-emerald-100 text-emerald-700 font-black text-2xl rounded-2xl flex items-center justify-center border-b-4 border-emerald-300"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-base font-black text-emerald-900 mb-3 text-center">
                    Nível Inicial:
                  </label>
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <button
                      onClick={() => handleStartLevelChange(startLevel - 1)}
                      className="w-12 h-12 bg-emerald-100 text-emerald-700 font-black text-2xl rounded-2xl flex items-center justify-center border-b-4 border-emerald-300"
                    >
                      -
                    </button>
                    <span className="text-4xl font-black text-emerald-600 w-16 text-center">
                      {startLevel}
                    </span>
                    <button
                      onClick={() => handleStartLevelChange(startLevel + 1)}
                      className="w-12 h-12 bg-emerald-100 text-emerald-700 font-black text-2xl rounded-2xl flex items-center justify-center border-b-4 border-emerald-300"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowSettings(false)}
                className="w-full py-4 bg-emerald-500 text-white font-black text-xl rounded-3xl border-b-8 border-emerald-700"
              >
                PRONTO! 👍
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 md:p-6 text-[#2D3748] overflow-x-hidden bg-emerald-50/30">
      {/* Top Header */}
      <header className="w-full max-w-4xl mx-auto flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/90 backdrop-blur-md rounded-3xl p-4 md:px-8 kid-shadow border-4 border-emerald-400">
        <div
          onClick={onBackToMenu}
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center text-2xl">
            📖
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-emerald-600 tracking-wide">
              LEXI READ
            </h1>
            <p className="text-xs md:text-sm font-bold text-gray-500 hidden sm:block">
              Modo Leitura e Voz!
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4">
          {onBackToMenu && (
            <button
              onClick={onBackToMenu}
              className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white font-black text-xs md:text-sm rounded-2xl border-b-4 border-sky-700 transition-all"
            >
              ✍️ MODO ESCRITA
            </button>
          )}
          <div className="flex items-center gap-1 bg-amber-100 px-3 py-1.5 rounded-2xl border-2 border-amber-300">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="text-sm md:text-base font-black text-amber-700">
              PONTOS: {score}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-purple-100 px-3 py-1.5 rounded-2xl border-2 border-purple-300">
            <Award className="w-5 h-5 text-purple-500" />
            <span className="text-sm md:text-base font-black text-purple-700">
              NÍVEL: {level}
            </span>
          </div>
        </div>
      </header>

      {/* Main Reading Game Screen */}
      <main className="flex-1 w-full max-w-4xl mx-auto flex flex-col items-center justify-center my-6 overflow-hidden relative">
        {currentWord ? (
          <div
            className={`w-full bg-white rounded-[40px] p-6 md:p-12 kid-shadow border-8 border-emerald-300 transition-all duration-500 transform ${
              isTransitioning ? 'translate-x-[150%] opacity-0 scale-95' : 'translate-x-0 opacity-100 scale-100'
            }`}
          >
            {/* Target Step Banner */}
            <div className="text-center mb-6">
              <span className="inline-block bg-emerald-100 border-2 border-emerald-300 text-emerald-800 font-extrabold px-6 py-2 rounded-full text-base md:text-lg">
                {!isFullWordStep
                  ? `SÍLABA ${currentSyllableIndex + 1} DE ${currentWord.syllables.length}`
                  : '🔥 DESAFIO FINAL: FALE A PALAVRA TODA!'}
              </span>
            </div>

            {/* Whole Word Syllables Board */}
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-5 my-8">
              {currentWord.syllables.map((syl: string, idx: number) => {
                const isPast = idx < currentSyllableIndex;
                const isActive = idx === currentSyllableIndex && !isFullWordStep;
                const isAllDone = isFullWordStep || completedWord;

                let badgeStyle =
                  'bg-gray-100 text-gray-300 border-gray-200 opacity-60 scale-95';

                if (isPast) {
                  badgeStyle =
                    'bg-emerald-100 text-emerald-700 border-emerald-400 font-black shadow-md';
                } else if (isActive) {
                  badgeStyle =
                    'bg-yellow-300 text-yellow-950 border-yellow-500 font-black scale-110 shadow-xl animate-pulse ring-4 ring-yellow-200';
                } else if (isAllDone) {
                  badgeStyle =
                    'bg-gradient-to-r from-emerald-200 to-sky-200 text-emerald-900 border-emerald-500 font-black scale-105 shadow-lg animate-bounce-gentle';
                }

                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && (
                      <span className="text-3xl md:text-5xl font-black text-emerald-400 select-none">
                        +
                      </span>
                    )}
                    <div
                      className={`min-w-[70px] md:min-w-[100px] h-20 md:h-28 px-4 border-4 rounded-3xl flex items-center justify-center text-4xl md:text-6xl uppercase tracking-wider transition-all duration-300 select-none ${badgeStyle}`}
                    >
                      {syl}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Microphone Listening Status & Hints */}
            <div className="flex flex-col items-center justify-center gap-4 my-6">
              <button
                onClick={toggleListening}
                disabled={completedWord}
                className={`flex items-center gap-3 px-8 py-5 rounded-3xl border-b-8 font-black text-xl md:text-2xl transition-all shadow-xl ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-400 text-white border-red-700 animate-pulse'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-white border-emerald-700 hover:border-b-4 hover:translate-y-[4px] active:translate-y-[8px]'
                }`}
              >
                {isListening ? (
                  <>
                    <Mic className="w-8 h-8 animate-spin" />
                    FALANDO... 🎙️
                  </>
                ) : (
                  <>
                    <Mic className="w-8 h-8" />
                    FALAR EM VOZ ALTA (ESPAÇO)
                  </>
                )}
              </button>

              {transcript && (
                <div className="bg-sky-50 border-2 border-sky-200 px-5 py-3 rounded-2xl text-sky-900 font-bold text-sm md:text-base animate-fade-in flex flex-col items-center gap-2 max-w-md w-full shadow-sm">
                  <div>
                    Você disse: <span className="font-black text-sky-950">"{transcript}"</span>
                  </div>
                  {phoneticInfo && (
                    <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs md:text-sm font-semibold text-sky-800 bg-white/80 px-3.5 py-2 rounded-xl border border-sky-200 w-full shadow-inner">
                      <div className="flex items-center gap-1">
                        <span>esperado =</span>
                        <code className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-black border border-emerald-300">
                          /{phoneticInfo.expectedPhonemes}/
                        </code>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>recebido =</span>
                        <code className="bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded font-mono font-black border border-purple-300">
                          /{phoneticInfo.spokenPhonemes || '-'}/
                        </code>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>score =</span>
                        <span
                          className={`font-black px-2 py-0.5 rounded-lg ${
                            phoneticInfo.score >= 0.70
                              ? 'bg-emerald-500 text-white'
                              : 'bg-amber-400 text-amber-950'
                          }`}
                        >
                          {phoneticInfo.score.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Controls */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleManualPass}
                  title="Validação manual para testes ou fallback de mic"
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-100 hover:bg-purple-200 text-purple-700 font-black text-sm rounded-2xl border-b-4 border-purple-300 transition-all"
                >
                  👍 FALEI CERTO
                </button>

                <button
                  onClick={handleSkip}
                  disabled={completedWord}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-black text-sm rounded-2xl border-b-4 border-amber-700 transition-all"
                >
                  <SkipForward className="w-5 h-5" />
                  PULAR
                </button>
              </div>
            </div>

            {/* Completion / Feedback message */}
            <div className="h-14 flex items-center justify-center text-center">
              {completedWord ? (
                <div className="flex items-center gap-2 text-emerald-600 font-extrabold text-xl md:text-2xl animate-bounce">
                  <Sparkles className="w-6 h-6 text-yellow-500" />
                  SENSACIONAL! PALAVRA COMPLETA (+{currentWord.syllables.length} PONTOS)! 🎉
                  <Sparkles className="w-6 h-6 text-yellow-500" />
                </div>
              ) : feedback === 'correct' ? (
                <div className="text-emerald-600 font-extrabold text-xl animate-bounce">
                  SÍLABA CORRETA! (+1 PONTO) ⭐
                </div>
              ) : feedback === 'incorrect' ? (
                <div className="text-red-500 font-extrabold text-xl animate-pulse">
                  Tente novamente! Fale em voz alta 🎙️
                </div>
              ) : (
                <p className="text-gray-400 font-bold text-sm md:text-base animate-pulse">
                  Aperte <span className="text-blue-600 font-black">ESPAÇO</span> e fale a sílaba amarela!
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg font-bold text-gray-500">Carregando próxima palavra...</p>
          </div>
        )}
      </main>

      {/* Rules Footer */}
      <footer className="w-full max-w-4xl mx-auto text-center text-xs md:text-sm font-bold text-emerald-800 bg-emerald-100/60 p-4 rounded-2xl border-2 border-emerald-300">
        <p>🎮 Como Funciona o Modo Leitura:</p>
        <p className="mt-1 text-emerald-700">
          1. Fale cada sílaba destacada (+1 PONTO).<br />
          2. Fale a palavra toda ao terminar (+{currentWord?.syllables.length || 'N'} PONTOS bônus!).
        </p>
      </footer>
    </div>
  );
}

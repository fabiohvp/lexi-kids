import { Award, Play, Sparkles, Trophy, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PALAVRAS_BASE } from './database';
import Test from './Test';

const LEVEL_POINTS = 10;
const audioCache = new Map();
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [currentWord, setCurrentWord] = useState(null);
  const [wordLayout, setWordLayout] = useState([]); // Array indicando a configuração das letras
  const [userInputs, setUserInputs] = useState({}); // Letras digitadas pelo usuário
  const [completed, setCompleted] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState('enter'); // 'enter', 'exit'
  const [mistakes, setMistakes] = useState({}); // track correct/incorrect indices
  const inputRefs = useRef([]);

  // Atualiza o nível com base na pontuação (Sobe a cada 10 pontos)
  useEffect(() => {
    const calculatedLevel = Math.floor(score / LEVEL_POINTS) + 1;
    setLevel(calculatedLevel);

	if (score > 0 && score % LEVEL_POINTS === 0) {
			playSound("/level-up.mp3"); // ou o som de "level up"
		}
  }, [score]);

	async function playSound(src) {
		let audio = audioCache.get(src);

		if (!audio) {
			audio = new Audio(src);
			audioCache.set(src, audio);
		}

		// Restart if it's already playing
		audio.currentTime = 0;

		await audio.play();
	}

  // Função para reproduzir a palavra usando a API de fala do navegador
  const speakWord = (wordText) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Cancela falas anteriores
      const utterance = new SpeechSynthesisUtterance(wordText.toLowerCase());
      utterance.lang = 'pt-BR';
      utterance.rate = 0.85; // Velocidade amigável para crianças
      utterance.pitch = 1.25; // Voz um pouquinho mais aguda e alegre
      window.speechSynthesis.speak(utterance);
    }
  };

  // Parâmetros de nível para esconder as letras
  const getLevelParameters = (wordLength, lvl) => {
    let missingCount = 1;
    let allowedLengths = [2, 100];

    if (lvl === 1) {
      allowedLengths = [2, 3];
      missingCount = 1;
    } else if (lvl === 2) {
      allowedLengths = [2, 4];
      missingCount = 2;
    } else if (lvl === 3) {
      allowedLengths = [3, 5];
      missingCount = 2;
    } else if (lvl === 4) {
      allowedLengths = [4, 5];
      missingCount = Math.floor(Math.random() * 2) + 2; // 2 a 3
    } else if (lvl === 5) {
      allowedLengths = [3, 5];
      missingCount = Math.floor(Math.random() * 2) + 2; // 2 a 3
    } else if (lvl === 6) {
      allowedLengths = [3, 6];
      missingCount = Math.floor(Math.random() * 3) + 2; // 2 a 4
    } else if (lvl === 7) {
      allowedLengths = [4, 100];
      const minL = Math.min(wordLength, 4);
      const minMissing = minL - 1;
      const maxMissing = Math.max(wordLength - 2, 1);
      missingCount = Math.floor(Math.random() * (maxMissing - minMissing + 1)) + minMissing;
    } else {
      allowedLengths = [2, 100];
      missingCount = Math.floor(Math.random() * (wordLength - 1)) + 1;
    }

    if (missingCount >= wordLength) {
      missingCount = Math.max(1, wordLength - 1);
    }

    return { allowedLengths, missingCount };
  };

  // Seleciona a próxima palavra com base no nível
  const selectNextWord = (currentLvl) => {
    let filtered = PALAVRAS_BASE.filter(w => {
      const cleanLen = w.name.replace(/[^a-zA-Z]/g, '').length;
      const params = getLevelParameters(cleanLen, currentLvl);
      return cleanLen >= params.allowedLengths[0] && cleanLen <= params.allowedLengths[1];
    });

    if (filtered.length === 0) {
      filtered = PALAVRAS_BASE;
    }

    const wordObj = filtered[Math.floor(Math.random() * filtered.length)];
    const cleanName = wordObj.name.toUpperCase();
    const len = cleanName.length;

    const { missingCount } = getLevelParameters(len, currentLvl);

    const alphaIndices = [];
    for (let i = 0; i < len; i++) {
      if (/[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÚÜÇ]/.test(cleanName[i])) {
        alphaIndices.push(i);
      }
    }

    const shuffledIndices = [...alphaIndices].sort(() => Math.random() - 0.5);
    const hiddenIndices = new Set(shuffledIndices.slice(0, missingCount));

    const layout = [];
    for (let i = 0; i < len; i++) {
      const char = cleanName[i];
      const isHidden = hiddenIndices.has(i);
      layout.push({
        char,
        isHidden,
        index: i,
      });
    }

    const initialInputs = {};
    layout.forEach((item, index) => {
      if (item.isHidden) {
        initialInputs[index] = '';
      }
    });

    setWordLayout(layout);
    setUserInputs(initialInputs);
    setMistakes({});
    setCompleted(false);
    setCurrentWord(wordObj);
    setTransitionDirection('enter');
    setIsTransitioning(false);

    // Reproduz o áudio imediatamente
    speakWord(wordObj.name);
  };

  // Inicia o jogo ativando o áudio após o primeiro gesto
  const startGame = () => {
    setGameStarted(true);
    selectNextWord(level);
  };

  // Atalho do Espaço para ouvir o som da palavra em qualquer momento
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); // Evita que a página role para baixo
        if (currentWord && gameStarted) {
          speakWord(currentWord.name);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [currentWord, gameStarted]);

  // Foco automático no primeiro input vazio disponível
  useEffect(() => {
    if (gameStarted && !completed && wordLayout.length > 0) {
      const firstMissingItem = wordLayout.find(item => item.isHidden && !userInputs[item.index]);
      if (firstMissingItem && inputRefs.current[firstMissingItem.index]) {
        inputRefs.current[firstMissingItem.index].focus();
      }
    }
  }, [wordLayout, completed, gameStarted]);

  // Manipulador de digitação das letrinhas
  const handleInputChange = (index, val) => {
    if (completed) return;

    const charTyped = val.toUpperCase().trim().slice(-1);
    if (!charTyped) {
      setUserInputs(prev => ({ ...prev, [index]: '' }));
      setMistakes(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      return;
    }

    const expectedChar = wordLayout[index].char;
    const normalize = (c) => c.normalize("NFD").replace(/[̀-ͯ]/g, "");
    const isCorrect = normalize(charTyped) === normalize(expectedChar);

    setUserInputs(prev => ({ ...prev, [index]: charTyped }));
    setMistakes(prev => ({ ...prev, [index]: isCorrect ? 'correct' : 'incorrect' }));

    if (isCorrect) {
      // Procura o próximo input vazio para mover o foco
      const nextMissingIndex = wordLayout.findIndex((item, idx) => item.isHidden && idx > index && !userInputs[idx]);
      if (nextMissingIndex !== -1 && inputRefs.current[nextMissingIndex]) {
        inputRefs.current[nextMissingIndex].focus();
      } else {
        // Verifica se completou a palavra inteira
        setTimeout(() => checkWordCompletion({ ...userInputs, [index]: charTyped }), 80);
      }
    }
  };

  const checkWordCompletion = (currentInputs) => {
    let allRight = true;
    wordLayout.forEach(item => {
      if (item.isHidden) {
        const typed = currentInputs[item.index];
        const expected = item.char;
        const normalize = (c) => c ? c.normalize("NFD").replace(/[̀-ͯ]/g, "") : "";
        if (normalize(typed) !== normalize(expected)) {
          allRight = false;
        }
      }
    });

    if (allRight) {
      setCompleted(true);
      playSound("/point-up.mp3");

      setScore(prev => prev + 1);

      // Transição suave para a direita após 1.5 segundos
      setTimeout(() => {
        setTransitionDirection('exit');
        setIsTransitioning(true);

        setTimeout(() => {
          const nextScore = score + 1;
          const nextLvl = Math.floor(nextScore / 10) + 1;
          selectNextWord(nextLvl);
        }, 500);

      }, 1500);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !userInputs[index]) {
      const prevMissingIndex = [...wordLayout]
        .reverse()
        .findIndex((item) => item.isHidden && item.index < index);
      
      if (prevMissingIndex !== -1) {
        const actualIndex = wordLayout.length - 1 - prevMissingIndex;
        if (inputRefs.current[actualIndex]) {
          inputRefs.current[actualIndex].focus();
        }
      }
    }
  };

  if (showTest) {
    return <Test onBack={() => { setShowTest(false); selectNextWord(level); }} />;
  }

  // Se o jogo ainda não foi iniciado, mostramos a tela inicial lúdica (evita o bloqueio de áudio do navegador)
  if (!gameStarted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-[40px] p-8 md:p-12 kid-shadow border-8 border-yellow-400 max-w-md w-full transform hover:scale-102 transition-transform">
          <img src="/logo.svg" alt="Lexi Kids Logo" className="w-32 h-32 mx-auto mb-6 rounded-[32px] shadow-md animate-bounce-gentle border-4 border-yellow-300 object-cover" />
          <h1 className="text-3xl md:text-4xl font-black text-blue-600 tracking-wide mb-4">LEXI KIDS</h1>
          <p className="text-base font-bold text-gray-500 mb-8">
            Vamos aprender as letrinhas das palavras brincando! Pronto para começar?
          </p>
          <div className="flex flex-col gap-4">
            <button
              onClick={startGame}
              className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-2xl rounded-3xl border-b-8 border-emerald-700 hover:border-b-4 hover:translate-y-[4px] active:translate-y-[8px] active:border-b-0 transition-all shadow-lg"
            >
              <Play className="w-8 h-8 fill-current" />
              JOGAR!
            </button>
            {isLocalhost && (
              <button
                onClick={() => setShowTest(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-yellow-400 hover:bg-yellow-300 text-yellow-950 font-black text-xl rounded-2xl border-b-8 border-yellow-600 hover:border-b-4 hover:translate-y-[4px] active:translate-y-[8px] active:border-b-0 transition-all shadow-md"
              >
                ⚙️ MODO TESTE
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 md:p-6 text-[#2D3748]">
      {/* Top Header stats bar */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between bg-white/80 backdrop-blur-md rounded-3xl p-4 md:px-8 kid-shadow border-4 border-blue-400">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Lexi Kids Logo" className="w-12 h-12 rounded-2xl border-2 border-blue-300 shadow-sm animate-bounce-gentle object-cover" />
          <div>
            <h1 className="text-xl md:text-2xl font-black text-blue-600 tracking-wide">LEXI KIDS</h1>
            <p className="text-xs md:text-sm font-bold text-gray-500">Aprender brincando é divertido!</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isLocalhost && (
            <button
              onClick={() => setShowTest(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-yellow-950 font-black text-xs md:text-sm rounded-2xl border-b-4 border-yellow-600 hover:border-b-2 hover:translate-y-[2px] active:translate-y-[4px] transition-all shadow-sm shadow-yellow-500/30"
            >
              ⚙️ TESTE
            </button>
          )}
          <div className="flex items-center gap-1 bg-amber-100 px-3 py-1.5 rounded-2xl border-2 border-amber-300">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span className="text-sm md:text-base font-black text-amber-700">PONTOS: {score}</span>
          </div>
          <div className="flex items-center gap-1 bg-purple-100 px-3 py-1.5 rounded-2xl border-2 border-purple-300">
            <Award className="w-5 h-5 text-purple-500" />
            <span className="text-sm md:text-base font-black text-purple-700">NÍVEL: {level}</span>
          </div>
        </div>
      </header>

      {/* Main Game Screen */}
      <main className="flex-1 w-full max-w-4xl mx-auto flex flex-col items-center justify-center my-6">
        {currentWord ? (
          <div className={`w-full bg-white rounded-[40px] p-6 md:p-12 kid-shadow border-8 border-orange-300 transition-all duration-500 transform 
            ${transitionDirection === 'enter' ? 'translate-x-0 opacity-100 scale-100' : ''}
            ${transitionDirection === 'exit' ? 'translate-x-[150%] opacity-0 scale-95' : ''}
          `}>
            {/* Interactive Image & Pronounce Audio Button */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mb-8">
              <div className="relative group">
                <div className="w-48 h-48 md:w-56 md:h-56 bg-sky-100 rounded-[35px] border-4 border-sky-300 flex items-center justify-center text-8xl md:text-9xl kid-shadow transform group-hover:scale-105 transition-transform">
                  {currentWord.icon}
                </div>
                <span className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-yellow-400 border-2 border-yellow-500 text-yellow-900 font-bold px-4 py-1 rounded-full text-xs tracking-widest uppercase">
                  {currentWord.category === 'animal' ? '🦁 ANIMAL' : '🛋️ OBJETO'}
                </span>
              </div>

              <div className="flex flex-col items-center sm:items-start gap-4">
                <button
                  onClick={() => speakWord(currentWord.name)}
                  className="flex items-center gap-2 px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-lg md:text-xl rounded-2xl border-b-8 border-emerald-700 hover:border-b-4 hover:translate-y-[4px] active:translate-y-[8px] active:border-b-0 transition-all shadow-lg"
                >
                  <Volume2 className="w-7 h-7" />
                  OUVIR PALAVRA 🔊
                </button>
                <div className="text-sm font-bold text-gray-400 text-center sm:text-left max-w-xs space-y-1">
                  <p>💡 Dica: digite as letrinhas amarelas!</p>
                  <p className="text-blue-500 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">⌨️ Aperte <b>Espaço</b> para ouvir!</p>
                </div>
              </div>
            </div>

            {/* Alphabet Blocks / Game Play Board */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 my-8">
              {wordLayout.map((item, idx) => {
                const { char, isHidden } = item;
                
                if (completed) {
                  return (
                    <div
                      key={idx}
                      className="w-14 h-16 md:w-20 md:h-24 bg-emerald-100 text-emerald-600 border-4 border-emerald-400 rounded-2xl flex items-center justify-center text-3xl md:text-5xl font-extrabold shadow-md transform scale-105 animate-bounce-gentle"
                    >
                      {char}
                    </div>
                  );
                }

                if (!isHidden) {
                  return (
                    <div
                      key={idx}
                      className="w-14 h-16 md:w-20 md:h-24 bg-gray-100 text-gray-700 border-4 border-gray-300 rounded-2xl flex items-center justify-center text-3xl md:text-5xl font-extrabold shadow-sm"
                    >
                      {char}
                    </div>
                  );
                }

                const status = mistakes[idx];
                let inputBgColor = 'bg-yellow-50 border-yellow-400 text-yellow-700 focus:border-yellow-500 focus:bg-yellow-100';
                if (status === 'correct') {
                  inputBgColor = 'bg-emerald-100 border-emerald-500 text-emerald-700';
                } else if (status === 'incorrect') {
                  inputBgColor = 'bg-red-100 border-red-500 text-red-600 animate-pulse';
                }

                return (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    maxLength={1}
                    value={userInputs[idx] || ''}
                    onChange={(e) => handleInputChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className={`w-14 h-16 md:w-20 md:h-24 text-center text-3xl md:text-5xl font-extrabold border-4 rounded-2xl focus:outline-none transition-all shadow-inner uppercase ${inputBgColor}`}
                    disabled={completed}
                    placeholder="?"
                    autoComplete="off"
                    autoCapitalize="characters"
                  />
                );
              })}
            </div>

            <div className="h-12 flex items-center justify-center">
              {completed ? (
                <div className="flex items-center gap-2 text-emerald-600 font-extrabold text-xl md:text-2xl animate-bounce">
                  <Sparkles className="w-6 h-6 text-yellow-500" />
                  MUITO BEM! VOCÊ CONSEGUIU! 🎉
                  <Sparkles className="w-6 h-6 text-yellow-500" />
                </div>
              ) : (
                <p className="text-gray-400 font-bold text-sm md:text-base animate-pulse">
                  Preencha as letrinhas amarelas!
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg font-bold text-gray-500">Preparando próxima palavrinha...</p>
          </div>
        )}
      </main>

      {/* Rules Information Modal / Kids Footer */}
      <footer className="w-full max-w-4xl mx-auto mt-6 text-center text-xs md:text-sm font-bold text-sky-700 bg-sky-100/50 p-4 rounded-2xl border-2 border-sky-200">
        <p>🎮 Como Funciona cada Nível:</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-[10px] md:text-xs">
          <div className="p-1.5 bg-white/80 rounded-lg">⭐ Nív 1: 2-3 Letras (1 faltante)</div>
          <div className="p-1.5 bg-white/80 rounded-lg">⭐ Nív 2: 2-4 Letras (2 faltantes)</div>
          <div className="p-1.5 bg-white/80 rounded-lg">⭐ Nív 3: 3-5 Letras (2 faltantes)</div>
          <div className="p-1.5 bg-white/80 rounded-lg">⭐ Nív 4: 4-5 Letras (2-3 faltantes)</div>
          <div className="p-1.5 bg-white/80 rounded-lg">⭐ Nív 5: 3-5 Letras (2-3 faltantes)</div>
          <div className="p-1.5 bg-white/80 rounded-lg">⭐ Nív 6: 3-6 Letras (2-4 faltantes)</div>
          <div className="p-1.5 bg-white/80 rounded-lg">⭐ Nív 7: Desafio Avançado</div>
          <div className="p-1.5 bg-white/80 rounded-lg">⭐ Nív 8+: Modo Mestre! 👑</div>
        </div>
      </footer>
    </div>
  );
}

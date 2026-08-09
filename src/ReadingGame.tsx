import { AlertCircle, Award, CheckCircle, Mic, RefreshCw, Sparkles, Trophy, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PALAVRAS_BASE as SYLLABLE_WORDS } from './syllables';
import { ReadingWordItem, WordItem } from './types';
import { PALAVRAS_BASE as WORD_ICONS } from './words';

export interface ReadingGameProps {
  levelPoints: number;
  startLevel: number;
  onBackToMenu: () => void;
  onSwitchToWriting: () => void;
  onSwitchToTest: () => void;
  isLocalhost: boolean;
}

const audioCache = new Map<string, HTMLAudioElement>();
const SPEAKING_DURATION_MS = 1700;

function encodeWAV(samples: Float32Array, sampleRate: number = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (v: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      v.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function resampleAudioBuffer(audioBuffer: Float32Array, origRate: number, targetRate: number = 16000): Float32Array {
  if (origRate === targetRate) return audioBuffer;
  const ratio = origRate / targetRate;
  const newLength = Math.round(audioBuffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const origIdx = i * ratio;
    const i1 = Math.floor(origIdx);
    const i2 = Math.min(i1 + 1, audioBuffer.length - 1);
    const interp = origIdx - i1;
    result[i] = audioBuffer[i1] * (1 - interp) + audioBuffer[i2] * interp;
  }
  return result;
}

export default function ReadingGame({
  levelPoints,
  startLevel,
  onBackToMenu,
  onSwitchToWriting,
  onSwitchToTest,
  isLocalhost,
}: ReadingGameProps) {
  // Permissão do Microfone
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Estado do Jogo
  const [score, setScore] = useState<number>(0);
  const [level, setLevel] = useState<number>(startLevel);
  const [currentWord, setCurrentWord] = useState<ReadingWordItem | null>(null);
  const [currentLetterIndex, setCurrentLetterIndex] = useState<number>(0);
  const [isWordPhase, setIsWordPhase] = useState<boolean>(false);
  
  // Estado de Gravação e Reconhecimento
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recordingCountdown, setRecordingCountdown] = useState<number>(Math.ceil(SPEAKING_DURATION_MS / 1000));
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [detectedText, setDetectedText] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  const wordHistoryRef = useRef<string[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Solicita permissão do microfone ao carregar
  useEffect(() => {
    requestMicrophonePermission();
    checkBackendHealth();
    return () => {
      stopMicrophoneStream();
    };
  }, []);

  // Atualiza o nível conforme a pontuação
  useEffect(() => {
    const calculatedLevel = Math.floor(score / levelPoints) + startLevel;
    if (calculatedLevel !== level) {
      setLevel(calculatedLevel);
      if (score > 0 && score % levelPoints === 0) {
        playSound("/level-up.mp3");
      }
    }
  }, [score, levelPoints, startLevel]);

  // Inicializa a primeira palavra assim que tiver permissão do microfone
  useEffect(() => {
    if (hasMicPermission) {
      selectNextWord();
    }
  }, [hasMicPermission]);

  // Atalho de Teclado (Barra de Espaço para Falar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (!isListening && !isProcessing && hasMicPermission) {
          handleStartListening();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isListening, isProcessing, hasMicPermission, currentWord, currentLetterIndex, isWordPhase]);

  const checkBackendHealth = async () => {
    try {
      const res = await fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      setMicError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setHasMicPermission(true);
    } catch (err: any) {
      console.error("Erro ao acessar microfone:", err);
      setHasMicPermission(false);
      setMicError("Permissão do microfone negada. Por favor, permita o acesso para jogar.");
    }
  };

  const stopMicrophoneStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  async function playSound(src: string) {
    try {
      let audio = audioCache.get(src);
      if (!audio) {
        audio = new Audio(src);
        audioCache.set(src, audio);
      }
      audio.currentTime = 0;
      await audio.play();
    } catch (e) {
      console.warn("Erro ao tocar áudio:", e);
    }
  }

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
      utterance.lang = 'pt-BR';
      utterance.rate = 0.9;
      utterance.pitch = 1.2;
      window.speechSynthesis.speak(utterance);
    }
  };

  const selectNextWord = () => {
    // Mescla dados do syllables.js com icons do words.js
    const iconMap = new Map<string, { icon: string; category: string }>();
    WORD_ICONS.forEach((w: WordItem) => {
      iconMap.set(w.name.toUpperCase(), { icon: w.icon, category: w.category });
    });

    const fullWordsList: ReadingWordItem[] = SYLLABLE_WORDS.map(s => {
      const iconData = iconMap.get(s.name.toUpperCase()) || { icon: '🔤', category: 'palavra' };
      return {
        name: s.name.toUpperCase(),
        syllables: s.syllables,
        syllableCount: s.syllableCount,
        icon: iconData.icon,
        category: iconData.category
      };
    });

    // Filtra histórico para evitar repetição
    const history = wordHistoryRef.current;
    let available = fullWordsList.filter(w => !history.includes(w.name));
    if (available.length === 0) available = fullWordsList;

    const chosen = available[Math.floor(Math.random() * available.length)];
    
    const nextHistory = [...history, chosen.name];
    if (nextHistory.length > 5) nextHistory.shift();
    wordHistoryRef.current = nextHistory;

    setCurrentWord(chosen);
    setCurrentLetterIndex(0);
    setIsWordPhase(false);
    setFeedback(null);

    // Fala a palavra ao carregar a rodada
    setTimeout(() => {
      speakText(chosen.name);
    }, 300);
  };

  const handleStartListening = async () => {
    if (!currentWord || isListening || isProcessing) return;

    setIsListening(true);
    const initialSeconds = Math.ceil(SPEAKING_DURATION_MS / 1000);
    setRecordingCountdown(initialSeconds);
    setFeedback({ message: 'Ouvindo... Fale agora!', type: 'info' });

    try {
      const stream = mediaStreamRef.current || await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
        setIsListening(false);
        setIsProcessing(true);
        setFeedback({ message: 'Processando voz...', type: 'info' });

        try {
          const rawBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          const arrayBuffer = await rawBlob.arrayBuffer();
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          const channelData = audioBuffer.getChannelData(0);
          const resampled = resampleAudioBuffer(channelData, audioBuffer.sampleRate, 16000);
          const wavBlob = encodeWAV(resampled, 16000);
          await audioCtx.close();
          await processAudio(wavBlob);
        } catch (err) {
          console.warn("Erro ao decodificar áudio no navegador:", err);
          const fallbackBlob = new Blob(audioChunks, { type: 'audio/wav' });
          await processAudio(fallbackBlob);
        }
      };

      mediaRecorder.start();

      // Intervalo de contagem regressiva visual
      let timeLeft = initialSeconds;
      intervalTimerRef.current = setInterval(() => {
        timeLeft -= 1;
        if (timeLeft >= 1) {
          setRecordingCountdown(timeLeft);
        }
      }, 1000);

      // Grava pelo tempo em milissegundos definido na constante
      recordingTimerRef.current = setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, SPEAKING_DURATION_MS);

    } catch (err) {
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
      console.error("Erro ao gravar áudio:", err);
      setIsListening(false);
      setIsProcessing(false);
      setFeedback({ message: 'Erro ao ligar microfone', type: 'error' });
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    const target = isWordPhase 
      ? currentWord!.name 
      : currentWord!.name[currentLetterIndex];

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'speech.wav');
      formData.append('target', target);

      const response = await fetch('http://localhost:8000/api/recognize', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setDetectedText(data.phonemes || '(vazio)');
        handleRecognitionResult(data.matched, data.phonemes, target);
      } else {
        throw new Error('Falha no servidor Python');
      }
    } catch (err) {
      console.warn("Backend offline ou erro HTTP. Usando validação simulada:", err);
      // Caso backend não esteja ativo, dá feedback amigável
      handleRecognitionResult(true, target.toLowerCase(), target);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecognitionResult = (matched: boolean, heardPhonemes: string, target: string) => {
    if (matched) {
      playSound("/point-up.mp3");
      setScore(prev => prev + 1);

      if (!isWordPhase) {
        setFeedback({ message: `Muito bem! Você disse a letra "${target}"! 🌟`, type: 'success' });

        // Avança para a próxima letra ou entra na fase de falar a palavra inteira
        if (currentLetterIndex + 1 < currentWord!.name.length) {
          setTimeout(() => {
            setCurrentLetterIndex(prev => prev + 1);
            setFeedback(null);
          }, 800);
        } else {
          // Chegou ao fim de todas as letras da palavra
          setTimeout(() => {
            setIsWordPhase(true);
            setFeedback({ message: `Agora fale a palavra completa: ${currentWord!.name}! 🗣️`, type: 'info' });
            speakText(`Muito bem! Agora fale a palavra: ${currentWord!.name}`);
          }, 1000);
        }
      } else {
        // Completou a palavra inteira!
        setFeedback({ message: `INCRÍVEL! Palavra "${currentWord!.name}" completada! 🎉`, type: 'success' });
        setTimeout(() => {
          selectNextWord();
        }, 1200);
      }
    } else {
      setFeedback({ 
        message: `Não ouvi direito a letra "${target}". Tente de novo! 🎤`, 
        type: 'error' 
      });
      //speakText(`Tente falar a letra ${target}`);
    }
  };

  // Se a permissão do microfone ainda não foi concedida ou está pendente
  if (hasMicPermission === null || hasMicPermission === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-amber-50">
        <div className="bg-white rounded-[40px] p-8 md:p-12 kid-shadow border-8 border-yellow-400 max-w-md w-full text-center">
          <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-yellow-300">
            <Mic className="w-12 h-12 text-yellow-600 animate-pulse" />
          </div>
          <h2 className="text-3xl font-black text-blue-600 mb-4">LEITOR LEXI KIDS</h2>
          <p className="text-gray-600 font-bold mb-6">
            Para jogar o Jogo da Leitura, precisamos da permissão do seu microfone para ouvir a sua voz!
          </p>
          {micError && (
            <div className="mb-6 p-4 bg-red-100 border-2 border-red-300 rounded-2xl text-red-700 font-bold text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {micError}
            </div>
          )}
          <button
            onClick={requestMicrophonePermission}
            className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-2xl rounded-3xl border-b-8 border-emerald-700 hover:border-b-4 hover:translate-y-[4px] active:translate-y-[8px] active:border-b-0 transition-all shadow-lg"
          >
            <Mic className="w-8 h-8" />
            PERMITIR MICROFONE
          </button>
          <button
            onClick={onBackToMenu}
            className="mt-4 text-gray-500 font-bold hover:underline"
          >
            Voltar ao Menu
          </button>
        </div>
      </div>
    );
  }

  if (!currentWord) return null;

  const letters = currentWord.name.split('');

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-4 md:p-6 overflow-x-hidden selection:bg-none select-none">
      
      {/* Cabeçalho do Jogo (Estilo WritingGame) */}
      <header className="w-full max-w-4xl flex items-center justify-between gap-4 mb-4">
        <button
          onClick={onBackToMenu}
          className="px-5 py-3 bg-white hover:bg-gray-100 text-gray-700 font-black rounded-2xl border-b-4 border-gray-300 hover:border-b-2 hover:translate-y-[2px] active:translate-y-[4px] active:border-b-0 transition-all shadow-sm flex items-center gap-2"
        >
          ⬅️ Voltar
        </button>

        {/* Status do Backend Python */}
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border-2 border-gray-200 text-xs font-bold shadow-sm">
          <span className={`w-3 h-3 rounded-full ${backendStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
          <span>{backendStatus === 'online' ? 'IA Ouvindo (Python Python OK)' : 'IA Off-line (Modo Simulação)'}</span>
        </div>

        {/* Nível e Pontuação */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-purple-100 border-4 border-purple-300 rounded-2xl text-purple-700 font-black shadow-sm">
            <Trophy className="w-5 h-5 text-purple-600" />
            <span>Nível {level}</span>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 border-4 border-yellow-300 rounded-2xl text-yellow-800 font-black shadow-sm">
            <Award className="w-5 h-5 text-yellow-600" />
            <span>{score} / {levelPoints} pts</span>
          </div>
        </div>
      </header>

      {/* Cartão Principal do Jogo */}
      <main className="w-full max-w-2xl bg-white rounded-[45px] p-6 md:p-10 kid-shadow border-8 border-sky-400 flex flex-col items-center relative my-auto">
        
        {/* Botão de Ouvir Palavra Novamente */}
        <button
          onClick={() => speakText(currentWord.name)}
          className="absolute top-6 right-6 p-4 bg-sky-100 hover:bg-sky-200 text-sky-600 rounded-full border-b-4 border-sky-300 hover:border-b-2 hover:translate-y-[2px] active:translate-y-[4px] active:border-b-0 transition-all shadow-sm"
          title="Ouvir palavra"
        >
          <Volume2 className="w-7 h-7" />
        </button>

        {/* Imagem/Ícone da Palavra */}
        <div className="relative mb-6">
          <div className="w-36 h-36 md:w-44 md:h-44 bg-sky-50 rounded-[35px] border-4 border-sky-200 flex items-center justify-center text-7xl md:text-8xl shadow-inner transform hover:scale-105 transition-transform">
            {currentWord.icon}
          </div>
          <Sparkles className="absolute -top-3 -right-3 w-8 h-8 text-yellow-400 animate-spin" />
        </div>

        {/* Instrução da Fase */}
        <div className="mb-6 text-center">
          {!isWordPhase ? (
            <p className="text-xl md:text-2xl font-black text-sky-800">
              Fale a letrinha em destaque: <span className="text-3xl text-emerald-600 font-black">{letters[currentLetterIndex]}</span>
            </p>
          ) : (
            <p className="text-xl md:text-2xl font-black text-purple-700 animate-bounce">
              Muito bem! Agora fale a palavra completa! 🗣️
            </p>
          )}
        </div>

        {/* Visualização das Letras da Palavra */}
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mb-8">
          {letters.map((char, index) => {
            const isCurrent = !isWordPhase && index === currentLetterIndex;
            const isCompleted = index < currentLetterIndex || isWordPhase;
            const isMuted = index > currentLetterIndex && !isWordPhase;

            return (
              <div
                key={index}
                className={`
                  relative w-14 h-16 md:w-18 md:h-20 rounded-2xl flex flex-col items-center justify-center text-3xl md:text-4xl font-black transition-all duration-300
                  ${isCurrent 
                    ? 'bg-emerald-400 text-white border-b-8 border-emerald-600 scale-110 shadow-lg ring-4 ring-emerald-200 animate-pulse' 
                    : isCompleted
                      ? 'bg-sky-100 text-sky-700 border-b-4 border-sky-300 scale-100'
                      : 'bg-gray-100 text-gray-400 border-b-4 border-gray-200 opacity-40 grayscale' // Estilo Mute
                  }
                `}
              >
                {char}
                {isCompleted && !isWordPhase && (
                  <CheckCircle className="absolute -top-2 -right-2 w-5 h-5 text-emerald-500 bg-white rounded-full" />
                )}
              </div>
            );
          })}
        </div>

        {/* Feedback visual */}
        {feedback && (
          <div className={`
            mb-6 px-6 py-3 rounded-2xl font-black text-lg text-center flex items-center justify-center gap-2 transition-all
            ${feedback.type === 'success' ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300' : ''}
            ${feedback.type === 'error' ? 'bg-rose-100 text-rose-700 border-2 border-rose-300' : ''}
            ${feedback.type === 'info' ? 'bg-sky-100 text-sky-700 border-2 border-sky-300' : ''}
          `}>
            {feedback.message}
          </div>
        )}

        {/* Debug no Localhost */}
        {isLocalhost && detectedText !== null && (
          <div className="mb-6 px-4 py-2 bg-purple-100 border-2 border-purple-300 rounded-2xl text-purple-900 text-sm font-mono font-bold text-center">
            🐛 Debug IA detectou: <span className="text-purple-700 font-black text-base">"{detectedText}"</span>
          </div>
        )}

        {/* Botão Principal "Aperte para Falar" */}
        <div className="w-full flex flex-col items-center gap-3">
          <button
            onClick={handleStartListening}
            disabled={isListening || isProcessing}
            className={`
              w-full py-5 px-8 font-black text-2xl rounded-3xl flex items-center justify-center gap-4 transition-all shadow-xl
              ${isListening 
                ? 'bg-rose-500 text-white border-b-8 border-rose-700 scale-105 animate-pulse' 
                : isProcessing
                  ? 'bg-amber-400 text-amber-950 border-b-8 border-amber-600 opacity-80 cursor-wait'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white border-b-8 border-emerald-700 hover:border-b-4 hover:translate-y-[4px] active:translate-y-[8px] active:border-b-0 cursor-pointer'
              }
            `}
          >
            {isListening ? (
              <>
                <Mic className="w-9 h-9 animate-bounce text-white" />
                <span>OUVINDO... ({recordingCountdown}s)</span>
              </>
            ) : isProcessing ? (
              <>
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span>ANALISANDO SOM...</span>
              </>
            ) : (
              <>
                <Mic className="w-9 h-9" />
                <span>APERTE PARA FALAR</span>
              </>
            )}
          </button>

          {/* Dica de Teclado */}
          <p className="text-xs font-extrabold text-gray-400">
            💡 Dica: você também pode pressionar a tecla <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded">ESPAÇO</span>
          </p>
        </div>

      </main>

    </div>
  );
}

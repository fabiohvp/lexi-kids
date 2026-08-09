import React, { useState } from 'react';
import { Play, Settings, BookOpen } from 'lucide-react';

export interface MenuProps {
  onStartWritingGame: () => void;
  onStartReadingGame: () => void;
  onStartTest: () => void;
  isLocalhost: boolean;
  levelPoints: number;
  onLevelPointsChange: (val: number) => void;
  startLevel: number;
  onStartLevelChange: (val: number) => void;
}

export default function Menu({
  onStartWritingGame,
  onStartReadingGame,
  onStartTest,
  isLocalhost,
  levelPoints,
  onLevelPointsChange,
  startLevel,
  onStartLevelChange,
}: MenuProps) {
  const [showSettings, setShowSettings] = useState<boolean>(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center overflow-x-hidden">
      <div className="relative bg-white rounded-[40px] p-8 md:p-12 kid-shadow border-8 border-yellow-400 max-w-md w-full transform hover:scale-102 transition-transform">
        {/* Botão de Configuração */}
        <button
          onClick={() => setShowSettings(true)}
          className="absolute top-4 right-4 p-3 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-full border-b-4 border-purple-300 hover:border-b-2 hover:translate-y-[2px] active:translate-y-[4px] active:border-b-0 transition-all shadow-sm z-10"
          title="Configurações"
        >
          <Settings className="w-6 h-6" />
        </button>

        <img src="/logo.svg" alt="Lexi Kids Logo" className="w-32 h-32 mx-auto mb-6 rounded-[32px] shadow-md animate-bounce-gentle border-4 border-yellow-300 object-cover" />
        <h1 className="text-3xl md:text-4xl font-black text-blue-600 tracking-wide mb-4">LEXI KIDS</h1>
        <p className="text-base font-bold text-gray-500 mb-8">
          Vamos aprender as letrinhas das palavras brincando! Pronto para começar?
        </p>
        <div className="flex flex-col gap-4">
          <button
            onClick={onStartWritingGame}
            className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-2xl rounded-3xl border-b-8 border-emerald-700 hover:border-b-4 hover:translate-y-[4px] active:translate-y-[8px] active:border-b-0 transition-all shadow-lg"
          >
            <Play className="w-8 h-8 fill-current" />
            ✍️ JOGO DA ESCRITA
          </button>
          <button
            onClick={onStartReadingGame}
            className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-sky-500 hover:bg-sky-400 text-white font-black text-2xl rounded-3xl border-b-8 border-sky-700 hover:border-b-4 hover:translate-y-[4px] active:translate-y-[8px] active:border-b-0 transition-all shadow-lg"
          >
            <BookOpen className="w-8 h-8" />
            📖 JOGO DA LEITURA
          </button>
          {isLocalhost && (
            <button
              onClick={onStartTest}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-yellow-400 hover:bg-yellow-300 text-yellow-950 font-black text-xl rounded-2xl border-b-8 border-yellow-600 hover:border-b-4 hover:translate-y-[4px] active:translate-y-[8px] active:border-b-0 transition-all shadow-md"
            >
              ⚙️ MODO TESTE
            </button>
          )}
        </div>
      </div>

      {/* Modal de Configuração */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[45px] p-8 kid-shadow border-8 border-purple-400 max-w-sm w-full transform scale-100 transition-all">
            <h2 className="text-2xl md:text-3xl font-black text-purple-600 mb-6 flex items-center justify-center gap-2">
              <Settings className="w-8 h-8" />
              Ajustes
            </h2>
            
            <div className="space-y-6 mb-8 text-left">
              <div>
                <label className="block text-base font-black text-purple-900 mb-3 text-center">
                  Acertos para subir de nível:
                </label>
                <div className="flex items-center justify-center gap-4 mb-4">
                  <button
                    type="button"
                    onClick={() => onLevelPointsChange(levelPoints - 10)}
                    disabled={levelPoints <= 10}
                    className="w-12 h-12 bg-purple-100 hover:bg-purple-200 disabled:opacity-40 disabled:hover:bg-purple-100 text-purple-700 font-black text-2xl rounded-2xl flex items-center justify-center border-b-4 border-purple-300 hover:border-b-2 hover:translate-y-[2px] active:translate-y-[4px] active:border-b-0 transition-all shadow-sm"
                  >
                    -
                  </button>
                  <span className="text-3xl font-black text-purple-600 w-20 text-center">
                    {levelPoints}
                  </span>
                  <button
                    type="button"
                    onClick={() => onLevelPointsChange(levelPoints + 10)}
                    disabled={levelPoints >= 200}
                    className="w-12 h-12 bg-purple-100 hover:bg-purple-200 disabled:opacity-40 disabled:hover:bg-purple-100 text-purple-700 font-black text-2xl rounded-2xl flex items-center justify-center border-b-4 border-purple-300 hover:border-b-2 hover:translate-y-[2px] active:translate-y-[4px] active:border-b-0 transition-all shadow-sm"
                  >
                    +
                  </button>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="10"
                  value={levelPoints}
                  onChange={(e) => onLevelPointsChange(Number(e.target.value))}
                  className="w-full h-3 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600 mt-2"
                />
                <div className="flex justify-between text-xs font-bold text-purple-400 mt-2 px-1">
                  <span>Mínimo: 10</span>
                  <span>Máximo: 200</span>
                </div>
              </div>

              <div className="pt-4 border-t border-purple-100">
                <label className="block text-base font-black text-purple-900 mb-3 text-center">
                  Nível Inicial (1 a 8):
                </label>
                <div className="flex items-center justify-center gap-4 mb-4">
                  <button
                    type="button"
                    onClick={() => onStartLevelChange(startLevel - 1)}
                    disabled={startLevel <= 1}
                    className="w-12 h-12 bg-purple-100 hover:bg-purple-200 disabled:opacity-40 disabled:hover:bg-purple-100 text-purple-700 font-black text-2xl rounded-2xl flex items-center justify-center border-b-4 border-purple-300 hover:border-b-2 hover:translate-y-[2px] active:translate-y-[4px] active:border-b-0 transition-all shadow-sm"
                  >
                    -
                  </button>
                  <span className="text-4xl font-black text-purple-600 w-16 text-center">
                    {startLevel}
                  </span>
                  <button
                    type="button"
                    onClick={() => onStartLevelChange(startLevel + 1)}
                    disabled={startLevel >= 8}
                    className="w-12 h-12 bg-purple-100 hover:bg-purple-200 disabled:opacity-40 disabled:hover:bg-purple-100 text-purple-700 font-black text-2xl rounded-2xl flex items-center justify-center border-b-4 border-purple-300 hover:border-b-2 hover:translate-y-[2px] active:translate-y-[4px] active:border-b-0 transition-all shadow-sm"
                  >
                    +
                  </button>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={startLevel}
                  onChange={(e) => onStartLevelChange(Number(e.target.value))}
                  className="w-full h-3 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600 mt-2"
                />
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-black text-xl rounded-2xl border-b-4 border-purple-800 hover:border-b-2 hover:translate-y-[2px] active:translate-y-[4px] active:border-b-0 transition-all shadow-md"
            >
              OK, PRONTO!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

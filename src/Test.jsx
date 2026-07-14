import React, { useState, useEffect } from 'react';
import { Volume2, Trash2, ArrowRight, ArrowLeft, Download, RotateCcw } from 'lucide-react';
import { OBJETOS_COMUNS, ANIMAIS_COMUNS } from './database';

export default function Test({ onBack }) {
  // Mantém a lista de palavras unificada em memória para edição em tempo real
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [jumpIndexText, setJumpIndexText] = useState('1');

  // Inicializa os estados locais a partir das constantes importadas apenas uma vez no mount (mantém ordem estável durante edição)
  useEffect(() => {
    const combined = [...OBJETOS_COMUNS, ...ANIMAIS_COMUNS];
    const sorted = combined.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    setWords(sorted);
  }, []);

  const currentWord = words[currentIndex];

  // Sincroniza o input numérico sempre que a palavra ativa mudar
  useEffect(() => {
    if (words.length > 0) {
      setJumpIndexText((currentIndex + 1).toString());
    }
  }, [currentIndex, words.length]);

  // Função para renomear o item selecionado em tempo real
  const handleRename = (newName) => {
    const upperName = newName.toUpperCase();
    setWords(prev => prev.map((w, idx) => idx === currentIndex ? { ...w, name: upperName } : w));
  };

  // Função para saltar diretamente para um índice
  const handleJumpIndexChange = (val) => {
    setJumpIndexText(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= words.length) {
      setCurrentIndex(parsed - 1);
    }
  };

  // Função de voz para pronunciar a palavra
  const speakWord = (wordText) => {
    if (!wordText) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(wordText.toLowerCase());
      utterance.lang = 'pt-BR';
      utterance.rate = 0.85;
      utterance.pitch = 1.25;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Toca o som quando a palavra atual muda
  useEffect(() => {
    if (currentWord) {
      speakWord(currentWord.name);
    }
  }, [currentWord]);

  // Função para deletar a palavra atual em memória
  const handleDeleteWord = () => {
    if (!currentWord || words.length === 0) return;

    const updated = words.filter((_, idx) => idx !== currentIndex);
    setWords(updated);

    // Ajusta o índice se for o último elemento da lista
    if (currentIndex >= updated.length && updated.length > 0) {
      setCurrentIndex(updated.length - 1);
    }
  };

  // Função para avançar para a próxima palavra
  const handleNextWord = () => {
    if (words.length === 0) return;
    setCurrentIndex((prevIndex) => (prevIndex + 1) % words.length);
  };

  // Função para voltar para a palavra anterior
  const handlePrevWord = () => {
    if (words.length === 0) return;
    setCurrentIndex((prevIndex) => (prevIndex - 1 + words.length) % words.length);
  };

  // Restaura o banco de dados original em memória
  const handleReset = () => {
    if (window.confirm("Deseja redefinir a base de dados em memória para o padrão original?")) {
      const combined = [...OBJETOS_COMUNS, ...ANIMAIS_COMUNS];
      const sorted = combined.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      setWords(sorted);
      setCurrentIndex(0);
      setJumpIndexText('1');
    }
  };

  // Gera o arquivo database.js filtrando de volta por categoria
  const handleDownload = () => {
    const objetos = words.filter(w => w.category === 'objeto');
    const animais = words.filter(w => w.category === 'animal');

    const fileContent = `// Banco de dados de objetos comuns e animais comuns editado
export const OBJETOS_COMUNS = ${JSON.stringify(objetos, null, 2)};

export const ANIMAIS_COMUNS = ${JSON.stringify(animais, null, 2)};

// Combine both lists into the final base of data
export const PALAVRAS_BASE = [...OBJETOS_COMUNS, ...ANIMAIS_COMUNS];
`;

    const blob = new Blob([fileContent], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'database.js';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Ouvinte de eventos de teclado (DEL, ENTER, ESPAÇO, SETAS)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignora atalhos de teclado globais se o foco estiver em um campo de entrada
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }

      if (words.length === 0) return;

      if (e.key === 'Delete' || e.key === 'Del') {
        e.preventDefault();
        handleDeleteWord();
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextWord();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevWord();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (currentWord) {
          speakWord(currentWord.name);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [words, currentIndex, currentWord]);

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 md:p-6 text-[#2D3748]">
      {/* Cabeçalho */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between bg-white/80 backdrop-blur-md rounded-3xl p-4 md:px-8 kid-shadow border-4 border-yellow-400">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-yellow-400 flex items-center justify-center text-2xl font-bold border-2 border-yellow-500 shadow-sm animate-bounce-gentle">
            ⚙️
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-blue-600 tracking-wide">MODO TESTE</h1>
            <p className="text-xs md:text-sm font-bold text-gray-500">Edição em memória e exportação do arquivo</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-black text-sm md:text-base rounded-2xl border-b-4 border-sky-700 hover:border-b-2 hover:translate-y-[2px] active:translate-y-[4px] active:border-b-0 transition-all shadow-md"
          >
            <Download className="w-5 h-5" />
            BAIXAR DATABASE.JS
          </button>

          <button
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-black text-sm md:text-base rounded-2xl border-b-4 border-blue-700 hover:border-b-2 hover:translate-y-[2px] active:translate-y-[4px] active:border-b-0 transition-all shadow-md"
          >
            VOLTAR AO JOGO
          </button>
        </div>
      </header>

      {/* Área Central */}
      <main className="flex-1 w-full max-w-4xl mx-auto flex flex-col items-center justify-center my-6">
        {words.length > 0 && currentWord ? (
          <div className="w-full bg-white rounded-[40px] p-6 md:p-12 kid-shadow border-8 border-yellow-300 relative flex flex-col items-center">
            
            {/* Indicador de Posição */}
            <div className="absolute top-4 right-6 text-sm md:text-base font-black text-yellow-700 bg-yellow-100 border-2 border-yellow-300 px-3 py-1 rounded-full">
              {currentIndex + 1} / {words.length}
            </div>

            {/* Inputs de Controle e Renomeação */}
            <div className="w-full max-w-md grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 mt-2">
              {/* Input de Renomeação */}
              <div>
                <label className="block text-xs font-black text-yellow-800 mb-1 tracking-wide uppercase">
                  ✏️ RENOMEAR PALAVRA:
                </label>
                <input
                  type="text"
                  value={currentWord.name}
                  onChange={(e) => handleRename(e.target.value)}
                  placeholder="Nome da palavra..."
                  className="w-full px-4 py-2 rounded-2xl border-4 border-yellow-100 focus:border-yellow-400 focus:outline-none font-bold text-[#2D3748] shadow-inner uppercase"
                />
              </div>

              {/* Input de Salto por Índice */}
              <div>
                <label className="block text-xs font-black text-yellow-800 mb-1 tracking-wide uppercase">
                  🔢 IR PARA ÍNDICE:
                </label>
                <input
                  type="number"
                  min={1}
                  max={words.length}
                  value={jumpIndexText}
                  onChange={(e) => handleJumpIndexChange(e.target.value)}
                  placeholder="Ex: 5..."
                  className="w-full px-4 py-2 rounded-2xl border-4 border-yellow-100 focus:border-yellow-400 focus:outline-none font-bold text-[#2D3748] shadow-inner"
                />
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-6 mt-2 w-full">
              
              {/* Representação Visual da Palavra */}
              <div className="relative group">
                <div className="w-48 h-48 md:w-56 md:h-56 bg-sky-100 rounded-[35px] border-4 border-sky-300 flex items-center justify-center text-8xl md:text-9xl kid-shadow transform group-hover:scale-105 transition-transform">
                  {currentWord.icon}
                </div>
                <span className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-yellow-400 border-2 border-yellow-500 text-yellow-900 font-bold px-4 py-1 rounded-full text-xs tracking-widest uppercase">
                  {currentWord.category === 'animal' ? '🦁 ANIMAL' : '🛋️ OBJETO'}
                </span>
              </div>

              {/* Nome da Palavra */}
              <div className="text-center">
                <h2 className="text-4xl md:text-6xl font-black text-gray-800 tracking-wide uppercase">
                  {currentWord.name}
                </h2>
              </div>

              {/* Controles de Som e Deleção */}
              <div className="flex flex-wrap items-center justify-center gap-4 mt-4 w-full">
                
                {/* Botão Ouvir */}
                <button
                  onClick={() => speakWord(currentWord.name)}
                  className="flex items-center gap-2 px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-lg md:text-xl rounded-2xl border-b-8 border-emerald-700 hover:border-b-4 hover:translate-y-[4px] active:translate-y-[8px] active:border-b-0 transition-all shadow-lg"
                >
                  <Volume2 className="w-6 h-6" />
                  OUVIR (ESPAÇO) 🔊
                </button>

                {/* Botão Deletar */}
                <button
                  onClick={handleDeleteWord}
                  className="flex items-center gap-2 px-6 py-4 bg-rose-500 hover:bg-rose-400 text-white font-black text-lg md:text-xl rounded-2xl border-b-8 border-rose-700 hover:border-b-4 hover:translate-y-[4px] active:translate-y-[8px] active:border-b-0 transition-all shadow-lg"
                >
                  <Trash2 className="w-6 h-6" />
                  APAGAR (DEL) 🗑️
                </button>
              </div>

              {/* Navegação Manual */}
              <div className="flex items-center justify-between w-full max-w-md mt-6">
                <button
                  onClick={handlePrevWord}
                  className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full border-2 border-gray-300 transition-all"
                  title="Palavra Anterior"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>

                <div className="text-xs md:text-sm font-bold text-gray-400 text-center space-y-1">
                  <p>⌨️ Dicas de Teclado:</p>
                  <p><b>[← / →]</b> Navegar | <b>[ESPAÇO]</b> Ouvir | <b>[ENTER]</b> Avançar | <b>[DEL]</b> Apagar</p>
                </div>

                <button
                  onClick={handleNextWord}
                  className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full border-2 border-gray-300 transition-all"
                  title="Próxima Palavra"
                >
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>

            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[40px] p-12 kid-shadow border-8 border-red-300 text-center max-w-md w-full">
            <span className="text-8xl">📭</span>
            <h2 className="text-2xl font-black text-red-500 mt-4">Lista Vazia!</h2>
            <p className="text-gray-500 font-bold mt-2 mb-6">Todas as palavras foram removidas da memória temporária.</p>
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-500 hover:bg-blue-400 text-white font-black text-lg rounded-2xl border-b-6 border-blue-700 hover:border-b-4 hover:translate-y-[2px] active:translate-y-[4px] transition-all shadow-md"
            >
              <RotateCcw className="w-6 h-6" />
              Restaurar Palavras Padrão
            </button>
          </div>
        )}
      </main>

      {/* Rodapé */}
      <footer className="w-full max-w-4xl mx-auto mt-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-sky-100/50 p-4 rounded-2xl border-2 border-sky-200">
        <p className="text-xs md:text-sm font-bold text-sky-700 text-center md:text-left">
          💡 As exclusões e renomeações são feitas apenas em memória. Baixe o arquivo atualizado e substitua o arquivo original da sua pasta.
        </p>

        {words.length > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 hover:text-red-500 font-extrabold text-xs rounded-xl border border-gray-300 shadow-sm transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Restaurar Base
          </button>
        )}
      </footer>
    </div>
  );
}

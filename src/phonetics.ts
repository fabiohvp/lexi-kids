/**
 * Módulo de Fonética e Comparação de Fonemas para Português (PT-BR)
 * 
 * Permite transformar texto (sílabas e transcrições do ASR) em fonemas e 
 * calcular a similaridade fonética com base em matrizes de distância articulatória.
 */

// Nomes das letras faladas para auxílio na verificação de soletrar
export const LETTER_NAMES: Record<string, string[]> = {
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

/**
 * Normaliza o texto removendo caracteres especiais e pontuações
 */
export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, (match) => {
      // Manter til para diferenciar vogais nasais se necessário, mas normalizar acentos agudos/circunflexos
      return match === '\u0303' ? '~' : '';
    })
    .replace(/[^a-z0-9~\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converte um texto em português para uma sequência de fonemas simplificados
 */
export function textToPhonemes(text: string): string[] {
  const norm = normalizeText(text);
  if (!norm) return [];

  const words = norm.split(/\s+/);
  const allPhonemes: string[] = [];

  for (const word of words) {
    let i = 0;
    while (i < word.length) {
      const char = word[i];
      const nextChar = word[i + 1] || '';
      const thirdChar = word[i + 2] || '';

      // Digrafos e combinacoes especiais
      if (char === 'c' && nextChar === 'h') {
        allPhonemes.push('ʃ'); // 'x' / 'ch'
        i += 2;
        continue;
      }
      if (char === 'l' && nextChar === 'h') {
        allPhonemes.push('ʎ'); // 'lh'
        i += 2;
        continue;
      }
      if (char === 'n' && nextChar === 'h') {
        allPhonemes.push('ɲ'); // 'nh'
        i += 2;
        continue;
      }
      if (char === 'r' && nextChar === 'r') {
        allPhonemes.push('ʁ'); // 'rr' forte
        i += 2;
        continue;
      }
      if (char === 's' && nextChar === 's') {
        allPhonemes.push('s');
        i += 2;
        continue;
      }
      if (char === 'q' && nextChar === 'u') {
        allPhonemes.push('k');
        i += (thirdChar === 'e' || thirdChar === 'i') ? 2 : 2;
        continue;
      }
      if (char === 'g' && nextChar === 'u' && (thirdChar === 'e' || thirdChar === 'i')) {
        allPhonemes.push('ɡ');
        i += 2;
        continue;
      }

      // Mapeamento de consoantes isoladas
      if (char === 'b') { allPhonemes.push('b'); i++; continue; }
      if (char === 'p') { allPhonemes.push('p'); i++; continue; }
      if (char === 'd') { allPhonemes.push('d'); i++; continue; }
      if (char === 't') { allPhonemes.push('t'); i++; continue; }
      if (char === 'v') { allPhonemes.push('v'); i++; continue; }
      if (char === 'f') { allPhonemes.push('f'); i++; continue; }
      if (char === 'm') { allPhonemes.push('m'); i++; continue; }
      if (char === 'n') { allPhonemes.push('n'); i++; continue; }
      if (char === 'z') { allPhonemes.push('z'); i++; continue; }
      if (char === 'j') { allPhonemes.push('ʒ'); i++; continue; }
      if (char === 'k') { allPhonemes.push('k'); i++; continue; }
      if (char === 'x') { allPhonemes.push('ʃ'); i++; continue; }
      if (char === 'h') { i++; continue; } // 'h' inicial é mudo

      if (char === 'c') {
        if (nextChar === 'e' || nextChar === 'i') {
          allPhonemes.push('s');
        } else {
          allPhonemes.push('k');
        }
        i++;
        continue;
      }

      if (char === 'g') {
        if (nextChar === 'e' || nextChar === 'i') {
          allPhonemes.push('ʒ');
        } else {
          allPhonemes.push('ɡ');
        }
        i++;
        continue;
      }

      if (char === 'r') {
        if (i === 0) {
          allPhonemes.push('ʁ'); // R inicial forte
        } else {
          allPhonemes.push('ɾ'); // R brando
        }
        i++;
        continue;
      }

      if (char === 's') {
        allPhonemes.push('s');
        i++;
        continue;
      }

      if (char === 'l') {
        allPhonemes.push('l');
        i++;
        continue;
      }

      // Vogais e vogais nasais (com til)
      if (char === 'a') {
        allPhonemes.push(nextChar === '~' ? 'ã' : 'a');
        if (nextChar === '~') i++;
        i++;
        continue;
      }
      if (char === 'e') {
        allPhonemes.push(nextChar === '~' ? 'ẽ' : 'e');
        if (nextChar === '~') i++;
        i++;
        continue;
      }
      if (char === 'i') {
        allPhonemes.push(nextChar === '~' ? 'ĩ' : 'i');
        if (nextChar === '~') i++;
        i++;
        continue;
      }
      if (char === 'o') {
        allPhonemes.push(nextChar === '~' ? 'õ' : 'o');
        if (nextChar === '~') i++;
        i++;
        continue;
      }
      if (char === 'u') {
        allPhonemes.push(nextChar === '~' ? 'ũ' : 'u');
        if (nextChar === '~') i++;
        i++;
        continue;
      }

      // Fallback para qualquer outro caractere
      allPhonemes.push(char);
      i++;
    }
  }

  return allPhonemes;
}

/**
 * Calcula o custo de substituição entre dois fonemas (0.0 = idênticos, 1.0 = totalmente diferentes)
 */
function getPhonemeSubstitutionCost(p1: string, p2: string): number {
  if (p1 === p2) return 0.0;

  // Vogais semelhantes
  const vowels = ['a', 'e', 'i', 'o', 'u', 'ã', 'ẽ', 'ĩ', 'õ', 'ũ'];
  const isVowel1 = vowels.includes(p1);
  const isVowel2 = vowels.includes(p2);

  if (isVowel1 && isVowel2) {
    if (p1.replace('~', '') === p2.replace('~', '')) return 0.15; // Mesma vogal com/sem nasalização
    if ((p1 === 'e' && p2 === 'i') || (p1 === 'i' && p2 === 'e')) return 0.25;
    if ((p1 === 'o' && p2 === 'u') || (p1 === 'u' && p2 === 'o')) return 0.25;
    return 0.5; // Outras vogais
  }

  // Grupos articulatórios de consoantes similares (erros comuns do ASR de fala infantil)
  // Bilabiais: b, p, v, m
  const bilabials = ['b', 'p', 'v', 'm'];
  if (bilabials.includes(p1) && bilabials.includes(p2)) {
    if ((p1 === 'b' && p2 === 'p') || (p1 === 'p' && p2 === 'b')) return 0.2;
    if ((p1 === 'b' && p2 === 'v') || (p1 === 'v' && p2 === 'b')) return 0.25;
    return 0.35;
  }

  // Alveolares / Dentais: d, t, z, s, n
  const dentals = ['d', 't', 'z', 's', 'n'];
  if (dentals.includes(p1) && dentals.includes(p2)) {
    if ((p1 === 'd' && p2 === 't') || (p1 === 't' && p2 === 'd')) return 0.2;
    if ((p1 === 's' && p2 === 'z') || (p1 === 'z' && p2 === 's')) return 0.2;
    return 0.35;
  }

  // Velares: g (ɡ), k
  const velars = ['ɡ', 'k'];
  if (velars.includes(p1) && velars.includes(p2)) return 0.2;

  // Fricativas palatais/alveolares: ʃ (x), ʒ (j), s, z
  const fricatives = ['ʃ', 'ʒ', 's', 'z'];
  if (fricatives.includes(p1) && fricatives.includes(p2)) return 0.3;

  // Líquidas: l, ɾ, ʁ, ʎ
  const liquids = ['l', 'ɾ', 'ʁ', 'ʎ'];
  if (liquids.includes(p1) && liquids.includes(p2)) return 0.35;

  return 1.0;
}

/**
 * Calcula a similaridade fonética baseada em Levenshtein Ponderado (Retorna entre 0.0 e 1.0)
 */
export function calculatePhonemeSimilarity(p1: string[], p2: string[]): number {
  if (!p1.length && !p2.length) return 1.0;
  if (!p1.length || !p2.length) return 0.0;

  const m = p1.length;
  const n = p2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const subCost = getPhonemeSubstitutionCost(p1[i - 1], p2[j - 1]);
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1.0,           // Deleção
        dp[i][j - 1] + 1.0,           // Inserção
        dp[i - 1][j - 1] + subCost   // Substituição
      );
    }
  }

  const distance = dp[m][n];
  const maxLen = Math.max(m, n);
  const similarity = Math.max(0, 1.0 - distance / maxLen);

  return Number(similarity.toFixed(2));
}

export interface PhoneticMatchResult {
  matched: boolean;
  score: number;
  expectedPhonemes: string;
  spokenPhonemes: string;
  matchedWord?: string;
}

/**
 * Avalia se o texto falado corresponde à sílaba esperada usando análise de similaridade fonética
 */
export function evaluateSyllablePhonetically(
  spokenText: string,
  targetSyllable: string,
  threshold: number = 0.70
): PhoneticMatchResult {
  const normSpoken = normalizeText(spokenText);
  const normTarget = normalizeText(targetSyllable);

  if (!normSpoken || !normTarget) {
    return { matched: false, score: 0, expectedPhonemes: '', spokenPhonemes: '' };
  }

  const expectedPhonemes = textToPhonemes(normTarget);
  const expectedStr = expectedPhonemes.join(' ');

  // 1. Verificação de correspondência direta por tokens da transcrição
  const spokenTokens = normSpoken.split(/\s+/).filter(Boolean);
  let bestScore = 0;
  let bestSpokenPhonemes: string[] = [];
  let bestWord = '';

  for (const token of spokenTokens) {
    const tokenPhonemes = textToPhonemes(token);
    const score = calculatePhonemeSimilarity(expectedPhonemes, tokenPhonemes);

    if (score > bestScore) {
      bestScore = score;
      bestSpokenPhonemes = tokenPhonemes;
      bestWord = token;
    }
  }

  // 2. Verificação por janela deslizante de fonemas na frase completa
  const fullSpokenPhonemes = textToPhonemes(normSpoken);
  const targetLen = expectedPhonemes.length;

  for (let i = 0; i <= fullSpokenPhonemes.length - targetLen; i++) {
    const windowPhonemes = fullSpokenPhonemes.slice(i, i + targetLen);
    const score = calculatePhonemeSimilarity(expectedPhonemes, windowPhonemes);
    if (score > bestScore) {
      bestScore = score;
      bestSpokenPhonemes = windowPhonemes;
      bestWord = normSpoken;
    }
  }

  // 3. Verificação de soletrar (ex: "bê a -> bá")
  const letters = normTarget.split('');
  if (letters.length > 1) {
    const spellTokens = spokenTokens;
    let spelledLettersMatchCount = 0;
    for (let l = 0; l < letters.length && l < spellTokens.length; l++) {
      const letterChar = letters[l];
      const token = spellTokens[l];
      const names = LETTER_NAMES[letterChar] || [letterChar];
      if (token === letterChar || names.some((n) => normalizeText(n) === token)) {
        spelledLettersMatchCount++;
      }
    }

    // Se o usuário soletrou as letras e depois disse a sílaba (ou a sílaba foi capturada)
    if (spelledLettersMatchCount === letters.length) {
      bestScore = Math.max(bestScore, 0.95);
    }
  }

  const isMatched = bestScore >= threshold;

  return {
    matched: isMatched,
    score: bestScore,
    expectedPhonemes: expectedStr,
    spokenPhonemes: bestSpokenPhonemes.join(' '),
    matchedWord: bestWord,
  };
}

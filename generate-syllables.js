import fs from 'fs';
import path from 'path';
import { OBJETOS_COMUNS, ANIMAIS_COMUNS, NUMEROS, PAISES, PALAVRAS_BASE } from './src/database.js';

function splitPortugueseWord(word) {
	if (!word) return [];
	const w = word.toLowerCase();
	const vowels = 'aàáâãeéêiíoóôõuúü';
	const isVowel = (ch) => ch && vowels.includes(ch);

	const len = w.length;
	if (len <= 1) return [word];

	const breakPoints = new Set();

	for (let i = 0; i < len - 1; i++) {
		const c1 = w[i];
		const c2 = w[i + 1];
		const c3 = i + 2 < len ? w[i + 2] : '';
		const c4 = i + 3 < len ? w[i + 3] : '';

		const v1 = isVowel(c1);
		const v2 = isVowel(c2);
		const v3 = isVowel(c3);

		// Rule 1: Vowel + Consonant + Vowel -> split after V1 (V | CV)
		// e.g. A-LI-CA-TE, A-GU-LHA (A|LI, LI|CA, CA|TE)
		if (v1 && !v2 && v3) {
			breakPoints.add(i);
		}
		// Rule 2: Vowel + 2 Consonants + Vowel (V C2 C3 V)
		else if (v1 && !v2 && !v3 && isVowel(c4)) {
			const pair = c2 + c3;
			const inseparable = ['ch', 'lh', 'nh', 'gu', 'qu', 'bl', 'cl', 'dl', 'fl', 'gl', 'pl', 'tl', 'br', 'cr', 'dr', 'fr', 'gr', 'pr', 'tr'];
			if (inseparable.includes(pair)) {
				// Split after V1: e.g. A | GULHA
				breakPoints.add(i);
			} else {
				// Split between C2 and C3: e.g. AL | MOFADA, CAN | TO
				breakPoints.add(i + 1);
			}
		}
		// Rule 3: Digraphs or 2 Consonants between vowels
		else if (!v1 && !v2 && v3) {
			const pair = c1 + c2;
			const separating = ['rr', 'ss', 'sc', 'sç', 'xc', 'xs'];
			const inseparable = ['ch', 'lh', 'nh', 'gu', 'qu', 'bl', 'cl', 'dl', 'fl', 'gl', 'pl', 'tl', 'br', 'cr', 'dr', 'fr', 'gr', 'pr', 'tr'];
			if (separating.includes(pair) || !inseparable.includes(pair)) {
				// Split between C1 and C2
				breakPoints.add(i);
			}
		}
		// Rule 4: Hiatus (V1 V2)
		else if (v1 && v2) {
			const strong = 'aáâãeéêoóôõ';
			if (c1 === c2 || 'íú'.includes(c2) || ('íú'.includes(c1) && strong.includes(c2)) || (strong.includes(c1) && strong.includes(c2) && !'ãõ'.includes(c1))) {
				breakPoints.add(i);
			}
		}
	}

	const result = [];
	let start = 0;
	for (let i = 0; i < len; i++) {
		if (breakPoints.has(i) && i < len - 1) {
			result.push(word.substring(start, i + 1));
			start = i + 1;
		}
	}
	result.push(word.substring(start));
	return result;
}

function hyphenatePortuguese(word) {
	if (!word || typeof word !== 'string') return [];
	const orig = word.trim();
	if (orig.length === 0) return [];

	if (orig.includes(' ') || orig.includes('-')) {
		const parts = orig.split(/([ -])/);
		const result = [];
		for (const part of parts) {
			if (part === ' ' || part === '-') {
				if (result.length > 0) {
					result[result.length - 1] += part;
				} else {
					result.push(part);
				}
			} else if (part.length > 0) {
				const subSyllables = splitPortugueseWord(part);
				result.push(...subSyllables);
			}
		}
		return result;
	}

	return splitPortugueseWord(orig);
}

function processList(list) {
	return list.map((item) => {
		const wordName = typeof item === 'string' ? item : item.name;
		const syllables = hyphenatePortuguese(wordName);
		return {
			name: wordName,
			syllables: syllables,
			syllableCount: syllables.length
		};
	});
}

const objetosComuns = processList(OBJETOS_COMUNS);
const animaisComuns = processList(ANIMAIS_COMUNS);
const numeros = processList(NUMEROS);
const paises = processList(PAISES);
const palavrasBase = processList(PALAVRAS_BASE);

const content = `// Banco de dados de palavras com sílabas separadas
// Gerado automaticamente a partir de database.js

export const OBJETOS_COMUNS = ${JSON.stringify(objetosComuns, null, '\t')};

export const ANIMAIS_COMUNS = ${JSON.stringify(animaisComuns, null, '\t')};

export const NUMEROS = ${JSON.stringify(numeros, null, '\t')};

export const PAISES = ${JSON.stringify(paises, null, '\t')};

export const PALAVRAS_BASE = ${JSON.stringify(palavrasBase, null, '\t')};
`;

const outputPath = path.resolve(process.cwd(), 'src', 'syllables.js');
fs.writeFileSync(outputPath, content, 'utf8');
console.log(`Successfully generated ${outputPath}`);

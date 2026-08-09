export interface WordItem {
  name: string;
  category: string;
  icon: string;
}

export interface WordLayoutItem {
  char: string;
  isHidden: boolean;
  index: number;
}

export type MistakeStatus = 'correct' | 'incorrect';

export interface ReadingWordItem {
  name: string;
  syllables: string[];
  syllableCount: number;
  icon: string;
  category: string;
}

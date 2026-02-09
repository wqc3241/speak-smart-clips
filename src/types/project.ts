export interface VocabularyItem {
  word: string;
  definition?: string;
  meaning?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | string;
}

export interface GrammarItem {
  rule: string;
  example: string;
  explanation: string;
}

export interface PracticeSentence {
  text: string;
  translation: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  usedVocabulary: string[];
  usedGrammar: string[];
}

export interface AppProject {
  id: string | number;
  title: string;
  url: string;
  script: string;
  vocabulary: VocabularyItem[];
  grammar: GrammarItem[];
  practiceSentences: PracticeSentence[];
  detectedLanguage: string;
  status?: 'pending' | 'completed' | 'failed';
  jobId?: string;
  userId?: string;
  errorMessage?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export interface SummarySentence {
  original: string;
  corrected: string;
  translation: string;
  isCorrect: boolean;
}

export interface SummaryVocabularyItem {
  word: string;
  usedCorrectly: boolean;
  context: string;
  suggestion?: string;
}

export interface SummaryGrammarItem {
  pattern: string;
  usedCorrectly: boolean;
  example: string;
  correction?: string;
}

export interface FeedbackItem {
  category: string;
  message: string;
  severity: 'positive' | 'suggestion' | 'correction';
}

export interface ConversationSummary {
  sentencesUsed: SummarySentence[];
  vocabularyUsed: SummaryVocabularyItem[];
  grammarPatterns: SummaryGrammarItem[];
  feedback: FeedbackItem[];
  overallScore: number;
  overallComment: string;
}

export interface ConversationSession {
  id: string;
  projectId: string | number;
  projectTitle: string;
  language: string;
  messages: ConversationMessage[];
  summary: ConversationSummary | null;
  startedAt: string;
  endedAt: string;
  status: 'active' | 'completed' | 'error';
}

export interface ConversationState {
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
  messages: ConversationMessage[];
  currentTranscript: string;
  error: string | null;
}

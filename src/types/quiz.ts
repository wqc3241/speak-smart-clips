export type QuestionType =
  | 'multiple_choice'
  | 'translation'
  | 'fill_blank'
  | 'read_after_me'
  | 'tell_meaning'
  | 'multiple_select'
  | 'word_arrange'
  | 'listening'
  | 'match_pairs';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  // single-answer types (multiple_choice, translation, fill_blank, tell_meaning, listening)
  correctAnswer?: string;
  options?: string[];
  // multiple_select
  correctAnswers?: string[];
  // word_arrange
  jumbledWords?: string[];
  correctOrder?: string[];
  // match_pairs
  pairs?: { word: string; meaning: string }[];
  // read_after_me
  targetText?: string;
  targetLanguage?: string;
  // listening
  audioText?: string;
  // metadata
  originalText?: string;
  sourceWord?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface LearningUnit {
  id: string;
  projectId: string;
  unitNumber: number;
  title: string;
  description: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  questions: QuizQuestion[];
  questionCount: number;
  isCompleted: boolean;
  bestScore: number | null;
  attempts: number;
  stars: number;
  lastAttemptedAt: string | null;
}

/**
 * Filter out questions that are missing required answer data.
 * Never guess — a wrong "correct" answer is worse than no question.
 */
function filterValidQuestions(raw: unknown[]): QuizQuestion[] {
  return (raw as QuizQuestion[]).filter(q => {
    if (['multiple_choice', 'translation', 'fill_blank', 'tell_meaning', 'listening'].includes(q.type)) {
      return !!q.correctAnswer && !!q.options && q.options.length > 0 && q.options.includes(q.correctAnswer);
    }
    if (q.type === 'multiple_select') {
      return !!q.correctAnswers && q.correctAnswers.length > 0 && !!q.options && q.options.length > 0;
    }
    if (q.type === 'word_arrange') {
      return !!q.jumbledWords && !!q.correctOrder && q.correctOrder.length > 0;
    }
    if (q.type === 'match_pairs') {
      return !!q.pairs && q.pairs.length > 0;
    }
    if (q.type === 'read_after_me') {
      return !!q.targetText;
    }
    return true;
  });
}

export function mapDbUnitToLearningUnit(row: Record<string, unknown>): LearningUnit {
  const rawQuestions = Array.isArray(row.questions) ? row.questions : [];
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    unitNumber: row.unit_number as number,
    title: row.title as string,
    description: (row.description as string) ?? null,
    difficulty: row.difficulty as 'beginner' | 'intermediate' | 'advanced',
    questions: filterValidQuestions(rawQuestions),
    questionCount: (row.question_count as number) ?? 0,
    isCompleted: (row.is_completed as boolean) ?? false,
    bestScore: (row.best_score as number) ?? null,
    attempts: (row.attempts as number) ?? 0,
    stars: (row.stars as number) ?? 0,
    lastAttemptedAt: (row.last_attempted_at as string) ?? null,
  };
}

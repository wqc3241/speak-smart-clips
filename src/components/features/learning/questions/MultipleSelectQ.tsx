import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuizQuestion } from '@/types/quiz';

interface Props {
  question: QuizQuestion;
  onAnswer: (isCorrect: boolean) => void;
}

export const MultipleSelectQ: React.FC<Props> = ({ question, onAnswer }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showResult, setShowResult] = useState(false);

  const correctSet = new Set(question.correctAnswers || []);
  const isCorrect = selected.size === correctSet.size && [...selected].every(s => correctSet.has(s));

  const toggleOption = (option: string) => {
    if (showResult) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(option)) {
        next.delete(option);
      } else {
        next.add(option);
      }
      return next;
    });
  };

  const handleCheck = () => {
    setShowResult(true);
    onAnswer(isCorrect);
  };

  return (
    <div>
      <h3 className="text-xl font-semibold text-center mb-2">{question.question}</h3>
      <p className="text-sm text-muted-foreground text-center mb-6">Select all correct answers</p>

      <div className="grid gap-3">
        {(question.options || []).map((option, index) => {
          const isSelected = selected.has(option);
          const isCorrectOption = correctSet.has(option);

          return (
            <button
              key={index}
              className={cn(
                'flex items-center gap-3 w-full p-4 rounded-lg border-2 text-left transition-all',
                showResult && isCorrectOption && 'border-green-500 bg-green-50 dark:bg-green-950/30',
                showResult && isSelected && !isCorrectOption && 'border-destructive bg-destructive/10',
                !showResult && isSelected && 'border-primary bg-primary/5',
                !showResult && !isSelected && 'border-border hover:border-primary/50'
              )}
              onClick={() => toggleOption(option)}
              disabled={showResult}
            >
              <div className={cn(
                'w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
              )}>
                {isSelected && <Check className="w-4 h-4" />}
              </div>
              <span className="flex-1 min-w-0 break-words">{option}</span>
              {showResult && isCorrectOption && <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />}
              {showResult && isSelected && !isCorrectOption && <XCircle className="w-5 h-5 text-destructive shrink-0" />}
            </button>
          );
        })}
      </div>

      {!showResult && (
        <Button onClick={handleCheck} disabled={selected.size === 0} className="w-full mt-4">
          Check Answer
        </Button>
      )}

      {showResult && (
        <div className={cn('mt-6 p-4 rounded-lg text-center animate-fade-in', isCorrect ? 'bg-green-100 dark:bg-green-950/50' : 'bg-destructive/10')}>
          <p className={cn('font-semibold', isCorrect ? 'text-green-700 dark:text-green-400' : 'text-destructive')}>
            {isCorrect ? 'All correct!' : 'Not all answers were correct'}
          </p>
          {!isCorrect && (
            <p className="text-sm text-muted-foreground mt-1">
              Correct answers: {[...correctSet].join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

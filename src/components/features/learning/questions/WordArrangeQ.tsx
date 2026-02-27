import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuizQuestion } from '@/types/quiz';

interface Props {
  question: QuizQuestion;
  onAnswer: (isCorrect: boolean) => void;
}

export const WordArrangeQ: React.FC<Props> = ({ question, onAnswer }) => {
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>(question.jumbledWords || []);
  const [showResult, setShowResult] = useState(false);

  const correctOrder = question.correctOrder || [];
  const isCorrect = selectedWords.length === correctOrder.length &&
    selectedWords.every((w, i) => w === correctOrder[i]);

  const handleSelectWord = (word: string, index: number) => {
    if (showResult) return;
    setSelectedWords(prev => [...prev, word]);
    setAvailableWords(prev => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const handleRemoveWord = (index: number) => {
    if (showResult) return;
    const word = selectedWords[index];
    setSelectedWords(prev => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    setAvailableWords(prev => [...prev, word]);
  };

  const handleReset = () => {
    setSelectedWords([]);
    setAvailableWords(question.jumbledWords || []);
  };

  const handleCheck = () => {
    setShowResult(true);
    onAnswer(isCorrect);
  };

  return (
    <div>
      <h3 className="text-xl font-semibold text-center mb-6">{question.question}</h3>

      {/* Built sentence area */}
      <div className="min-h-[60px] p-3 mb-4 border-2 border-dashed border-primary/30 rounded-lg flex flex-wrap gap-2 items-center">
        {selectedWords.length === 0 && (
          <p className="text-sm text-muted-foreground">Tap words to build the sentence...</p>
        )}
        {selectedWords.map((word, index) => (
          <button
            key={`selected-${index}`}
            onClick={() => handleRemoveWord(index)}
            disabled={showResult}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              showResult && isCorrect && 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
              showResult && !isCorrect && 'bg-destructive/10 text-destructive',
              !showResult && 'bg-primary text-primary-foreground hover:bg-primary/80'
            )}
          >
            {word}
          </button>
        ))}
      </div>

      {/* Available words */}
      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {availableWords.map((word, index) => (
          <button
            key={`avail-${index}`}
            onClick={() => handleSelectWord(word, index)}
            disabled={showResult}
            className="px-3 py-1.5 rounded-lg border-2 border-border bg-card text-sm font-medium hover:border-primary hover:bg-primary/5 transition-all"
          >
            {word}
          </button>
        ))}
      </div>

      {/* Actions */}
      {!showResult && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={selectedWords.length === 0} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
          <Button
            onClick={handleCheck}
            disabled={availableWords.length > 0}
            className="flex-1"
          >
            Check
          </Button>
        </div>
      )}

      {showResult && (
        <div className={cn('mt-4 p-4 rounded-lg text-center animate-fade-in', isCorrect ? 'bg-green-100 dark:bg-green-950/50' : 'bg-destructive/10')}>
          <p className={cn('font-semibold', isCorrect ? 'text-green-700 dark:text-green-400' : 'text-destructive')}>
            {isCorrect ? 'Perfect arrangement!' : 'Not quite right'}
          </p>
          {!isCorrect && (
            <p className="text-sm text-muted-foreground mt-1">
              Correct order: {correctOrder.join(' ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

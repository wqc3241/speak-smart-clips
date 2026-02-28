import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import type { QuizQuestion } from '@/types/quiz';

interface Props {
  question: QuizQuestion;
  onAnswer: (isCorrect: boolean) => void;
  language?: string;
}

export const ListeningQ: React.FC<Props> = ({ question, onAnswer, language }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  const { speak, isPlaying, stop } = useTextToSpeech();

  const isCorrect = selected === question.correctAnswer;
  const audioText = question.audioText || question.correctAnswer || '';
  const lang = language || 'English';

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      stop();
      return;
    }
    speak(audioText, 'coral', `Speak clearly and naturally in ${lang}, at a moderate pace suitable for language learners.`);
    setHasPlayed(true);
  }, [audioText, lang, isPlaying, speak, stop]);

  const handleSelect = (option: string) => {
    if (showResult) return;
    setSelected(option);
    setShowResult(true);
    onAnswer(option === question.correctAnswer);
  };

  return (
    <div>
      <h3 className="text-xl font-semibold text-center mb-6">{question.question}</h3>

      {/* Play button */}
      <div className="flex justify-center mb-6">
        <Button
          onClick={handlePlay}
          variant="outline"
          size="lg"
          className="rounded-full w-20 h-20 border-2 border-primary hover:bg-primary/10"
        >
          {isPlaying ? <Loader2 className="w-8 h-8 text-primary animate-spin" /> : <Volume2 className="w-8 h-8 text-primary" />}
        </Button>
      </div>

      {!hasPlayed && (
        <p className="text-sm text-muted-foreground text-center mb-4">Tap to listen</p>
      )}

      {/* Options */}
      <div className="grid gap-3">
        {(question.options || []).map((option, index) => {
          const isSelected = selected === option;
          const isCorrectOption = option === question.correctAnswer;

          return (
            <Button
              key={index}
              variant="outline"
              className={cn(
                'h-auto py-4 px-4 text-left justify-start text-base font-normal whitespace-normal break-words w-full',
                showResult && isCorrectOption && 'border-green-500 bg-green-50 dark:bg-green-950/30',
                showResult && isSelected && !isCorrectOption && 'border-destructive bg-destructive/10',
                !showResult && 'hover:border-primary hover:bg-primary/5'
              )}
              onClick={() => handleSelect(option)}
              disabled={showResult}
            >
              <div className="flex items-center gap-3 w-full min-w-0">
                <span className="flex-1 min-w-0 break-words">{option}</span>
                {showResult && isCorrectOption && <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />}
                {showResult && isSelected && !isCorrectOption && <XCircle className="w-5 h-5 text-destructive shrink-0" />}
              </div>
            </Button>
          );
        })}
      </div>

      {showResult && (
        <div className={cn('mt-6 p-4 rounded-lg text-center animate-fade-in', isCorrect ? 'bg-green-100 dark:bg-green-950/50' : 'bg-destructive/10')}>
          <p className={cn('font-semibold', isCorrect ? 'text-green-700 dark:text-green-400' : 'text-destructive')}>
            {isCorrect ? 'Correct!' : 'Not quite right'}
          </p>
          {!isCorrect && (
            <p className="text-sm text-muted-foreground mt-1">
              The answer is: <strong>{question.correctAnswer}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

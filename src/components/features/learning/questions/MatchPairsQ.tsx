import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { QuizQuestion } from '@/types/quiz';

interface Props {
  question: QuizQuestion;
  onAnswer: (isCorrect: boolean) => void;
}

export const MatchPairsQ: React.FC<Props> = ({ question, onAnswer }) => {
  const pairs = question.pairs || [];
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<{ word: string; meaning: string } | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [mistakes, setMistakes] = useState(0);

  // Shuffle meanings once
  const shuffledMeanings = useMemo(
    () => [...pairs].sort(() => Math.random() - 0.5).map(p => p.meaning),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question.id]
  );

  const pairMap = useMemo(
    () => new Map(pairs.map(p => [p.word, p.meaning])),
    [pairs]
  );

  const handleWordClick = (word: string) => {
    if (matchedPairs.has(word) || isComplete) return;
    setSelectedWord(word === selectedWord ? null : word);
    setWrongPair(null);
  };

  const handleMeaningClick = (meaning: string) => {
    if (!selectedWord || isComplete) return;
    // Check if this meaning is already matched
    if ([...matchedPairs].some(w => pairMap.get(w) === meaning)) return;

    const correctMeaning = pairMap.get(selectedWord);

    if (correctMeaning === meaning) {
      const newMatched = new Set(matchedPairs);
      newMatched.add(selectedWord);
      setMatchedPairs(newMatched);
      setSelectedWord(null);
      setWrongPair(null);

      // Check if all matched
      if (newMatched.size === pairs.length) {
        setIsComplete(true);
        onAnswer(mistakes === 0);
      }
    } else {
      setWrongPair({ word: selectedWord, meaning });
      setMistakes(prev => prev + 1);
      // Clear wrong highlight after a moment
      setTimeout(() => {
        setWrongPair(null);
        setSelectedWord(null);
      }, 800);
    }
  };

  return (
    <div>
      <h3 className="text-xl font-semibold text-center mb-2">{question.question}</h3>
      <p className="text-sm text-muted-foreground text-center mb-6">Match each word with its meaning</p>

      <div className="grid grid-cols-2 gap-4">
        {/* Words column */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Words</p>
          {pairs.map(pair => {
            const isMatched = matchedPairs.has(pair.word);
            const isSelected = selectedWord === pair.word;
            const isWrong = wrongPair?.word === pair.word;

            return (
              <button
                key={pair.word}
                onClick={() => handleWordClick(pair.word)}
                disabled={isMatched}
                className={cn(
                  'w-full p-3 rounded-lg border-2 text-sm font-medium text-left transition-all',
                  isMatched && 'border-green-500 bg-green-50 dark:bg-green-950/30 opacity-70',
                  isSelected && !isMatched && 'border-primary bg-primary/10',
                  isWrong && 'border-destructive bg-destructive/10 animate-shake',
                  !isMatched && !isSelected && !isWrong && 'border-border hover:border-primary/50'
                )}
              >
                {pair.word}
              </button>
            );
          })}
        </div>

        {/* Meanings column */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Meanings</p>
          {shuffledMeanings.map(meaning => {
            const isMatched = [...matchedPairs].some(w => pairMap.get(w) === meaning);
            const isWrong = wrongPair?.meaning === meaning;

            return (
              <button
                key={meaning}
                onClick={() => handleMeaningClick(meaning)}
                disabled={isMatched}
                className={cn(
                  'w-full p-3 rounded-lg border-2 text-sm font-medium text-left transition-all',
                  isMatched && 'border-green-500 bg-green-50 dark:bg-green-950/30 opacity-70',
                  isWrong && 'border-destructive bg-destructive/10 animate-shake',
                  !isMatched && !isWrong && 'border-border hover:border-primary/50',
                  selectedWord && !isMatched && 'hover:border-primary hover:bg-primary/5'
                )}
              >
                {meaning}
              </button>
            );
          })}
        </div>
      </div>

      {isComplete && (
        <div className={cn(
          'mt-6 p-4 rounded-lg text-center animate-fade-in',
          mistakes === 0 ? 'bg-green-100 dark:bg-green-950/50' : 'bg-yellow-100 dark:bg-yellow-950/50'
        )}>
          <p className={cn('font-semibold', mistakes === 0 ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400')}>
            {mistakes === 0 ? 'Perfect matching!' : `Completed with ${mistakes} mistake${mistakes > 1 ? 's' : ''}`}
          </p>
        </div>
      )}
    </div>
  );
};

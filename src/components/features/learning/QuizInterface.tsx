import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { X, Heart, Trophy, RotateCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { QuizQuestion, LearningUnit } from '@/types/quiz';
import { mapDbUnitToLearningUnit } from '@/types/quiz';

import { MultipleChoiceQ } from './questions/MultipleChoiceQ';
import { TranslationQ } from './questions/TranslationQ';
import { FillBlankQ } from './questions/FillBlankQ';
import { ReadAfterMeQ } from './questions/ReadAfterMeQ';
import { MultipleSelectQ } from './questions/MultipleSelectQ';
import { WordArrangeQ } from './questions/WordArrangeQ';
import { ListeningQ } from './questions/ListeningQ';
import { MatchPairsQ } from './questions/MatchPairsQ';

interface QuizInterfaceProps {
  unitId: string;
  onComplete: (score: number, stars: number) => void;
  onExit: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple Choice',
  translation: 'Translation',
  fill_blank: 'Fill in the Blank',
  read_after_me: 'Read After Me',
  tell_meaning: 'Tell the Meaning',
  multiple_select: 'Select All',
  word_arrange: 'Arrange Words',
  listening: 'Listening',
  match_pairs: 'Match Pairs',
};

export const QuizInterface: React.FC<QuizInterfaceProps> = ({
  unitId,
  onComplete,
  onExit,
}) => {
  const { user } = useAuth();
  const [unit, setUnit] = useState<LearningUnit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [language, setLanguage] = useState<string>('');

  // Fetch unit questions from DB
  useEffect(() => {
    const fetchUnit = async () => {
      if (!user) return;
      setIsLoading(true);

      try {
        const { data, error } = await supabase
          .from('learning_units')
          .select('*')
          .eq('id', unitId)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        const mapped = mapDbUnitToLearningUnit(data as unknown as Record<string, unknown>);
        setUnit(mapped);

        // Get the project's language
        const { data: project } = await supabase
          .from('projects')
          .select('detected_language')
          .eq('id', mapped.projectId)
          .single();

        if (project?.detected_language) {
          setLanguage(project.detected_language);
        }
      } catch (error) {
        console.error('Error fetching unit:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnit();
  }, [unitId, user]);

  const questions = unit?.questions || [];
  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const handleAnswer = useCallback((isCorrect: boolean) => {
    setAnswered(true);
    if (isCorrect) {
      setScore(prev => prev + 1);
    } else {
      setHearts(prev => prev - 1);
    }
  }, []);

  const handleContinue = () => {
    if (hearts === 0 || currentIndex === questions.length - 1) {
      setIsComplete(true);
      return;
    }
    setCurrentIndex(prev => prev + 1);
    setAnswered(false);
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setHearts(3);
    setScore(0);
    setAnswered(false);
    setIsComplete(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <p className="text-muted-foreground mb-4">
            No questions available for this unit.
          </p>
          <Button onClick={onExit}>Go Back</Button>
        </CardContent>
      </Card>
    );
  }

  if (isComplete) {
    const percentage = Math.round((score / questions.length) * 100);
    const stars = percentage >= 90 ? 3 : percentage >= 70 ? 2 : percentage >= 60 ? 1 : 0;

    return (
      <Card className="overflow-hidden">
        <CardContent className="py-12 text-center">
          <div className="mb-6">
            <Trophy className="w-16 h-16 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {hearts > 0 ? 'Lesson Complete!' : 'Out of Hearts'}
            </h2>
            <p className="text-muted-foreground">
              {hearts > 0
                ? `You scored ${score} out of ${questions.length}`
                : 'Keep practicing to improve!'}
            </p>
          </div>

          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3].map((star) => (
              <div
                key={star}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                  star <= stars
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                ★
              </div>
            ))}
          </div>

          <div className="bg-muted rounded-lg p-4 mb-6 inline-block">
            <div className="text-3xl font-bold text-primary">{percentage}%</div>
            <div className="text-sm text-muted-foreground">Accuracy</div>
          </div>

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => onComplete(percentage, stars)}>
              Done
            </Button>
            <Button onClick={handleRetry} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderQuestion = (q: QuizQuestion) => {
    // Use a key that changes when the question changes to reset sub-component state
    const key = `${q.id}-${currentIndex}`;

    switch (q.type) {
      case 'multiple_choice':
      case 'tell_meaning':
        return <MultipleChoiceQ key={key} question={q} onAnswer={handleAnswer} />;
      case 'translation':
        return <TranslationQ key={key} question={q} onAnswer={handleAnswer} />;
      case 'fill_blank':
        return <FillBlankQ key={key} question={q} onAnswer={handleAnswer} />;
      case 'read_after_me':
        return <ReadAfterMeQ key={key} question={q} onAnswer={handleAnswer} language={language} />;
      case 'multiple_select':
        return <MultipleSelectQ key={key} question={q} onAnswer={handleAnswer} />;
      case 'word_arrange':
        return <WordArrangeQ key={key} question={q} onAnswer={handleAnswer} />;
      case 'listening':
        return <ListeningQ key={key} question={q} onAnswer={handleAnswer} language={language} />;
      case 'match_pairs':
        return <MatchPairsQ key={key} question={q} onAnswer={handleAnswer} />;
      default:
        return <MultipleChoiceQ key={key} question={q} onAnswer={handleAnswer} />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={onExit}>
          <X className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Heart
              key={i}
              className={cn(
                'w-6 h-6 transition-all',
                i < hearts
                  ? 'text-red-500 fill-red-500'
                  : 'text-muted-foreground/30'
              )}
            />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-2" />

      {/* Question card */}
      <Card className="border-2">
        <CardContent className="py-8 px-6">
          {/* Question type badge */}
          <div className="mb-4">
            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
              {TYPE_LABELS[currentQuestion.type] || currentQuestion.type}
            </span>
          </div>

          {renderQuestion(currentQuestion)}
        </CardContent>
      </Card>

      {/* Continue button */}
      {answered && (
        <Button onClick={handleContinue} className="w-full h-12 text-base">
          {hearts === 0 || currentIndex === questions.length - 1 ? 'See Results' : 'Continue'}
        </Button>
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Play, CheckCircle2, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useLearningUnits } from '@/hooks/useLearningUnits';
import { QuizInterface } from './QuizInterface';
import type { LearningUnit } from '@/types/quiz';

export const LearningPath: React.FC = () => {
  const { units, isLoading, isGenerating, updateUnitProgress, refresh } = useLearningUnits();
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);

  // Group units by projectId
  const groupedUnits = useMemo(() => {
    const groups: { projectId: string; units: LearningUnit[] }[] = [];
    const map = new Map<string, LearningUnit[]>();

    for (const unit of units) {
      const existing = map.get(unit.projectId);
      if (existing) {
        existing.push(unit);
      } else {
        const arr = [unit];
        map.set(unit.projectId, arr);
        groups.push({ projectId: unit.projectId, units: arr });
      }
    }

    return groups;
  }, [units]);

  const handleQuizComplete = async (score: number, stars: number) => {
    if (activeQuizId) {
      await updateUnitProgress(activeQuizId, score, stars);
    }
    setActiveQuizId(null);
    // Refresh to show updated progress
    refresh();
  };

  // Show quiz if active
  if (activeQuizId) {
    return (
      <QuizInterface
        unitId={activeQuizId}
        onComplete={handleQuizComplete}
        onExit={() => setActiveQuizId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (isGenerating) {
    return (
      <Card className="border-dashed border-2 bg-muted/20">
        <CardContent className="py-12 text-center">
          <Loader2 className="w-12 h-12 mx-auto text-primary mb-4 animate-spin" />
          <h3 className="text-lg font-semibold mb-2">Generating Learning Units...</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Creating personalized quiz units from your video content. This may take a moment.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (units.length === 0) {
    return (
      <Card className="border-dashed border-2 bg-muted/20">
        <CardContent className="py-12 text-center">
          <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Start Your Learning Journey</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Search for a YouTube video and create a project. Learning units will be
            automatically generated from your video content!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-semibold">Learning Path</h2>
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {units.length} units
        </span>
      </div>

      {groupedUnits.map(group => (
        <div key={group.projectId} className="space-y-4">
          <div className="relative">
            {group.units.length > 1 && (
              <div className="absolute left-6 top-16 bottom-16 w-0.5 bg-border" />
            )}

            <div className="space-y-4">
              {group.units.map((unit, index) => {
                const isFirst = index === 0;
                const prevCompleted = index > 0 ? group.units[index - 1].isCompleted : true;
                const isUnlocked = isFirst || prevCompleted;

                return (
                  <UnitCard
                    key={unit.id}
                    unit={unit}
                    index={index}
                    isUnlocked={isUnlocked}
                    onStart={() => setActiveQuizId(unit.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

interface UnitCardProps {
  unit: LearningUnit;
  index: number;
  isUnlocked: boolean;
  onStart: () => void;
}

const UnitCard: React.FC<UnitCardProps> = ({ unit, index, isUnlocked, onStart }) => {
  const difficultyColors: Record<string, string> = {
    beginner: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  };

  return (
    <Card
      className={cn(
        'relative transition-all duration-200',
        isUnlocked
          ? 'border-primary/20 hover:border-primary/40 hover:shadow-md'
          : 'border-border bg-muted/30 opacity-60',
        unit.isCompleted && 'border-green-500/30 bg-green-50/30 dark:bg-green-950/10'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 shrink-0',
              unit.isCompleted
                ? 'bg-green-600 border-green-600 text-white dark:bg-green-500 dark:border-green-500'
                : isUnlocked
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'bg-muted border-border text-muted-foreground'
            )}
          >
            {unit.isCompleted ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : isUnlocked ? (
              <span className="font-bold">{unit.unitNumber}</span>
            ) : (
              <Lock className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-semibold text-base truncate">{unit.title}</h3>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-full shrink-0', difficultyColors[unit.difficulty] || '')}>
                {unit.difficulty}
              </span>
            </div>
            {unit.description && (
              <p className="text-sm text-muted-foreground truncate">{unit.description}</p>
            )}

            {isUnlocked && (
              <div className="flex items-center gap-3 mt-1.5">
                <div className="flex gap-0.5">
                  {[1, 2, 3].map(s => (
                    <span key={s} className={cn('text-sm', s <= unit.stars ? 'text-yellow-500' : 'text-muted-foreground/30')}>
                      ★
                    </span>
                  ))}
                </div>
                {unit.attempts > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {unit.attempts} attempt{unit.attempts !== 1 ? 's' : ''}
                    {unit.bestScore !== null && ` · Best: ${unit.bestScore}%`}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {unit.questionCount} questions
                </span>
              </div>
            )}
          </div>

          {isUnlocked && !unit.isCompleted && (
            <Button onClick={onStart} size="sm" className="gap-2 shrink-0">
              <Play className="w-4 h-4" />
              Start
            </Button>
          )}
          {unit.isCompleted && (
            <Button onClick={onStart} variant="outline" size="sm" className="gap-2 shrink-0">
              <RefreshCw className="w-4 h-4" />
              Practice
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

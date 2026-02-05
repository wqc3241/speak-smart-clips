 import React from 'react';
 import { Card, CardContent } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Lock, Play, CheckCircle2, Sparkles } from 'lucide-react';
 import { useQuizData } from '@/hooks/useQuizData';
 import { Skeleton } from '@/components/ui/skeleton';
 
 interface LearningPathProps {
   onStartLesson: (unitId: number) => void;
 }
 
 interface Unit {
   id: number;
   title: string;
   description: string;
   isUnlocked: boolean;
   isCompleted: boolean;
   lessonsCompleted: number;
   totalLessons: number;
 }
 
 export const LearningPath: React.FC<LearningPathProps> = ({ onStartLesson }) => {
   const { isLoading, hasProjects } = useQuizData();
 
   // Mock units for now - in a real app, this would come from user progress data
   const units: Unit[] = [
     {
       id: 1,
       title: 'Mixed Review',
       description: 'Practice vocabulary from all your videos',
       isUnlocked: hasProjects,
       isCompleted: false,
       lessonsCompleted: 0,
       totalLessons: 5,
     },
     {
       id: 2,
       title: 'Translation Challenge',
       description: 'Test your translation skills',
       isUnlocked: false,
       isCompleted: false,
       lessonsCompleted: 0,
       totalLessons: 5,
     },
     {
       id: 3,
       title: 'Speed Round',
       description: 'Quick-fire vocabulary quiz',
       isUnlocked: false,
       isCompleted: false,
       lessonsCompleted: 0,
       totalLessons: 5,
     },
   ];
 
   if (isLoading) {
     return (
       <div className="space-y-4">
         <Skeleton className="h-32 w-full rounded-xl" />
         <Skeleton className="h-32 w-full rounded-xl" />
         <Skeleton className="h-32 w-full rounded-xl" />
       </div>
     );
   }
 
   if (!hasProjects) {
     return (
       <Card className="border-dashed border-2 bg-muted/20">
         <CardContent className="py-12 text-center">
           <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
           <h3 className="text-lg font-semibold mb-2">Start Your Learning Journey</h3>
           <p className="text-muted-foreground text-sm max-w-sm mx-auto">
             Add a YouTube video above to generate vocabulary and practice questions. 
             Then come back here to test your knowledge!
           </p>
         </CardContent>
       </Card>
     );
   }
 
   return (
     <div className="space-y-4">
       <div className="flex items-center gap-2 mb-2">
         <h2 className="text-lg font-semibold">Learning Path</h2>
         <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
           10 questions per lesson
         </span>
       </div>
 
       {/* Vertical path with connected nodes */}
       <div className="relative">
         {/* Connecting line */}
         <div className="absolute left-6 top-16 bottom-16 w-0.5 bg-border" />
 
         <div className="space-y-4">
           {units.map((unit, index) => (
             <UnitCard
               key={unit.id}
               unit={unit}
               index={index}
               onStart={() => onStartLesson(unit.id)}
             />
           ))}
         </div>
       </div>
     </div>
   );
 };
 
 interface UnitCardProps {
   unit: Unit;
   index: number;
   onStart: () => void;
 }
 
 const UnitCard: React.FC<UnitCardProps> = ({ unit, index, onStart }) => {
   const isActive = unit.isUnlocked && !unit.isCompleted;
 
   return (
     <Card
       className={`relative transition-all duration-200 ${
         unit.isUnlocked
           ? 'border-primary/20 hover:border-primary/40 hover:shadow-md'
           : 'border-border bg-muted/30 opacity-60'
       } ${unit.isCompleted ? 'border-green-500/30 bg-green-50/30 dark:bg-green-950/10' : ''}`}
     >
       <CardContent className="p-4">
         <div className="flex items-center gap-4">
           {/* Unit indicator circle */}
           <div
             className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${
               unit.isCompleted
                 ? 'bg-green-600 border-green-600 text-white dark:bg-green-500 dark:border-green-500'
                 : unit.isUnlocked
                 ? 'bg-primary border-primary text-primary-foreground'
                 : 'bg-muted border-border text-muted-foreground'
             }`}
           >
             {unit.isCompleted ? (
               <CheckCircle2 className="w-6 h-6" />
             ) : unit.isUnlocked ? (
               <span className="font-bold">{index + 1}</span>
             ) : (
               <Lock className="w-5 h-5" />
             )}
           </div>
 
           {/* Unit info */}
           <div className="flex-1 min-w-0">
             <h3 className="font-semibold text-base">{unit.title}</h3>
             <p className="text-sm text-muted-foreground truncate">{unit.description}</p>
 
             {/* Progress dots */}
             {unit.isUnlocked && (
               <div className="flex gap-1.5 mt-2">
                 {Array.from({ length: unit.totalLessons }).map((_, i) => (
                   <div
                     key={i}
                     className={`w-2 h-2 rounded-full ${
                       i < unit.lessonsCompleted
                         ? 'bg-primary'
                         : 'bg-muted-foreground/20'
                     }`}
                   />
                 ))}
               </div>
             )}
           </div>
 
           {/* Action button */}
           {unit.isUnlocked && !unit.isCompleted && (
             <Button
               onClick={onStart}
               size="sm"
               className="gap-2 shrink-0"
             >
               <Play className="w-4 h-4" />
               Start
             </Button>
           )}
           {unit.isCompleted && (
             <Button
               onClick={onStart}
               variant="outline"
               size="sm"
               className="gap-2 shrink-0"
             >
               Practice
             </Button>
           )}
         </div>
       </CardContent>
     </Card>
   );
 };
 import React, { useState, useEffect } from 'react';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent } from '@/components/ui/card';
 import { Progress } from '@/components/ui/progress';
 import { X, Heart, CheckCircle2, XCircle, Trophy, RotateCcw } from 'lucide-react';
 import { useQuizData, QuizQuestion } from '@/hooks/useQuizData';
 import { Skeleton } from '@/components/ui/skeleton';
 import { cn } from '@/lib/utils';
 
 interface QuizInterfaceProps {
   unitId: number;
   onComplete: () => void;
   onExit: () => void;
 }
 
 export const QuizInterface: React.FC<QuizInterfaceProps> = ({
   unitId,
   onComplete,
   onExit,
 }) => {
   const { questions, isLoading, regenerate } = useQuizData();
   const [currentIndex, setCurrentIndex] = useState(0);
   const [hearts, setHearts] = useState(3);
   const [score, setScore] = useState(0);
   const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
   const [showResult, setShowResult] = useState(false);
   const [isCorrect, setIsCorrect] = useState(false);
   const [isComplete, setIsComplete] = useState(false);
 
   const currentQuestion = questions[currentIndex];
   const progress = ((currentIndex + 1) / questions.length) * 100;
 
   useEffect(() => {
     // Regenerate questions when starting a new quiz
     regenerate();
   }, [unitId]);
 
   const handleAnswer = (answer: string) => {
     if (showResult) return;
 
     setSelectedAnswer(answer);
     const correct = answer === currentQuestion.correctAnswer;
     setIsCorrect(correct);
     setShowResult(true);
 
     if (correct) {
       setScore((prev) => prev + 1);
     } else {
       setHearts((prev) => prev - 1);
     }
   };
 
   const handleContinue = () => {
     if (hearts === 0 || currentIndex === questions.length - 1) {
       setIsComplete(true);
       return;
     }
 
     setCurrentIndex((prev) => prev + 1);
     setSelectedAnswer(null);
     setShowResult(false);
   };
 
   const handleRetry = () => {
     regenerate();
     setCurrentIndex(0);
     setHearts(3);
     setScore(0);
     setSelectedAnswer(null);
     setShowResult(false);
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
             Not enough content to generate a quiz. Add more videos first!
           </p>
           <Button onClick={onExit}>Go Back</Button>
         </CardContent>
       </Card>
     );
   }
 
   if (isComplete) {
     const percentage = Math.round((score / questions.length) * 100);
     const stars = hearts === 3 ? 3 : hearts === 2 ? 2 : hearts >= 1 ? 1 : 0;
 
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
 
           {/* Star rating */}
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
 
           {/* Score display */}
           <div className="bg-muted rounded-lg p-4 mb-6 inline-block">
             <div className="text-3xl font-bold text-primary">{percentage}%</div>
             <div className="text-sm text-muted-foreground">Accuracy</div>
           </div>
 
           <div className="flex gap-3 justify-center">
             <Button variant="outline" onClick={onComplete}>
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
               {currentQuestion.type === 'multiple_choice'
                 ? 'Multiple Choice'
                 : currentQuestion.type === 'translation'
                 ? 'Translation'
                 : 'Fill in the Blank'}
             </span>
           </div>
 
           {/* Original text display for translation */}
           {currentQuestion.originalText && (
             <div className="mb-4 p-3 bg-muted rounded-lg">
               <p className="text-lg font-medium text-center">
                 {currentQuestion.originalText}
               </p>
             </div>
           )}
 
           {/* Question */}
           <h3 className="text-xl font-semibold text-center mb-6">
             {currentQuestion.question}
           </h3>
 
           {/* Options */}
           <div className="grid gap-3">
             {currentQuestion.options.map((option, index) => {
               const isSelected = selectedAnswer === option;
               const isCorrectOption = option === currentQuestion.correctAnswer;
 
               return (
                 <Button
                   key={index}
                   variant="outline"
                   className={cn(
                     'h-auto py-4 px-4 text-left justify-start text-base font-normal transition-all',
                     showResult && isCorrectOption && 'border-green-500 bg-green-50 dark:bg-green-950/30',
                     showResult && isSelected && !isCorrectOption && 'border-destructive bg-destructive/10',
                     !showResult && 'hover:border-primary hover:bg-primary/5'
                   )}
                   onClick={() => handleAnswer(option)}
                   disabled={showResult}
                 >
                   <div className="flex items-center gap-3 w-full">
                     <span className="flex-1">{option}</span>
                     {showResult && isCorrectOption && (
                       <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                     )}
                     {showResult && isSelected && !isCorrectOption && (
                       <XCircle className="w-5 h-5 text-destructive shrink-0" />
                     )}
                   </div>
                 </Button>
               );
             })}
           </div>
 
           {/* Result feedback */}
           {showResult && (
             <div
               className={cn(
                 'mt-6 p-4 rounded-lg text-center animate-fade-in',
                 isCorrect ? 'bg-green-100 dark:bg-green-950/50' : 'bg-destructive/10'
               )}
             >
               <p className={cn('font-semibold', isCorrect ? 'text-green-700 dark:text-green-400' : 'text-destructive')}>
                 {isCorrect ? 'Correct! 🎉' : 'Not quite right'}
               </p>
               {!isCorrect && (
                 <p className="text-sm text-muted-foreground mt-1">
                   The answer is: <strong>{currentQuestion.correctAnswer}</strong>
                 </p>
               )}
             </div>
           )}
         </CardContent>
       </Card>
 
       {/* Continue button */}
       {showResult && (
         <Button onClick={handleContinue} className="w-full h-12 text-base">
           {hearts === 0 || currentIndex === questions.length - 1 ? 'See Results' : 'Continue'}
         </Button>
       )}
     </div>
   );
 };
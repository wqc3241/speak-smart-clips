 import { useState, useEffect } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from './useAuth';
 
 export interface QuizQuestion {
   id: string;
   type: 'multiple_choice' | 'translation' | 'fill_blank';
   question: string;
   correctAnswer: string;
   options: string[];
   sourceProject?: string;
   originalText?: string;
 }
 
 interface VocabularyItem {
   word: string;
   reading?: string;
  meaning?: string;
  definition?: string;
   partOfSpeech?: string;
 }
 
 interface PracticeSentence {
   japanese?: string;
   original?: string;
  text?: string;
   english?: string;
   translation?: string;
   romanization?: string;
 }
 
// Helper to get meaning from either field name
const getMeaning = (v: VocabularyItem): string | undefined => v.meaning || v.definition;

 export const useQuizData = () => {
   const [questions, setQuestions] = useState<QuizQuestion[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [hasProjects, setHasProjects] = useState(false);
   const { user } = useAuth();
 
   const generateQuestions = async () => {
     if (!user) {
       setIsLoading(false);
       return;
     }
 
     try {
       const { data: projects, error } = await supabase
         .from('projects')
         .select('vocabulary, practice_sentences, title')
         .eq('user_id', user.id)
         .eq('status', 'completed');
 
       if (error) throw error;
 
       if (!projects || projects.length === 0) {
         setHasProjects(false);
         setIsLoading(false);
         return;
       }
 
       setHasProjects(true);
 
       // Collect all vocabulary and sentences
       const allVocabulary: { item: VocabularyItem; project: string }[] = [];
       const allSentences: { item: PracticeSentence; project: string }[] = [];
 
       projects.forEach((project) => {
         const vocab = project.vocabulary as unknown as VocabularyItem[] | null;
         const sentences = project.practice_sentences as unknown as PracticeSentence[] | null;
 
         if (vocab && Array.isArray(vocab)) {
           vocab.forEach((v) => allVocabulary.push({ item: v, project: project.title }));
         }
         if (sentences && Array.isArray(sentences)) {
           sentences.forEach((s) => allSentences.push({ item: s, project: project.title }));
         }
       });
 
       const generatedQuestions: QuizQuestion[] = [];
 
       // Generate multiple choice questions from vocabulary
       const shuffledVocab = [...allVocabulary].sort(() => Math.random() - 0.5);
       for (let i = 0; i < Math.min(5, shuffledVocab.length); i++) {
         const vocab = shuffledVocab[i];
          const meaning = getMeaning(vocab.item);
          if (!vocab.item.word || !meaning) continue;
 
         // Get 3 wrong answers from other vocabulary
         const wrongAnswers = allVocabulary
            .filter((v) => getMeaning(v.item) !== meaning)
           .sort(() => Math.random() - 0.5)
           .slice(0, 3)
            .map((v) => getMeaning(v.item)!);
 
         if (wrongAnswers.length < 3) continue;
 
          const options = [...wrongAnswers, meaning].sort(() => Math.random() - 0.5);
 
         generatedQuestions.push({
           id: `vocab-${i}`,
           type: 'multiple_choice',
           question: `What does "${vocab.item.word}" mean?`,
            correctAnswer: meaning,
           options,
           sourceProject: vocab.project,
           originalText: vocab.item.word,
         });
       }
 
       // Generate translation questions from practice sentences
       const shuffledSentences = [...allSentences].sort(() => Math.random() - 0.5);
       for (let i = 0; i < Math.min(3, shuffledSentences.length); i++) {
         const sentence = shuffledSentences[i];
          const original = sentence.item.japanese || sentence.item.original || sentence.item.text;
         const translation = sentence.item.english || sentence.item.translation;
 
         if (!original || !translation) continue;
 
         // Get wrong translations
         const wrongTranslations = allSentences
           .filter((s) => {
             const t = s.item.english || s.item.translation;
             return t && t !== translation;
           })
           .sort(() => Math.random() - 0.5)
           .slice(0, 3)
           .map((s) => s.item.english || s.item.translation || '');
 
         if (wrongTranslations.length < 3) continue;
 
         const options = [...wrongTranslations, translation].sort(() => Math.random() - 0.5);
 
         generatedQuestions.push({
           id: `trans-${i}`,
           type: 'translation',
           question: `What is the correct translation?`,
           correctAnswer: translation,
           options,
           sourceProject: sentence.project,
           originalText: original,
         });
       }
 
       // Generate fill-in-blank questions
       for (let i = 0; i < Math.min(2, shuffledVocab.length); i++) {
         const vocab = shuffledVocab[shuffledVocab.length - 1 - i]; // Use different vocab
          const meaning = vocab ? getMeaning(vocab.item) : undefined;
          if (!vocab?.item.word || !meaning) continue;
 
         const wrongWords = allVocabulary
           .filter((v) => v.item.word !== vocab.item.word)
           .sort(() => Math.random() - 0.5)
           .slice(0, 3)
           .map((v) => v.item.word);
 
         if (wrongWords.length < 3) continue;
 
         const options = [...wrongWords, vocab.item.word].sort(() => Math.random() - 0.5);
 
         generatedQuestions.push({
           id: `fill-${i}`,
           type: 'fill_blank',
            question: `Which word means "${meaning}"?`,
           correctAnswer: vocab.item.word,
           options,
           sourceProject: vocab.project,
         });
       }
 
       // Shuffle and limit to 10 questions
       const finalQuestions = generatedQuestions.sort(() => Math.random() - 0.5).slice(0, 10);
       setQuestions(finalQuestions);
     } catch (error) {
       console.error('Error generating quiz questions:', error);
     } finally {
       setIsLoading(false);
     }
   };
 
   useEffect(() => {
     generateQuestions();
   }, [user]);
 
   return { questions, isLoading, hasProjects, regenerate: generateQuestions };
 };
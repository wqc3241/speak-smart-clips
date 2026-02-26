import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { VocabularyItem, PracticeSentence } from '@/types/project';
import { isVocabularyArray, isPracticeSentenceArray } from '@/lib/typeGuards';

export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'translation' | 'fill_blank';
  question: string;
  correctAnswer: string;
  options: string[];
  sourceProject?: string;
  originalText?: string;
}

// Helper to get meaning from either field name
const getMeaning = (v: VocabularyItem): string | undefined => v.meaning || v.definition;

// Module-level cache so questions survive component remounts
let cachedQuestions: QuizQuestion[] | null = null;
let cachedHasProjects: boolean | null = null;

export const useQuizData = () => {
  const [questions, setQuestions] = useState<QuizQuestion[]>(cachedQuestions ?? []);
  const [isLoading, setIsLoading] = useState(cachedQuestions === null);
  const [hasProjects, setHasProjects] = useState(cachedHasProjects ?? false);
  const { user } = useAuth();

  const generateQuestions = useCallback(async (force = false) => {
    // Return cached questions unless forced
    if (!force && cachedQuestions !== null) {
      setQuestions(cachedQuestions);
      setHasProjects(cachedHasProjects ?? false);
      setIsLoading(false);
      return;
    }

    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

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
        const rawVocab = project.vocabulary;
        const rawSentences = project.practice_sentences;

        if (isVocabularyArray(rawVocab)) {
          rawVocab.forEach((v) => allVocabulary.push({ item: v, project: project.title }));
        }
        if (isPracticeSentenceArray(rawSentences)) {
          rawSentences.forEach((s) => allSentences.push({ item: s, project: project.title }));
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
          .map((v) => getMeaning(v.item) ?? '')
          .filter((m) => m !== '');

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
      cachedQuestions = finalQuestions;
      cachedHasProjects = true;
      setQuestions(finalQuestions);
    } catch (error) {
      console.error('Error generating quiz questions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const forceRegenerate = useCallback(() => {
    return generateQuestions(true);
  }, [generateQuestions]);

  useEffect(() => {
    generateQuestions();
  }, [generateQuestions]);

  return { questions, isLoading, hasProjects, regenerate: generateQuestions, forceRegenerate };
};

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isVocabularyArray, isGrammarArray, isPracticeSentenceArray } from '@/lib/typeGuards';
import type { AppProject } from '@/types/project';

export function useTalkProjects() {
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const userId = authData.user?.id;
        if (!userId) {
          if (mountedRef.current) setProjects([]);
          return;
        }

        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .order('last_accessed', { ascending: false });

        if (error) throw error;

        if (mountedRef.current) {
          setProjects(
            (data || []).map((d) => {
              const rawVocab = d.vocabulary ?? [];
              const rawGrammar = d.grammar ?? [];
              const rawSentences = d.practice_sentences ?? [];

              return {
                id: d.id,
                title: d.title,
                url: d.youtube_url,
                script: d.script,
                vocabulary: isVocabularyArray(rawVocab) ? rawVocab : [],
                grammar: isGrammarArray(rawGrammar) ? rawGrammar : [],
                practiceSentences: isPracticeSentenceArray(rawSentences) ? rawSentences : [],
                detectedLanguage: d.detected_language || 'Unknown',
              };
            })
          );
        }
      } catch (error) {
        console.error('Failed to fetch talk projects:', error);
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  return { projects, isLoading };
}

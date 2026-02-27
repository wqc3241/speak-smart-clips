import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { LearningUnit } from '@/types/quiz';
import { mapDbUnitToLearningUnit } from '@/types/quiz';

export const useLearningUnits = () => {
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const { user } = useAuth();
  const mountedRef = useRef(true);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const fetchUnits = useCallback(async (): Promise<LearningUnit[]> => {
    if (!user) {
      setIsLoading(false);
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('learning_units')
        .select('*')
        .eq('user_id', user.id)
        .order('project_id', { ascending: true })
        .order('unit_number', { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map(row =>
        mapDbUnitToLearningUnit(row as unknown as Record<string, unknown>)
      );

      if (mountedRef.current) {
        setUnits(mapped);
      }
      return mapped;
    } catch (error) {
      console.error('Error fetching learning units:', error);
      return [];
    }
  }, [user]);

  // Get completed project IDs that don't yet have learning units
  const getProjectsMissingUnits = useCallback(async (): Promise<string[]> => {
    if (!user) return [];
    try {
      // Get all completed project IDs
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'completed');

      if (!projects || projects.length === 0) return [];

      // Get project IDs that already have learning units
      const { data: existing } = await supabase
        .from('learning_units')
        .select('project_id')
        .eq('user_id', user.id);

      const existingProjectIds = new Set((existing || []).map(u => u.project_id));
      return projects
        .map(p => p.id)
        .filter(id => !existingProjectIds.has(id));
    } catch {
      return [];
    }
  }, [user]);

  // Auto-poll: if user has projects but 0 units, units are likely being generated
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollCountRef.current = 0;

    const poll = async () => {
      if (!mountedRef.current) return;
      pollCountRef.current++;

      const fetched = await fetchUnits();
      if (!mountedRef.current) return;

      if (fetched.length > 0) {
        // Units arrived, stop polling
        setIsGenerating(false);
        setIsLoading(false);
        return;
      }

      // Keep polling up to 24 times (120s total at 5s intervals)
      if (pollCountRef.current < 24) {
        pollTimerRef.current = setTimeout(poll, 5000);
      } else {
        setIsGenerating(false);
        setIsLoading(false);
      }
    };

    setIsGenerating(true);
    pollTimerRef.current = setTimeout(poll, 5000);
  }, [fetchUnits]);

  // Initial fetch on mount
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const fetched = await fetchUnits();
      if (!mountedRef.current) return;

      if (fetched.length === 0) {
        // No units — check for projects missing units and trigger generation
        const missingIds = await getProjectsMissingUnits();
        if (!mountedRef.current) return;

        if (missingIds.length > 0) {
          // Trigger generation for all projects that need it
          setIsGenerating(true);
          for (const projectId of missingIds) {
            try {
              await supabase.functions.invoke('generate-learning-units', {
                body: { projectId },
              });
            } catch (e) {
              console.error(`Failed to trigger generation for project ${projectId}:`, e);
            }
          }
          // Now poll for results
          startPolling();
        } else {
          setIsLoading(false);
        }
      } else {
        // Have some units, but check if any projects are still missing units
        const missingIds = await getProjectsMissingUnits();
        if (!mountedRef.current) return;

        if (missingIds.length > 0) {
          // Generate units for new projects silently in the background.
          // Don't call startPolling() — it sets isGenerating=true which shows
          // the "Generating" spinner, hiding the units the user already has.
          // New units will appear on next mount / tab switch.
          for (const projectId of missingIds) {
            supabase.functions.invoke('generate-learning-units', {
              body: { projectId },
            }).catch(e => console.error(`Failed to trigger generation for project ${projectId}:`, e));
          }
        }
        setIsLoading(false);
      }
    };

    init();
  }, [fetchUnits, getProjectsMissingUnits, startPolling]);

  const updateUnitProgress = useCallback(async (
    unitId: string,
    score: number,
    stars: number
  ) => {
    if (!user) return;

    try {
      const { data: current } = await supabase
        .from('learning_units')
        .select('best_score, attempts, is_completed')
        .eq('id', unitId)
        .eq('user_id', user.id)
        .single();

      const currentBest = current?.best_score ?? 0;
      const newBestScore = Math.max(currentBest, score);
      const isCompleted = score >= 60;

      const { error } = await supabase
        .from('learning_units')
        .update({
          best_score: newBestScore,
          attempts: (current?.attempts ?? 0) + 1,
          is_completed: current?.is_completed || isCompleted,
          stars: Math.max(
            current?.best_score ? (current.best_score >= 90 ? 3 : current.best_score >= 70 ? 2 : 1) : 0,
            stars
          ),
          last_attempted_at: new Date().toISOString(),
        })
        .eq('id', unitId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      if (mountedRef.current) {
        setUnits(prev => prev.map(u =>
          u.id === unitId
            ? {
                ...u,
                bestScore: newBestScore,
                attempts: (u.attempts ?? 0) + 1,
                isCompleted: u.isCompleted || isCompleted,
                stars: Math.max(u.stars, stars),
                lastAttemptedAt: new Date().toISOString(),
              }
            : u
        ));
      }
    } catch (error) {
      console.error('Error updating unit progress:', error);
    }
  }, [user]);

  const regenerateUnits = useCallback(async (projectId: string) => {
    if (!user) return;

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-learning-units', {
        body: { projectId },
      });

      if (error) throw new Error(error.message || 'Failed to generate units');
      if (!data?.success) throw new Error(data?.error || 'Generation failed');

      await fetchUnits();
    } catch (error) {
      console.error('Error regenerating units:', error);
      throw error;
    } finally {
      if (mountedRef.current) setIsGenerating(false);
    }
  }, [user, fetchUnits]);

  // Expose a manual refresh (e.g., after quiz completion)
  const refresh = useCallback(async () => {
    await fetchUnits();
  }, [fetchUnits]);

  return {
    units,
    isLoading,
    isGenerating,
    updateUnitProgress,
    regenerateUnits,
    refresh,
  };
};

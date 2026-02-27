import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { YouTubeSearchResult } from '@/types/youtube';

const MAX_QUERIES = 3;
const RESULTS_PER_QUERY = 4;

export function usePersonalizedRecommendations(searchHistory: string[]) {
  const [recommendations, setRecommendations] = useState<YouTubeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedKeyRef = useRef('');

  const queriesKey = searchHistory.slice(0, MAX_QUERIES).join('\n');

  useEffect(() => {
    if (!queriesKey) {
      setRecommendations([]);
      fetchedKeyRef.current = '';
      return;
    }

    // Don't re-fetch if the queries haven't changed
    if (fetchedKeyRef.current === queriesKey) return;
    fetchedKeyRef.current = queriesKey;

    const queries = queriesKey.split('\n');
    let cancelled = false;

    const fetchRecommendations = async () => {
      setIsLoading(true);
      try {
        const batches = await Promise.all(
          queries.map((query) =>
            supabase.functions
              .invoke('youtube-search', {
                body: { query, maxResults: RESULTS_PER_QUERY },
              })
              .then(({ data }) =>
                (data?.results || []) as YouTubeSearchResult[]
              )
              .catch(() => [] as YouTubeSearchResult[])
          )
        );

        if (cancelled) return;

        // Deduplicate by videoId
        const seen = new Set<string>();
        const combined: YouTubeSearchResult[] = [];
        for (const batch of batches) {
          for (const video of batch) {
            if (!seen.has(video.videoId)) {
              seen.add(video.videoId);
              combined.push(video);
            }
          }
        }

        setRecommendations(combined);
      } catch (error) {
        console.error('Failed to fetch personalized recommendations:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchRecommendations();

    return () => {
      cancelled = true;
    };
  }, [queriesKey]);

  return { recommendations, isLoading };
}

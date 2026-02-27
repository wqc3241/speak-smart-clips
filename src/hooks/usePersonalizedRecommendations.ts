import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { YouTubeSearchResult } from '@/types/youtube';

const MAX_QUERIES = 3;
const RESULTS_PER_QUERY = 4;
const CACHE_KEY_PREFIX = 'speak-smart-clips:recommendations';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedRecommendations {
  queriesKey: string;
  recommendations: YouTubeSearchResult[];
  timestamp: number;
}

function getCacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}:${userId}`;
}

function loadCache(userId: string, queriesKey: string): YouTubeSearchResult[] | null {
  try {
    const raw = localStorage.getItem(getCacheKey(userId));
    if (!raw) return null;
    const cached: CachedRecommendations = JSON.parse(raw);
    if (cached.queriesKey !== queriesKey) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null;
    return cached.recommendations;
  } catch {
    return null;
  }
}

function saveCache(userId: string, queriesKey: string, recommendations: YouTubeSearchResult[]): void {
  try {
    const data: CachedRecommendations = { queriesKey, recommendations, timestamp: Date.now() };
    localStorage.setItem(getCacheKey(userId), JSON.stringify(data));
  } catch {
    // Silently fail if localStorage is full
  }
}

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

    // Don't re-fetch if the queries haven't changed within same mount lifecycle
    if (fetchedKeyRef.current === queriesKey) return;
    fetchedKeyRef.current = queriesKey;

    let cancelled = false;

    const fetchRecommendations = async () => {
      // Get current user for per-account caching
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || 'anonymous';

      // Check cache first — avoid YouTube API call if fresh
      const cached = loadCache(userId, queriesKey);
      if (cached) {
        if (!cancelled) setRecommendations(cached);
        return;
      }

      setIsLoading(true);
      try {
        const queries = queriesKey.split('\n');
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
        saveCache(userId, queriesKey, combined);
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

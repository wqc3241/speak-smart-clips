import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { YouTubeSearchResult } from '@/types/youtube';

export const useYouTubeSearch = () => {
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const search = useCallback(async (query: string, languageCode?: string) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke('youtube-search', {
        body: { query: query.trim(), languageCode },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Search failed');
      }

      setResults(data.results || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      toast({
        title: 'Search failed',
        description: message,
        variant: 'destructive',
      });
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [toast]);

  const clearSearch = useCallback(() => {
    setResults([]);
    setHasSearched(false);
  }, []);

  return { results, isSearching, hasSearched, search, clearSearch };
};

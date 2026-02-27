import { useState, useCallback } from 'react';
import {
  getSearchHistory,
  addSearchQuery,
  removeSearchQuery,
  clearSearchHistory,
} from '@/lib/searchHistory';

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(() => getSearchHistory());

  const add = useCallback((query: string) => {
    const updated = addSearchQuery(query);
    setHistory(updated);
  }, []);

  const remove = useCallback((query: string) => {
    const updated = removeSearchQuery(query);
    setHistory(updated);
  }, []);

  const clear = useCallback(() => {
    clearSearchHistory();
    setHistory([]);
  }, []);

  return { history, add, remove, clear };
}

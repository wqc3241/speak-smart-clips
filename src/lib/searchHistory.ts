const STORAGE_KEY = 'speak-smart-clips:search-history';
const MAX_ENTRIES = 10;

export function getSearchHistory(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addSearchQuery(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return getSearchHistory();

  const history = getSearchHistory();
  // Remove duplicate (case-insensitive) then prepend
  const filtered = history.filter(q => q.toLowerCase() !== trimmed.toLowerCase());
  const updated = [trimmed, ...filtered].slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function removeSearchQuery(query: string): string[] {
  const history = getSearchHistory();
  const updated = history.filter(q => q !== query);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearSearchHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

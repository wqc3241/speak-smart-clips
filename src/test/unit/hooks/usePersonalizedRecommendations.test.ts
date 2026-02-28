import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ─── Mock constants ─────────────────────────────────────────────────

const MOCK_USER_ID = 'user-abc-123';
const CACHE_KEY = `speak-smart-clips:recommendations:${MOCK_USER_ID}`;

const MOCK_VIDEOS = [
  { videoId: 'v1', title: 'Japanese Lesson 1', thumbnail: '', channelTitle: 'Ch1', publishedAt: '', description: '' },
  { videoId: 'v2', title: 'Japanese Lesson 2', thumbnail: '', channelTitle: 'Ch2', publishedAt: '', description: '' },
  { videoId: 'v3', title: 'Japanese Lesson 3', thumbnail: '', channelTitle: 'Ch3', publishedAt: '', description: '' },
];

const MOCK_VIDEOS_BATCH2 = [
  { videoId: 'v2', title: 'Japanese Lesson 2', thumbnail: '', channelTitle: 'Ch2', publishedAt: '', description: '' },
  { videoId: 'v4', title: 'Spanish Lesson 1', thumbnail: '', channelTitle: 'Ch4', publishedAt: '', description: '' },
];

// ─── Mocks ──────────────────────────────────────────────────────────

const mockFunctionsInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: MOCK_USER_ID } } },
      }),
    },
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
  },
}));

// ─── Helpers ────────────────────────────────────────────────────────

function buildCacheEntry(queriesKey: string, recommendations: unknown[], ageMs = 0) {
  return JSON.stringify({
    queriesKey,
    recommendations,
    timestamp: Date.now() - ageMs,
  });
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('usePersonalizedRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns empty recommendations when search history is empty', async () => {
    const { usePersonalizedRecommendations } = await import('@/hooks/usePersonalizedRecommendations');
    const { result } = renderHook(() => usePersonalizedRecommendations([]));

    expect(result.current.recommendations).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it('fetches recommendations via youtube-search when no cache exists', async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: { results: MOCK_VIDEOS },
    });

    const { usePersonalizedRecommendations } = await import('@/hooks/usePersonalizedRecommendations');
    const { result } = renderHook(() =>
      usePersonalizedRecommendations(['japanese greetings'])
    );

    await waitFor(() => {
      expect(result.current.recommendations.length).toBeGreaterThan(0);
    });

    expect(mockFunctionsInvoke).toHaveBeenCalledWith('youtube-search', expect.objectContaining({
      body: expect.objectContaining({ query: 'japanese greetings' }),
    }));
  });

  it('serves cached recommendations without calling youtube-search', async () => {
    const queriesKey = 'japanese greetings';
    localStorage.setItem(CACHE_KEY, buildCacheEntry(queriesKey, MOCK_VIDEOS));

    const { usePersonalizedRecommendations } = await import('@/hooks/usePersonalizedRecommendations');
    const { result } = renderHook(() =>
      usePersonalizedRecommendations(['japanese greetings'])
    );

    await waitFor(() => {
      expect(result.current.recommendations).toHaveLength(3);
    });

    // youtube-search should NOT have been called — served from cache
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it('ignores expired cache (>24h) and re-fetches', async () => {
    const queriesKey = 'japanese greetings';
    const expiredAge = 25 * 60 * 60 * 1000; // 25 hours
    localStorage.setItem(CACHE_KEY, buildCacheEntry(queriesKey, MOCK_VIDEOS, expiredAge));

    mockFunctionsInvoke.mockResolvedValue({
      data: { results: MOCK_VIDEOS },
    });

    const { usePersonalizedRecommendations } = await import('@/hooks/usePersonalizedRecommendations');
    const { result } = renderHook(() =>
      usePersonalizedRecommendations(['japanese greetings'])
    );

    await waitFor(() => {
      expect(result.current.recommendations.length).toBeGreaterThan(0);
    });

    // Should have called the API since the cache was expired
    expect(mockFunctionsInvoke).toHaveBeenCalled();
  });

  it('ignores cache when search history changes', async () => {
    // Cache was for "old query"
    localStorage.setItem(CACHE_KEY, buildCacheEntry('old query', MOCK_VIDEOS));

    mockFunctionsInvoke.mockResolvedValue({
      data: { results: MOCK_VIDEOS_BATCH2 },
    });

    const { usePersonalizedRecommendations } = await import('@/hooks/usePersonalizedRecommendations');
    const { result } = renderHook(() =>
      usePersonalizedRecommendations(['new query'])
    );

    await waitFor(() => {
      expect(result.current.recommendations.length).toBeGreaterThan(0);
    });

    // Should have called the API since queriesKey differs
    expect(mockFunctionsInvoke).toHaveBeenCalled();
  });

  it('deduplicates videos across batches', async () => {
    // First query returns v1, v2; second query returns v2, v4
    mockFunctionsInvoke
      .mockResolvedValueOnce({ data: { results: [MOCK_VIDEOS[0], MOCK_VIDEOS[1]] } })
      .mockResolvedValueOnce({ data: { results: MOCK_VIDEOS_BATCH2 } });

    const { usePersonalizedRecommendations } = await import('@/hooks/usePersonalizedRecommendations');
    const { result } = renderHook(() =>
      usePersonalizedRecommendations(['query one', 'query two'])
    );

    await waitFor(() => {
      expect(result.current.recommendations.length).toBeGreaterThan(0);
    });

    // v2 appears in both batches but should only appear once
    const ids = result.current.recommendations.map((r) => r.videoId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('v1');
    expect(ids).toContain('v2');
    expect(ids).toContain('v4');
  });

  it('saves fetched recommendations to localStorage cache', async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: { results: MOCK_VIDEOS },
    });

    const { usePersonalizedRecommendations } = await import('@/hooks/usePersonalizedRecommendations');
    const { result } = renderHook(() =>
      usePersonalizedRecommendations(['japanese greetings'])
    );

    await waitFor(() => {
      expect(result.current.recommendations.length).toBeGreaterThan(0);
    });

    // Cache should now be populated
    const cached = localStorage.getItem(CACHE_KEY);
    expect(cached).not.toBeNull();

    const parsed = JSON.parse(cached!);
    expect(parsed.queriesKey).toBe('japanese greetings');
    expect(parsed.recommendations).toHaveLength(3);
    expect(parsed.timestamp).toBeGreaterThan(0);
  });

  it('uses only the first 3 search history entries', async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: { results: MOCK_VIDEOS.slice(0, 1) },
    });

    const { usePersonalizedRecommendations } = await import('@/hooks/usePersonalizedRecommendations');
    renderHook(() =>
      usePersonalizedRecommendations(['q1', 'q2', 'q3', 'q4', 'q5'])
    );

    await waitFor(() => {
      // Should have made exactly 3 calls (MAX_QUERIES), not 5
      expect(mockFunctionsInvoke).toHaveBeenCalledTimes(3);
    });
  });
});

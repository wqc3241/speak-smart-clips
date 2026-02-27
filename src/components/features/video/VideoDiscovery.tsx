import React, { useState, useMemo, useRef } from 'react';
import { Search, Loader2, X, Sparkles, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useYouTubeSearch } from '@/hooks/useYouTubeSearch';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { usePersonalizedRecommendations } from '@/hooks/usePersonalizedRecommendations';
import { getRecommendationsByLanguage } from '@/lib/recommendedVideos';
import { VideoCard } from './VideoCard';

interface VideoDiscoveryProps {
  onSelectVideo: (videoId: string) => void;
  isProcessing: boolean;
}

export const VideoDiscovery: React.FC<VideoDiscoveryProps> = ({
  onSelectVideo,
  isProcessing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { results, isSearching, hasSearched, search, clearSearch } = useYouTubeSearch();
  const { history, add: addToHistory, remove: removeFromHistory, clear: clearHistory } = useSearchHistory();
  const { recommendations, isLoading: isLoadingRecs } = usePersonalizedRecommendations(history);

  const recommendationsByLanguage = useMemo(() => getRecommendationsByLanguage(), []);
  const languages = useMemo(() => Object.keys(recommendationsByLanguage), [recommendationsByLanguage]);

  // Filter history by current input for type-ahead
  const filteredHistory = searchQuery.trim()
    ? history.filter(q => q.toLowerCase().includes(searchQuery.toLowerCase()))
    : history;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      addToHistory(searchQuery.trim());
      search(searchQuery);
      setShowHistory(false);
    }
  };

  const handleHistoryClick = (query: string) => {
    setSearchQuery(query);
    addToHistory(query);
    search(query);
    setShowHistory(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    clearSearch();
  };

  const handleInputFocus = () => {
    if (history.length > 0) {
      setShowHistory(true);
    }
  };

  const handleInputBlur = (e: React.FocusEvent) => {
    // Don't close if clicking within the dropdown
    if (dropdownRef.current?.contains(e.relatedTarget as Node)) return;
    setShowHistory(false);
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search YouTube for videos..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (history.length > 0) setShowHistory(true);
            }}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            className="pl-9 h-9"
            disabled={isProcessing}
          />
          {hasSearched && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Search history dropdown */}
          {showHistory && filteredHistory.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md z-50 py-1"
            >
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-xs text-muted-foreground font-medium">Recent searches</span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    clearHistory();
                    setShowHistory(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
              </div>
              {filteredHistory.map((query) => (
                <div
                  key={query}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <button
                    type="button"
                    className="flex-1 text-sm text-left truncate"
                    onClick={() => handleHistoryClick(query)}
                  >
                    {query}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromHistory(query)}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={isSearching || isProcessing || !searchQuery.trim()}
          className="h-9 px-4"
        >
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Search'
          )}
        </Button>
      </form>

      {/* Search results */}
      {hasSearched && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isSearching
                ? 'Searching...'
                : `${results.length} result${results.length !== 1 ? 's' : ''} found`}
            </p>
            <Button variant="ghost" size="sm" onClick={handleClearSearch} className="text-xs h-7">
              Clear search
            </Button>
          </div>
          {results.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {results.map((video) => (
                <VideoCard
                  key={video.videoId}
                  videoId={video.videoId}
                  title={video.title}
                  thumbnail={video.thumbnail}
                  channelTitle={video.channelTitle}
                  onClick={onSelectVideo}
                />
              ))}
            </div>
          )}
          {!isSearching && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No captioned videos found. Try different keywords.
            </p>
          )}
        </div>
      )}

      {/* Recommendations (hidden during search) */}
      {!hasSearched && (
        <div className="space-y-6">
          {history.length > 0 ? (
            /* Personalized recommendations — replaces static curated list once the user has search history */
            <>
              {isLoadingRecs && (
                <div className="space-y-3">
                  <div className="h-5 w-44 bg-muted animate-pulse rounded" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="rounded-lg border bg-card overflow-hidden">
                        <div className="aspect-video bg-muted animate-pulse" />
                        <div className="p-3 space-y-2">
                          <div className="h-4 w-full bg-muted animate-pulse rounded" />
                          <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isLoadingRecs && recommendations.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="w-4 h-4 text-primary" />
                    <span>Recommended for you</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {recommendations.map((video) => (
                      <VideoCard
                        key={video.videoId}
                        videoId={video.videoId}
                        title={video.title}
                        thumbnail={video.thumbnail}
                        channelTitle={video.channelTitle}
                        onClick={onSelectVideo}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Static curated recommendations — shown only for new users with no search history */
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Recommended for Language Learning</span>
              </div>
              <Tabs defaultValue={languages[0]} className="w-full">
                <TabsList className="w-full flex-wrap h-auto gap-1 bg-transparent p-0 justify-start">
                  {languages.map((lang) => (
                    <TabsTrigger
                      key={lang}
                      value={lang}
                      className="text-xs px-3 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full border"
                    >
                      {lang}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {languages.map((lang) => (
                  <TabsContent key={lang} value={lang} className="mt-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {recommendationsByLanguage[lang].map((video) => (
                        <VideoCard
                          key={video.videoId}
                          videoId={video.videoId}
                          title={video.title}
                          thumbnail={video.thumbnail}
                          channelTitle={video.channelTitle}
                          badge={video.level}
                          onClick={onSelectVideo}
                        />
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

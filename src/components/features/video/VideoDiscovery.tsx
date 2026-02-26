import React, { useState, useMemo } from 'react';
import { Search, Loader2, X, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useYouTubeSearch } from '@/hooks/useYouTubeSearch';
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
  const { results, isSearching, hasSearched, search, clearSearch } = useYouTubeSearch();
  const recommendationsByLanguage = useMemo(() => getRecommendationsByLanguage(), []);
  const languages = useMemo(() => Object.keys(recommendationsByLanguage), [recommendationsByLanguage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      search(searchQuery);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    clearSearch();
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
            onChange={(e) => setSearchQuery(e.target.value)}
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
  );
};

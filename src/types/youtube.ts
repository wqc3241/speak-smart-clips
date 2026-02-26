export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  description: string;
}

export interface CuratedVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  language: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
}

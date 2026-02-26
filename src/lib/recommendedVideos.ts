import type { CuratedVideo } from '@/types/youtube';

export const RECOMMENDED_VIDEOS: CuratedVideo[] = [
  // Japanese
  {
    videoId: 'iclbMJNkG2g',
    title: 'Learn Japanese - Miku Real Japanese',
    thumbnail: 'https://i.ytimg.com/vi/iclbMJNkG2g/mqdefault.jpg',
    channelTitle: 'Miku Real Japanese',
    language: 'Japanese',
    level: 'beginner',
    category: 'Comprehensive',
  },
  {
    videoId: '6p9Il_j0zjc',
    title: 'Absolute Beginner Japanese - Basic Self Introduction',
    thumbnail: 'https://i.ytimg.com/vi/6p9Il_j0zjc/mqdefault.jpg',
    channelTitle: 'JapanesePod101',
    language: 'Japanese',
    level: 'beginner',
    category: 'Conversation',
  },
  {
    videoId: 'o2cHbIR_Mhc',
    title: 'Japanese Listening Practice - Slow and Easy',
    thumbnail: 'https://i.ytimg.com/vi/o2cHbIR_Mhc/mqdefault.jpg',
    channelTitle: 'Nihongo no Mori',
    language: 'Japanese',
    level: 'intermediate',
    category: 'Listening',
  },

  // Spanish
  {
    videoId: 'OD7KMfPJB-Q',
    title: '1000 Most Common Spanish Words',
    thumbnail: 'https://i.ytimg.com/vi/OD7KMfPJB-Q/mqdefault.jpg',
    channelTitle: 'SpanishPod101',
    language: 'Spanish',
    level: 'beginner',
    category: 'Comprehensive',
  },
  {
    videoId: 'PnGo1zQQnmo',
    title: 'Spanish Conversation for Beginners | 70 Basic Phrases',
    thumbnail: 'https://i.ytimg.com/vi/PnGo1zQQnmo/mqdefault.jpg',
    channelTitle: 'Español con Juan',
    language: 'Spanish',
    level: 'beginner',
    category: 'Conversation',
  },
  {
    videoId: 'WHaWOTi_ikA',
    title: 'Beginner Spanish - Useful Phrases for Daily Life',
    thumbnail: 'https://i.ytimg.com/vi/WHaWOTi_ikA/mqdefault.jpg',
    channelTitle: 'Dreaming Spanish',
    language: 'Spanish',
    level: 'beginner',
    category: 'Vocabulary',
  },

  // Korean
  {
    videoId: 'SHBFTnYC1f4',
    title: 'Korean Listening Practice for Beginners',
    thumbnail: 'https://i.ytimg.com/vi/SHBFTnYC1f4/mqdefault.jpg',
    channelTitle: 'Talk To Me In Korean',
    language: 'Korean',
    level: 'beginner',
    category: 'Comprehensive',
  },
  {
    videoId: 'gXGumxQ05AA',
    title: 'Learn Korean While You Sleep - Basic Phrases',
    thumbnail: 'https://i.ytimg.com/vi/gXGumxQ05AA/mqdefault.jpg',
    channelTitle: 'KoreanClass101',
    language: 'Korean',
    level: 'beginner',
    category: 'Conversation',
  },

  // French
  {
    videoId: 'Slp5wbCYqHA',
    title: 'Slow & Easy French Conversation Practice',
    thumbnail: 'https://i.ytimg.com/vi/Slp5wbCYqHA/mqdefault.jpg',
    channelTitle: 'Piece of French',
    language: 'French',
    level: 'beginner',
    category: 'Comprehensive',
  },
  {
    videoId: 'Gka4X7aSNfc',
    title: 'Learn French for Beginners - Common Words & Phrases',
    thumbnail: 'https://i.ytimg.com/vi/Gka4X7aSNfc/mqdefault.jpg',
    channelTitle: 'FrenchPod101',
    language: 'French',
    level: 'beginner',
    category: 'Listening',
  },

  // Chinese
  {
    videoId: 'mf2FfBIRCfo',
    title: 'Chinese Listening Practice - Easy Stories',
    thumbnail: 'https://i.ytimg.com/vi/mf2FfBIRCfo/mqdefault.jpg',
    channelTitle: 'Mandarin Corner',
    language: 'Chinese',
    level: 'beginner',
    category: 'Comprehensive',
  },
  {
    videoId: 'KqG7t7x2rKs',
    title: 'Learn Chinese - 500 Essential Words for Beginners',
    thumbnail: 'https://i.ytimg.com/vi/KqG7t7x2rKs/mqdefault.jpg',
    channelTitle: 'ChineseClass101',
    language: 'Chinese',
    level: 'beginner',
    category: 'Listening',
  },

  // German
  {
    videoId: 'q6GEsKZB0rg',
    title: 'Learn German for Beginners Complete A1 Course',
    thumbnail: 'https://i.ytimg.com/vi/q6GEsKZB0rg/mqdefault.jpg',
    channelTitle: 'Learn German',
    language: 'German',
    level: 'beginner',
    category: 'Comprehensive',
  },
  {
    videoId: 'RuGmc662HDg',
    title: 'Easy German - Street Interviews for Beginners',
    thumbnail: 'https://i.ytimg.com/vi/RuGmc662HDg/mqdefault.jpg',
    channelTitle: 'Easy German',
    language: 'German',
    level: 'beginner',
    category: 'Conversation',
  },
];

export function getRecommendationsByLanguage(): Record<string, CuratedVideo[]> {
  const grouped: Record<string, CuratedVideo[]> = {};
  for (const video of RECOMMENDED_VIDEOS) {
    if (!grouped[video.language]) {
      grouped[video.language] = [];
    }
    grouped[video.language].push(video);
  }
  return grouped;
}

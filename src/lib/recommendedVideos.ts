import type { CuratedVideo } from '@/types/youtube';

export const RECOMMENDED_VIDEOS: CuratedVideo[] = [
  // Japanese
  {
    videoId: '6p9Il_j0zjc',
    title: 'Learn ALL Hiragana in 1 Hour - How to Write and Read Japanese',
    thumbnail: 'https://i.ytimg.com/vi/6p9Il_j0zjc/mqdefault.jpg',
    channelTitle: 'JapanesePod101',
    language: 'Japanese',
    level: 'beginner',
    category: 'Comprehensive',
  },
  {
    videoId: 's6DKRgtVLGA',
    title: 'Learn ALL Katakana in 1 Hour - How to Write and Read Japanese',
    thumbnail: 'https://i.ytimg.com/vi/s6DKRgtVLGA/mqdefault.jpg',
    channelTitle: 'JapanesePod101',
    language: 'Japanese',
    level: 'beginner',
    category: 'Comprehensive',
  },
  {
    videoId: 'wDpsF90DoeI',
    title: 'Learn Japanese | Minna No Nihongo Lesson 1 Vocabulary',
    thumbnail: 'https://i.ytimg.com/vi/wDpsF90DoeI/mqdefault.jpg',
    channelTitle: 'NihonGoal',
    language: 'Japanese',
    level: 'beginner',
    category: 'Vocabulary',
  },

  // Spanish
  {
    videoId: 'NSA0oXIL01M',
    title: 'Learn Spanish Tenses: IMPERFECTO - complete class',
    thumbnail: 'https://i.ytimg.com/vi/NSA0oXIL01M/mqdefault.jpg',
    channelTitle: 'Butterfly Spanish',
    language: 'Spanish',
    level: 'beginner',
    category: 'Comprehensive',
  },
  {
    videoId: 'tpXtUD59k0U',
    title: 'How To Use The Verb Llamar In Spanish',
    thumbnail: 'https://i.ytimg.com/vi/tpXtUD59k0U/mqdefault.jpg',
    channelTitle: 'Speak Spanish Faster',
    language: 'Spanish',
    level: 'beginner',
    category: 'Vocabulary',
  },

  // Korean
  {
    videoId: 'AqFGHMxWtYk',
    title: 'Learn to read and write Hangeul (Korean Writing System) - Part 1',
    thumbnail: 'https://i.ytimg.com/vi/AqFGHMxWtYk/mqdefault.jpg',
    channelTitle: 'Talk To Me In Korean',
    language: 'Korean',
    level: 'beginner',
    category: 'Comprehensive',
  },
  {
    videoId: 'kkj8cm_n-Z0',
    title: 'Top 10 Korean Words of the Week',
    thumbnail: 'https://i.ytimg.com/vi/kkj8cm_n-Z0/mqdefault.jpg',
    channelTitle: 'KoreanClass101',
    language: 'Korean',
    level: 'beginner',
    category: 'Vocabulary',
  },

  // French
  {
    videoId: '0640g_PGQMw',
    title: '60 French Words for Everyday Life - Basic Vocabulary #3',
    thumbnail: 'https://i.ytimg.com/vi/0640g_PGQMw/mqdefault.jpg',
    channelTitle: 'FrenchPod101',
    language: 'French',
    level: 'beginner',
    category: 'Vocabulary',
  },
  {
    videoId: 'qknSOsPesi0',
    title: 'Practise your French alphabet',
    thumbnail: 'https://i.ytimg.com/vi/qknSOsPesi0/mqdefault.jpg',
    channelTitle: 'Learn French With Alexa',
    language: 'French',
    level: 'beginner',
    category: 'Comprehensive',
  },

  // Chinese
  {
    videoId: 'EP1IZ9h_mTM',
    title: 'Learn How to Talk About Your Hobbies in Chinese | Can Do #22',
    thumbnail: 'https://i.ytimg.com/vi/EP1IZ9h_mTM/mqdefault.jpg',
    channelTitle: 'ChineseClass101',
    language: 'Chinese',
    level: 'beginner',
    category: 'Conversation',
  },
  {
    videoId: 'CnAlUa96zfI',
    title: 'Chinese Lessons with Native Speakers | Chinese Farmers Markets',
    thumbnail: 'https://i.ytimg.com/vi/CnAlUa96zfI/mqdefault.jpg',
    channelTitle: 'Yoyo Chinese',
    language: 'Chinese',
    level: 'intermediate',
    category: 'Listening',
  },

  // German
  {
    videoId: 'A5fEnzUFqP0',
    title: '100 German Words for Everyday Life - Basic Vocabulary #5',
    thumbnail: 'https://i.ytimg.com/vi/A5fEnzUFqP0/mqdefault.jpg',
    channelTitle: 'GermanPod101',
    language: 'German',
    level: 'beginner',
    category: 'Vocabulary',
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

  // English
  {
    videoId: 'hrliAdaVMEI',
    title: "180 English Words You'll Use Every Day - Basic Vocabulary #58",
    thumbnail: 'https://i.ytimg.com/vi/hrliAdaVMEI/mqdefault.jpg',
    channelTitle: 'EnglishClass101',
    language: 'English',
    level: 'beginner',
    category: 'Vocabulary',
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

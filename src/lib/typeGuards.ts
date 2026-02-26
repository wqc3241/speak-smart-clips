import type { VocabularyItem, GrammarItem, PracticeSentence } from '@/types/project';
import type { Json } from '@/integrations/supabase/types';

export function isVocabularyArray(data: unknown): data is VocabularyItem[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).word === 'string'
  );
}

export function isGrammarArray(data: unknown): data is GrammarItem[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).rule === 'string'
  );
}

export function isPracticeSentenceArray(data: unknown): data is PracticeSentence[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      (typeof (item as Record<string, unknown>).text === 'string' ||
        typeof (item as Record<string, unknown>).japanese === 'string' ||
        typeof (item as Record<string, unknown>).original === 'string')
  );
}

export function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

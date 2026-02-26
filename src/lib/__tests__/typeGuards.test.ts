import { describe, it, expect } from 'vitest';
import { isVocabularyArray, isGrammarArray, isPracticeSentenceArray, toJson } from '../typeGuards';

describe('isVocabularyArray', () => {
  it('returns true for valid vocabulary arrays', () => {
    expect(isVocabularyArray([{ word: 'hello', definition: 'greeting' }])).toBe(true);
    expect(isVocabularyArray([{ word: 'test' }])).toBe(true);
    expect(isVocabularyArray([])).toBe(true);
  });

  it('returns false for non-arrays', () => {
    expect(isVocabularyArray(null)).toBe(false);
    expect(isVocabularyArray(undefined)).toBe(false);
    expect(isVocabularyArray('string')).toBe(false);
    expect(isVocabularyArray(42)).toBe(false);
    expect(isVocabularyArray({})).toBe(false);
  });

  it('returns false for arrays with invalid items', () => {
    expect(isVocabularyArray([{ definition: 'no word field' }])).toBe(false);
    expect(isVocabularyArray([{ word: 123 }])).toBe(false);
    expect(isVocabularyArray([null])).toBe(false);
    expect(isVocabularyArray(['string'])).toBe(false);
  });
});

describe('isGrammarArray', () => {
  it('returns true for valid grammar arrays', () => {
    expect(isGrammarArray([{ rule: 'past tense', example: 'walked', explanation: 'add -ed' }])).toBe(true);
    expect(isGrammarArray([{ rule: 'test' }])).toBe(true);
    expect(isGrammarArray([])).toBe(true);
  });

  it('returns false for non-arrays', () => {
    expect(isGrammarArray(null)).toBe(false);
    expect(isGrammarArray(undefined)).toBe(false);
    expect(isGrammarArray({})).toBe(false);
  });

  it('returns false for arrays with invalid items', () => {
    expect(isGrammarArray([{ example: 'no rule field' }])).toBe(false);
    expect(isGrammarArray([{ rule: 123 }])).toBe(false);
  });
});

describe('isPracticeSentenceArray', () => {
  it('returns true for arrays with text field', () => {
    expect(isPracticeSentenceArray([{ text: 'Hello', translation: 'Hi' }])).toBe(true);
  });

  it('returns true for arrays with japanese field (API variant)', () => {
    expect(isPracticeSentenceArray([{ japanese: 'こんにちは', english: 'Hello' }])).toBe(true);
  });

  it('returns true for arrays with original field (API variant)', () => {
    expect(isPracticeSentenceArray([{ original: 'Bonjour', translation: 'Hello' }])).toBe(true);
  });

  it('returns true for empty array', () => {
    expect(isPracticeSentenceArray([])).toBe(true);
  });

  it('returns false for non-arrays', () => {
    expect(isPracticeSentenceArray(null)).toBe(false);
    expect(isPracticeSentenceArray(undefined)).toBe(false);
  });

  it('returns false for arrays with no text/japanese/original', () => {
    expect(isPracticeSentenceArray([{ translation: 'missing source text' }])).toBe(false);
  });
});

describe('toJson', () => {
  it('converts plain objects', () => {
    const result = toJson({ key: 'value' });
    expect(result).toEqual({ key: 'value' });
  });

  it('converts arrays', () => {
    const result = toJson([1, 2, 3]);
    expect(result).toEqual([1, 2, 3]);
  });

  it('strips undefined values', () => {
    const result = toJson({ a: 1, b: undefined });
    expect(result).toEqual({ a: 1 });
  });

  it('handles nested objects', () => {
    const result = toJson({ nested: { deep: 'value' } });
    expect(result).toEqual({ nested: { deep: 'value' } });
  });

  it('handles null', () => {
    const result = toJson(null);
    expect(result).toBeNull();
  });
});

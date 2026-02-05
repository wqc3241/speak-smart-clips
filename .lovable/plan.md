
## Fix: Quiz Not Loading Due to Vocabulary Field Mismatch

### Problem Identified
The quiz shows "Not enough content to generate a quiz" because the **vocabulary data structure from the database doesn't match what the code expects**.

**Database structure:**
```json
{
  "word": "こんにちは",
  "definition": "Hello",
  "difficulty": "beginner"
}
```

**Code expects:**
```typescript
interface VocabularyItem {
  word: string;
  meaning: string;  // ← Not found, so questions are skipped
}
```

The same issue affects practice sentences:
- Database uses: `text`, `translation`
- Code looks for: `japanese`/`original`, `english`/`translation`

### Solution
Update the `VocabularyItem` and `PracticeSentence` interfaces in `useQuizData.ts` to handle both field naming conventions.

### Changes

---

**File: `src/hooks/useQuizData.ts`**

1. Update the `VocabularyItem` interface to include `definition` as an alternative:

```typescript
interface VocabularyItem {
  word: string;
  reading?: string;
  meaning?: string;
  definition?: string;  // Add this - used by API
  partOfSpeech?: string;
}
```

2. Update the `PracticeSentence` interface to include `text`:

```typescript
interface PracticeSentence {
  japanese?: string;
  original?: string;
  text?: string;  // Add this - used by API
  english?: string;
  translation?: string;
  romanization?: string;
}
```

3. Update the vocabulary processing logic to use either field:

```typescript
// Line 81 - Handle both "meaning" and "definition"
const getMeaning = (v: VocabularyItem) => v.meaning || v.definition;

for (let i = 0; i < Math.min(5, shuffledVocab.length); i++) {
  const vocab = shuffledVocab[i];
  const meaning = getMeaning(vocab.item);
  if (!vocab.item.word || !meaning) continue;

  const wrongAnswers = allVocabulary
    .filter((v) => getMeaning(v.item) !== meaning)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((v) => getMeaning(v.item)!);

  // ... rest of logic using `meaning` variable
}
```

4. Update the sentence processing logic:

```typescript
// Line 109 - Handle "text" in addition to "japanese" and "original"
const original = sentence.item.japanese || sentence.item.original || sentence.item.text;
```

5. Update fill-in-blank questions similarly to use `getMeaning` helper.

---

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useQuizData.ts` | Add `definition` to VocabularyItem interface, add `text` to PracticeSentence interface, update processing logic to handle both naming conventions |

### Technical Details

The root cause is a mismatch between two naming conventions used at different times:
- Older convention: `meaning`, `japanese`, `original`
- Current API convention: `definition`, `text`, `translation`

By supporting both, we ensure backward compatibility with any existing data while working with the current API format.

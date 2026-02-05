

## Duolingo-Style Gamified Input Tab with Learning Units

### Overview
Transform the Input tab to have a compact "Add Video" section at the top, followed by a Duolingo-style gamified learning path with units. Each unit contains 10 random questions/challenges pulled from all saved projects' vocabulary and practice sentences.

### Changes

---

**1. Redesign `src/components/dashboard/InputTab.tsx`**

Make the "Add Video" section more compact:
- Reduce card padding and margins
- Make the input and button smaller (h-10 instead of h-12)
- Remove the card header, use inline title
- Collapse the demo button into a smaller link-style button
- Overall take up less vertical space

---

**2. Create `src/components/features/learning/LearningPath.tsx`**

New component that displays a Duolingo-style learning path:

```text
+------------------------------------------+
|  UNIT 1: Basics                          |
|  ○───○───●───○───○                       |
|  [Start Lesson]                          |
+------------------------------------------+
|  UNIT 2: Greetings                       |
|  ○───○───○───○───○   (locked)            |
+------------------------------------------+
```

Visual design:
- Vertical path with connected circles/nodes
- Each unit is a card with:
  - Unit number and title
  - Progress indicator (completed lessons)
  - Lesson button or locked state
- Uses primary orange color (#F97316) for active states
- Gray for locked/incomplete units

---

**3. Create `src/components/features/learning/QuizInterface.tsx`**

New component for the 10-question quiz experience:

Question types to implement:
- **Multiple Choice**: "What does [word] mean?" with 4 options
- **Translation**: "Translate: [sentence]" with word bank
- **Fill in Blank**: "[Sentence with ___]" select the right word
- **Listening**: Play audio, select correct meaning

UI elements:
- Progress bar showing question number (1/10)
- Hearts/lives system (3 hearts, lose one per wrong answer)
- XP reward animation on correct answers
- Celebration screen at end showing score

---

**4. Create `src/hooks/useQuizData.ts`**

Hook to generate quiz questions from all projects:

```typescript
interface QuizQuestion {
  type: 'multiple_choice' | 'translation' | 'fill_blank' | 'listening';
  question: string;
  correctAnswer: string;
  options?: string[];
  audioUrl?: string;
  sourceProject: string;
}

const useQuizData = () => {
  // Fetch all projects
  // Extract vocabulary and practice_sentences
  // Generate 10 random questions
  // Mix question types for variety
  return { questions, isLoading };
};
```

---

**5. Update `src/pages/Index.tsx`**

Update the Input tab content to show:
1. Compact Add Video card (top)
2. LearningPath component (below)

When user clicks "Start Lesson" on a unit, show QuizInterface.

---

### Data Flow

```text
All Projects in DB
        │
        ▼
┌───────────────────────┐
│ Vocabulary + Grammar  │
│ + Practice Sentences  │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ Generate 10 Random    │
│ Quiz Questions        │
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│ QuizInterface         │
│ - Multiple choice     │
│ - Translation         │
│ - Fill in blank       │
└───────────────────────┘
```

---

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/dashboard/InputTab.tsx` | Modify | Make Add Video section compact |
| `src/components/features/learning/LearningPath.tsx` | Create | Duolingo-style unit path |
| `src/components/features/learning/QuizInterface.tsx` | Create | 10-question quiz UI |
| `src/components/features/learning/QuestionCard.tsx` | Create | Individual question display |
| `src/hooks/useQuizData.ts` | Create | Generate quiz from projects |
| `src/pages/Index.tsx` | Modify | Integrate learning path |

---

### Visual Design Details

**Unit Card Design:**
- Rounded corners with subtle shadow
- Unit number in a circle badge
- Title in bold
- Progress dots showing completed lessons
- Primary button for active unit, disabled for locked

**Quiz Interface:**
- Clean white background
- Large, readable question text
- Touch-friendly answer buttons (min 44px height)
- Green flash for correct, red shake for wrong
- Progress bar at top
- Hearts in top-right corner

**Gamification Elements:**
- XP counter
- Streak indicator
- Completion celebration with confetti effect
- Star rating based on hearts remaining


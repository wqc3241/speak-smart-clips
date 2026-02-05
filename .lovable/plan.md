
## Fix: Constrain Quiz Option Widths to Fit Within Section

### Problem
The quiz option buttons are overflowing their container. Long text like "To change color; to turn red or yellow (of leaves)" gets cut off because the button text doesn't wrap properly.

### Solution
Add text wrapping and overflow handling to the option buttons so that long answer text wraps to multiple lines instead of overflowing.

### Changes

---

**File: `src/components/features/learning/QuizInterface.tsx`**

Update the option Button styling (around line 220-221) to add:
- `whitespace-normal` - Allow text to wrap to multiple lines
- `text-wrap` or `break-words` - Ensure words break properly
- Keep `w-full` on the button to ensure it fills the container width

```typescript
<Button
  key={index}
  variant="outline"
  className={cn(
    'h-auto py-4 px-4 text-left justify-start text-base font-normal transition-all whitespace-normal break-words w-full',
    // ... rest of styling
  )}
>
```

Also update the inner span to allow proper text wrapping:

```typescript
<div className="flex items-center gap-3 w-full min-w-0">
  <span className="flex-1 break-words">{option}</span>
  {/* icons */}
</div>
```

The key changes:
- `whitespace-normal` - Overrides any whitespace restrictions, allowing text to wrap
- `break-words` - Breaks long words if needed to prevent overflow
- `min-w-0` on the flex container - Allows flex children to shrink below their content size

---

### Files to Modify

| File | Change |
|------|--------|
| `src/components/features/learning/QuizInterface.tsx` | Add `whitespace-normal`, `break-words`, and `min-w-0` to option buttons and inner elements for proper text wrapping |

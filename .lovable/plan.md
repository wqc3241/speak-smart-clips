

## Fix Language Selector UI Layout

### Issue
On mobile/smaller screens, the "Regenerate Analysis" button drops to a new line and stretches to full width, creating an unbalanced visual appearance where the compact language selector sits above a wide button.

### Solution
Adjust the layout so all elements stay on one line when there's space, and on mobile, center the stacked elements for better visual balance.

### Changes

**File:** `src/components/dashboard/StudyTab.tsx`

Update the language selector card layout (lines 74-133):

| Current | Fix |
|---------|-----|
| Button uses `w-full sm:w-auto` | Remove `w-full`, keep button compact always |
| `flex-col sm:flex-row` stacking | Use `flex-wrap` to allow natural wrapping |
| `items-start sm:items-center` | Use `items-center` always for vertical alignment |

```tsx
{/* Language Selector */}
{currentProject.detectedLanguage && (
    <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Detected language:</span>
                <Select ...>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    ...
                </Select>
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={onRegenerateAnalysis}
                disabled={isProcessing}
            >
                {/* button content */}
            </Button>
        </div>
        ...
    </Card>
)}
```

### Result
- All elements stay on one line when there's room
- On narrow screens, elements wrap naturally without the button stretching
- Consistent vertical alignment
- Cleaner, more balanced appearance


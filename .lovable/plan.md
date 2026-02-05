

## Update Existing Project Titles with Real Video Titles

### Problem
The existing projects in your database have placeholder titles like "Video HFHu4GqfKPg" instead of actual YouTube video titles. This makes it hard to identify projects.

### Solution
Create a new edge function that:
1. Fetches all projects with placeholder titles (matching pattern "Video [videoId]")
2. Extracts the video ID from each project's YouTube URL
3. Fetches the actual title from Supadata metadata API
4. Updates each project with the real title

### Implementation

---

**1. Create `supabase/functions/migrate-project-titles/index.ts`**

New edge function that:
- Queries projects table for entries with placeholder titles
- For each project, extracts video ID from `youtube_url`
- Calls Supadata metadata API to get actual title
- Updates the project title in the database

```typescript
serve(async (req) => {
  // Get Supabase admin client
  // Query projects where title matches "Video [11-char-id]"
  // For each project:
  //   - Extract videoId from youtube_url
  //   - Fetch title from Supadata API
  //   - Update project title
  // Return summary of updated projects
});
```

---

**2. Add to `supabase/config.toml`**

```toml
[functions.migrate-project-titles]
verify_jwt = false
```

---

**3. Add a "Refresh Titles" button (optional)**

Could add a button in ProjectManager to trigger this migration, or run it once manually via curl.

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/migrate-project-titles/index.ts` | Create new edge function |
| `supabase/config.toml` | Add function configuration |

### Execution
After deployment, the function can be called once to update all existing project titles. The function will:
- Skip projects that already have proper titles
- Log progress for each project updated
- Return a summary showing how many projects were updated


-- Learning units table for storing AI-generated quiz units per project
CREATE TABLE learning_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  difficulty TEXT NOT NULL DEFAULT 'beginner'
    CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  questions JSONB NOT NULL DEFAULT '[]',
  question_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(questions)) STORED,
  is_completed BOOLEAN DEFAULT false,
  best_score INTEGER,
  attempts INTEGER DEFAULT 0,
  stars INTEGER DEFAULT 0 CHECK (stars >= 0 AND stars <= 3),
  last_attempted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id, unit_number)
);

-- Indexes
CREATE INDEX idx_learning_units_user_id ON learning_units(user_id);
CREATE INDEX idx_learning_units_project_id ON learning_units(project_id);

-- RLS
ALTER TABLE learning_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own learning units"
  ON learning_units FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learning units"
  ON learning_units FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning units"
  ON learning_units FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learning units"
  ON learning_units FOR DELETE USING (auth.uid() = user_id);

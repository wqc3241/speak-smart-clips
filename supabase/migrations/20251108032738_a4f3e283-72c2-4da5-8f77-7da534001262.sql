-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  script TEXT NOT NULL,
  vocabulary JSONB NOT NULL DEFAULT '[]',
  grammar JSONB NOT NULL DEFAULT '[]',
  practice_sentences JSONB NOT NULL DEFAULT '[]',
  detected_language TEXT,
  vocabulary_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(vocabulary)) STORED,
  grammar_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(grammar)) STORED,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_projects_youtube_url ON projects(youtube_url);
CREATE INDEX idx_projects_is_favorite ON projects(is_favorite);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies (public access for now)
CREATE POLICY "Allow public read access" ON projects
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON projects
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON projects
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON projects
  FOR DELETE USING (true);

-- Comments
COMMENT ON TABLE projects IS 'Language learning projects created from YouTube videos';
COMMENT ON COLUMN projects.youtube_url IS 'YouTube video URL - unique constraint prevents duplicates';
COMMENT ON COLUMN projects.vocabulary IS 'Array of vocabulary items extracted from the video';
COMMENT ON COLUMN projects.grammar IS 'Array of grammar rules identified in the video';
COMMENT ON COLUMN projects.practice_sentences IS 'AI-generated practice sentences using vocabulary and grammar';
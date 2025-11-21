-- Add status tracking columns to projects table
ALTER TABLE projects
ADD COLUMN status text DEFAULT 'completed',
ADD COLUMN job_id text,
ADD COLUMN error_message text;

-- Create indexes for efficient job polling
CREATE INDEX idx_projects_job_id ON projects(job_id);
CREATE INDEX idx_projects_status_user ON projects(status, user_id);

-- Add check constraint for valid status values
ALTER TABLE projects
ADD CONSTRAINT check_status_values 
CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
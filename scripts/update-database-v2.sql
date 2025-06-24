-- Add live updates table
CREATE TABLE IF NOT EXISTS live_updates (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  update_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add project settings table for file protection
CREATE TABLE IF NOT EXISTS project_settings (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(255) UNIQUE NOT NULL,
  protected_files JSONB DEFAULT '[]',
  readonly_files JSONB DEFAULT '[]',
  agent_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add deployment logs table
CREATE TABLE IF NOT EXISTS deployment_logs (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  logs TEXT,
  deployment_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add agent feedback table
CREATE TABLE IF NOT EXISTS agent_feedback (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  feedback_type VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  task_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_live_updates_project_time ON live_updates(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_project ON deployment_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_project ON agent_feedback(project_id);

-- Update projects table to include autonomous mode
ALTER TABLE projects ADD COLUMN IF NOT EXISTS autonomous_mode BOOLEAN DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS code_quality VARCHAR(20) DEFAULT 'standard';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_deployment TIMESTAMP;

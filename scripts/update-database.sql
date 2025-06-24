-- Add new columns to users table for profile information
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';

-- Create user_settings table for notification and preference settings
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT false,
  task_updates BOOLEAN DEFAULT true,
  deployment_alerts BOOLEAN DEFAULT true,
  weekly_reports BOOLEAN DEFAULT false,
  theme VARCHAR(20) DEFAULT 'light',
  auto_save BOOLEAN DEFAULT true,
  code_completion BOOLEAN DEFAULT true,
  autonomous_mode BOOLEAN DEFAULT true,
  auto_approve BOOLEAN DEFAULT false,
  code_quality VARCHAR(20) DEFAULT 'production',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

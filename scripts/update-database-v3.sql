-- Add tables for live updates and project settings
CREATE TABLE IF NOT EXISTS live_updates (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    update_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_settings (
    project_id VARCHAR(255) PRIMARY KEY,
    protected_files JSONB DEFAULT '[]'::jsonb,
    deployment_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_live_updates_project_id ON live_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_live_updates_created_at ON live_updates(created_at);

-- Add deployment tracking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_deployment TIMESTAMP;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deployment_platform VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS autonomous_mode BOOLEAN DEFAULT true;

-- Clean up old live updates (keep last 100 per project)
CREATE OR REPLACE FUNCTION cleanup_live_updates() RETURNS void AS $$
BEGIN
    DELETE FROM live_updates 
    WHERE id NOT IN (
        SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at DESC) as rn
            FROM live_updates
        ) t WHERE rn <= 100
    );
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-cleanup
CREATE OR REPLACE FUNCTION trigger_cleanup_live_updates() RETURNS trigger AS $$
BEGIN
    -- Only cleanup occasionally to avoid performance issues
    IF random() < 0.01 THEN
        PERFORM cleanup_live_updates();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cleanup_live_updates_trigger ON live_updates;
CREATE TRIGGER cleanup_live_updates_trigger
    AFTER INSERT ON live_updates
    FOR EACH ROW EXECUTE FUNCTION trigger_cleanup_live_updates();

-- Migration: Add Officer Assignment to Grievances & Internal Flag to Comments

ALTER TABLE grievances 
ADD COLUMN IF NOT EXISTS assigned_officer_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_grievances_assigned_officer_id ON grievances(assigned_officer_id);

ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_comments_is_internal ON comments(is_internal);

-- Rollback Migration for Officer Assignment & Internal Remarks

DROP INDEX IF EXISTS idx_comments_is_internal;
ALTER TABLE comments DROP COLUMN IF EXISTS is_internal;

DROP INDEX IF EXISTS idx_grievances_assigned_officer_id;
ALTER TABLE grievances DROP COLUMN IF EXISTS assigned_officer_id;

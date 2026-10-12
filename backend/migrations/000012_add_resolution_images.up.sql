ALTER TABLE grievance_updates ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

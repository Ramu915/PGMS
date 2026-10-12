CREATE TABLE IF NOT EXISTS grievance_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grievance_id UUID NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    note TEXT NOT NULL,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grievance_updates_grievance_id ON grievance_updates(grievance_id);

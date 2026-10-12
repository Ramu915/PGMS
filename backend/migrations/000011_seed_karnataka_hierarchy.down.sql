-- Rollback Migration for Karnataka Hierarchy & Address Routing

DROP INDEX IF EXISTS idx_grievances_jurisdiction;
ALTER TABLE grievances DROP COLUMN IF EXISTS landmark;
ALTER TABLE grievances DROP COLUMN IF EXISTS address;
ALTER TABLE grievances DROP COLUMN IF EXISTS taluk_id;
ALTER TABLE grievances DROP COLUMN IF EXISTS district_id;

DROP INDEX IF EXISTS idx_users_taluk;
DROP INDEX IF EXISTS idx_users_district;
ALTER TABLE users DROP COLUMN IF EXISTS department_id;
ALTER TABLE users DROP COLUMN IF EXISTS taluk_id;
ALTER TABLE users DROP COLUMN IF EXISTS district_id;
ALTER TABLE users DROP COLUMN IF EXISTS designation;
ALTER TABLE users DROP COLUMN IF EXISTS official_email;

DROP TABLE IF EXISTS taluks;
DROP TABLE IF EXISTS districts;

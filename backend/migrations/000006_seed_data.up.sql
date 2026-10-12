-- Seed initial default departments
INSERT INTO departments (name, code, description) VALUES
('Public Works (Roads)', 'PWD', 'Road maintenance, potholes, and traffic infrastructure'),
('Water Supply & Sewerage', 'WSS', 'Clean drinking water supply, pipeline leaks, and sewerage'),
('Electricity Board', 'EB', 'Power supply, transformers, and streetlight maintenance'),
('Sanitation & Waste Management', 'SWM', 'Garbage collection, street cleaning, and waste management'),
('Urban Drainage', 'UD', 'Stormwater drains, flood control, and canal maintenance')
ON CONFLICT (name) DO NOTHING;

-- Seed default System Admin user (Password: adminpassword123)
-- bcrypt hash for 'adminpassword123': $2a$10$j.JIJ8CNDX5ES8yD/GyYCOsvmNlb/IuJL/RSQYfrtcTc0Rwg.VXny
INSERT INTO users (email, password_hash, name, role) VALUES
('admin@pgms.gov.in', '$2a$10$j.JIJ8CNDX5ES8yD/GyYCOsvmNlb/IuJL/RSQYfrtcTc0Rwg.VXny', 'System Administrator', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Seed default Department Officers (Password: adminpassword123)
INSERT INTO users (email, password_hash, name, role, department_id) VALUES
('pwd.officer@pgms.gov.in', '$2a$10$j.JIJ8CNDX5ES8yD/GyYCOsvmNlb/IuJL/RSQYfrtcTc0Rwg.VXny', 'PWD Department Officer', 'department', (SELECT id FROM departments WHERE code = 'PWD' LIMIT 1)),
('wss.officer@pgms.gov.in', '$2a$10$j.JIJ8CNDX5ES8yD/GyYCOsvmNlb/IuJL/RSQYfrtcTc0Rwg.VXny', 'WSS Department Officer', 'department', (SELECT id FROM departments WHERE code = 'WSS' LIMIT 1)),
('eb.officer@pgms.gov.in', '$2a$10$j.JIJ8CNDX5ES8yD/GyYCOsvmNlb/IuJL/RSQYfrtcTc0Rwg.VXny', 'EB Department Officer', 'department', (SELECT id FROM departments WHERE code = 'EB' LIMIT 1))
ON CONFLICT (email) DO NOTHING;

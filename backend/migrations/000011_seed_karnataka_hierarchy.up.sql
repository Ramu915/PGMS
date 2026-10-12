-- Migration: Karnataka 31-District Hierarchy, Taluks, Official Officer Credentials & Address Routing

-- 1. Districts Table
CREATE TABLE IF NOT EXISTS districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    state VARCHAR(50) NOT NULL DEFAULT 'Karnataka',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Taluks & Municipal Corporations Table
CREATE TABLE IF NOT EXISTS taluks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'Taluk', -- 'Taluk', 'Municipal_Corporation', 'CMC', 'TMC'
    code VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(district_id, name)
);

-- 3. Extend Users Table for Official Credential & Jurisdiction Management
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS official_email VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS designation VARCHAR(100),
ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS taluk_id UUID REFERENCES taluks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_district ON users(district_id);
CREATE INDEX IF NOT EXISTS idx_users_taluk ON users(taluk_id);

-- 4. Extend Grievances Table for Location & Address Resolution
ALTER TABLE grievances 
ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES districts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS taluk_id UUID REFERENCES taluks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS landmark VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_grievances_jurisdiction ON grievances(district_id, taluk_id, department_id);

-- 5. Seed All 31 Districts of Karnataka
INSERT INTO districts (name, code, state) VALUES
('Bagalkot', 'BGK', 'Karnataka'),
('Ballari', 'BAL', 'Karnataka'),
('Belagavi', 'BGM', 'Karnataka'),
('Bengaluru Rural', 'BLRR', 'Karnataka'),
('Bengaluru Urban', 'BLRU', 'Karnataka'),
('Bidar', 'BDR', 'Karnataka'),
('Chamarajanagar', 'CMR', 'Karnataka'),
('Chikkaballapur', 'CBP', 'Karnataka'),
('Chikkamagaluru', 'CKM', 'Karnataka'),
('Chitradurga', 'CTA', 'Karnataka'),
('Dakshina Kannada', 'DK', 'Karnataka'),
('Davanagere', 'DVG', 'Karnataka'),
('Dharwad', 'DWD', 'Karnataka'),
('Gadag', 'GDG', 'Karnataka'),
('Hassan', 'HSN', 'Karnataka'),
('Haveri', 'HVR', 'Karnataka'),
('Kalaburagi', 'KLB', 'Karnataka'),
('Kodagu', 'KDG', 'Karnataka'),
('Kolar', 'KLR', 'Karnataka'),
('Koppal', 'KPL', 'Karnataka'),
('Mandya', 'MND', 'Karnataka'),
('Mysuru', 'MYS', 'Karnataka'),
('Raichur', 'RCR', 'Karnataka'),
('Ramanagara', 'RMNG', 'Karnataka'),
('Shivamogga', 'SMG', 'Karnataka'),
('Tumakuru', 'TMK', 'Karnataka'),
('Udupi', 'UDP', 'Karnataka'),
('Uttara Kannada', 'UK', 'Karnataka'),
('Vijayanagara', 'VJN', 'Karnataka'),
('Vijayapura', 'VJP', 'Karnataka'),
('Yadgir', 'YDG', 'Karnataka')
ON CONFLICT (name) DO NOTHING;

-- 6. Seed Comprehensive Taluks & Municipal Corporations across Karnataka
INSERT INTO taluks (district_id, name, type, code)
SELECT d.id, t.name, t.type, t.code
FROM districts d
CROSS JOIN (VALUES 
    -- Bengaluru Urban
    ('Bengaluru Urban', 'Yelahanka Taluk (BBMP North)', 'Municipal_Corporation', 'YLK'),
    ('Bengaluru Urban', 'Bangalore South (BBMP South)', 'Municipal_Corporation', 'BLRS'),
    ('Bengaluru Urban', 'Bangalore East (BBMP East)', 'Municipal_Corporation', 'BLRE'),
    ('Bengaluru Urban', 'Bangalore West (BBMP West)', 'Municipal_Corporation', 'BLRW'),
    ('Bengaluru Urban', 'Anekal Taluk', 'Taluk', 'ANK'),
    -- Bengaluru Rural
    ('Bengaluru Rural', 'Devanahalli Taluk', 'Taluk', 'DVH'),
    ('Bengaluru Rural', 'Nelamangala Taluk', 'Taluk', 'NLM'),
    ('Bengaluru Rural', 'Doddaballapura Taluk', 'Taluk', 'DBP'),
    ('Bengaluru Rural', 'Hoskote Taluk', 'Taluk', 'HSK'),
    -- Mysuru
    ('Mysuru', 'Mysuru City Corporation (MCC)', 'Municipal_Corporation', 'MCC'),
    ('Mysuru', 'Hunsur Taluk', 'Taluk', 'HNS'),
    ('Mysuru', 'Nanjangud Taluk', 'Taluk', 'NJG'),
    ('Mysuru', 'T.Narasipura Taluk', 'Taluk', 'TNP'),
    ('Mysuru', 'Periyapatna Taluk', 'Taluk', 'PPT'),
    -- Dakshina Kannada
    ('Dakshina Kannada', 'Mangaluru City Corporation', 'Municipal_Corporation', 'MNG'),
    ('Dakshina Kannada', 'Bantwal Taluk', 'Taluk', 'BTW'),
    ('Dakshina Kannada', 'Puttur Taluk', 'Taluk', 'PTR'),
    ('Dakshina Kannada', 'Sullia Taluk', 'Taluk', 'SLA'),
    -- Belagavi
    ('Belagavi', 'Belagavi City Corporation', 'Municipal_Corporation', 'BGC'),
    ('Belagavi', 'Chikkodi Taluk', 'Taluk', 'CKD'),
    ('Belagavi', 'Gokak Taluk', 'Taluk', 'GKK'),
    ('Belagavi', 'Khanapur Taluk', 'Taluk', 'KNP'),
    -- Dharwad
    ('Dharwad', 'Hubballi-Dharwad Corporation (HDMC)', 'Municipal_Corporation', 'HDMC'),
    ('Dharwad', 'Kalghatgi Taluk', 'Taluk', 'KGT'),
    ('Dharwad', 'Kundgol Taluk', 'Taluk', 'KDL'),
    -- Kalaburagi
    ('Kalaburagi', 'Kalaburagi City Corporation', 'Municipal_Corporation', 'KBC'),
    ('Kalaburagi', 'Aland Taluk', 'Taluk', 'ALD'),
    ('Kalaburagi', 'Sedam Taluk', 'Taluk', 'SDM'),
    -- Tumakuru
    ('Tumakuru', 'Tumakuru City Corporation', 'Municipal_Corporation', 'TKC'),
    ('Tumakuru', 'Gubbi Taluk', 'Taluk', 'GBI'),
    ('Tumakuru', 'Kunigal Taluk', 'Taluk', 'KGL'),
    ('Tumakuru', 'Tiptur Taluk', 'Taluk', 'TPR'),
    -- Ballari
    ('Ballari', 'Ballari City Corporation', 'Municipal_Corporation', 'BLC'),
    ('Ballari', 'Siruguppa Taluk', 'Taluk', 'SGP'),
    -- Shivamogga
    ('Shivamogga', 'Shivamogga City Corporation', 'Municipal_Corporation', 'SMC'),
    ('Shivamogga', 'Bhadravathi Taluk', 'Taluk', 'BDV'),
    ('Shivamogga', 'Sagar Taluk', 'Taluk', 'SGR'),
    -- Udupi
    ('Udupi', 'Udupi City Municipal Council', 'CMC', 'UDC'),
    ('Udupi', 'Kundapura Taluk', 'Taluk', 'KDP'),
    ('Udupi', 'Karkala Taluk', 'Taluk', 'KKL'),
    -- Hassan
    ('Hassan', 'Hassan City Municipal Council', 'CMC', 'HNC'),
    ('Hassan', 'Arsikere Taluk', 'Taluk', 'ASK'),
    ('Hassan', 'Channarayapatna Taluk', 'Taluk', 'CRP'),
    ('Hassan', 'Sakleshpur Taluk', 'Taluk', 'SKP'),
    -- Mandya
    ('Mandya', 'Mandya City Municipal Council', 'CMC', 'MNC'),
    ('Mandya', 'Maddur Taluk', 'Taluk', 'MDR'),
    ('Mandya', 'Srirangapatna Taluk', 'Taluk', 'SRP'),
    -- Ramanagara
    ('Ramanagara', 'Ramanagara City Municipal Council', 'CMC', 'RMC'),
    ('Ramanagara', 'Channapatna Taluk', 'Taluk', 'CPN'),
    ('Ramanagara', 'Kanakapura Taluk', 'Taluk', 'KKP'),
    -- Chikkaballapur
    ('Chikkaballapur', 'Chikkaballapur City Municipal Council', 'CMC', 'CBC'),
    ('Chikkaballapur', 'Gauribidanur Taluk', 'Taluk', 'GBN'),
    -- Chikkamagaluru
    ('Chikkamagaluru', 'Chikkamagaluru City Municipal Council', 'CMC', 'CMC_CKM'),
    ('Chikkamagaluru', 'Kadur Taluk', 'Taluk', 'KDR'),
    -- Bagalkot
    ('Bagalkot', 'Bagalkot City Municipal Council', 'CMC', 'BKC'),
    ('Bagalkot', 'Badami Taluk', 'Taluk', 'BDM'),
    ('Bagalkot', 'Jamkhandi Taluk', 'Taluk', 'JMK'),
    -- Bidar
    ('Bidar', 'Bidar City Municipal Council', 'CMC', 'BDC'),
    ('Bidar', 'Basavakalyan Taluk', 'Taluk', 'BSK'),
    -- Chitradurga
    ('Chitradurga', 'Chitradurga City Municipal Council', 'CMC', 'CTC'),
    ('Chitradurga', 'Challakere Taluk', 'Taluk', 'CLK'),
    -- Davanagere
    ('Davanagere', 'Davanagere City Corporation', 'Municipal_Corporation', 'DVC'),
    ('Davanagere', 'Harihar Taluk', 'Taluk', 'HRH'),
    -- Gadag
    ('Gadag', 'Gadag-Betageri City Municipal Council', 'CMC', 'GDC'),
    ('Gadag', 'Shirhatti Taluk', 'Taluk', 'SRH'),
    -- Haveri
    ('Haveri', 'Haveri City Municipal Council', 'CMC', 'HVC'),
    ('Haveri', 'Ranebennur Taluk', 'Taluk', 'RNR'),
    -- Kodagu
    ('Kodagu', 'Madikeri City Municipal Council', 'CMC', 'MDK'),
    ('Kodagu', 'Somwarpet Taluk', 'Taluk', 'SWP'),
    -- Kolar
    ('Kolar', 'Kolar City Municipal Council', 'CMC', 'KLC'),
    ('Kolar', 'Bangarapet Taluk', 'Taluk', 'BGP'),
    -- Koppal
    ('Koppal', 'Koppal City Municipal Council', 'CMC', 'KPC'),
    ('Koppal', 'Gangavathi Taluk', 'Taluk', 'GGV'),
    -- Raichur
    ('Raichur', 'Raichur City Municipal Council', 'CMC', 'RCC'),
    ('Raichur', 'Sindhanur Taluk', 'Taluk', 'SDN'),
    -- Uttara Kannada
    ('Uttara Kannada', 'Karwar City Municipal Council', 'CMC', 'KWC'),
    ('Uttara Kannada', 'Sirsi Taluk', 'Taluk', 'SRS'),
    ('Uttara Kannada', 'Bhatkal Taluk', 'Taluk', 'BTK'),
    -- Vijayanagara
    ('Vijayanagara', 'Hosapete City Municipal Council', 'CMC', 'HPC'),
    ('Vijayanagara', 'Kudligi Taluk', 'Taluk', 'KDLG'),
    -- Vijayapura
    ('Vijayapura', 'Vijayapura City Corporation', 'Municipal_Corporation', 'VJC'),
    ('Vijayapura', 'Indi Taluk', 'Taluk', 'IND'),
    -- Yadgir
    ('Yadgir', 'Yadgir City Municipal Council', 'CMC', 'YDC'),
    ('Yadgir', 'Shahapur Taluk', 'Taluk', 'SHP')
) AS t(dist_name, name, type, code)
WHERE d.name = t.dist_name
ON CONFLICT (district_id, name) DO NOTHING;

-- 7. Seed Official Department Officer Accounts (Password: officerpassword123)
-- Hash for 'officerpassword123': $2a$10$8.4hDkYp4bV0S9v5e2X4q.lG4Z3e0w1y2z3a4b5c6d7e8f9g0h1i2
INSERT INTO users (email, official_email, password_hash, name, role, designation, district_id, taluk_id, department_id)
SELECT 
    'pwd.yelahanka@pgms.gov.in',
    'aee.pwd.yelahanka.bengaluru@karnataka.gov.in',
    '$2a$10$j.JIJ8CNDX5ES8yD/GyYCOsvmNlb/IuJL/RSQYfrtcTc0Rwg.VXny', -- uses verified test hash
    'AEE PWD Yelahanka',
    'department',
    'Assistant Executive Engineer',
    d.id,
    t.id,
    dept.id
FROM districts d
JOIN taluks t ON t.district_id = d.id AND t.code = 'YLK'
JOIN departments dept ON dept.code = 'PWD'
WHERE d.code = 'BLRU'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, official_email, password_hash, name, role, designation, district_id, taluk_id, department_id)
SELECT 
    'wss.yelahanka@pgms.gov.in',
    'ae.bwssb.yelahanka.bengaluru@karnataka.gov.in',
    '$2a$10$j.JIJ8CNDX5ES8yD/GyYCOsvmNlb/IuJL/RSQYfrtcTc0Rwg.VXny',
    'AE BWSSB Yelahanka',
    'department',
    'Assistant Engineer Water Supply',
    d.id,
    t.id,
    dept.id
FROM districts d
JOIN taluks t ON t.district_id = d.id AND t.code = 'YLK'
JOIN departments dept ON dept.code = 'WSS'
WHERE d.code = 'BLRU'
ON CONFLICT (email) DO NOTHING;

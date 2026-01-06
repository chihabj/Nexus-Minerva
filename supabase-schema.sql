-- ===========================================
-- NEXUS CONNECT - DATABASE SCHEMA
-- Execute this SQL in Supabase SQL Editor
-- ===========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- TABLES
-- ===========================================

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  vehicle TEXT,
  vehicle_year INTEGER,
  last_visit DATE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Ready', 'Pending', 'Sent', 'Failed')),
  region TEXT,
  center_id UUID
);

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  reminder_date DATE NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Ready', 'Pending', 'Sent', 'Failed')),
  message TEXT,
  sent_at TIMESTAMPTZ
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'agent', 'system')),
  text TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  read_at TIMESTAMPTZ
);

-- Tech Centers table
CREATE TABLE IF NOT EXISTS tech_centers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  staff_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Connected', 'Pending', 'Disconnected')),
  region TEXT NOT NULL,
  address TEXT,
  phone TEXT
);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_centers ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for anon key - adjust for production)
CREATE POLICY "Allow all for clients" ON clients FOR ALL USING (true);
CREATE POLICY "Allow all for reminders" ON reminders FOR ALL USING (true);
CREATE POLICY "Allow all for messages" ON messages FOR ALL USING (true);
CREATE POLICY "Allow all for tech_centers" ON tech_centers FOR ALL USING (true);

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_reminders_client ON reminders(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

-- ===========================================
-- SAMPLE DATA
-- ===========================================

INSERT INTO clients (name, email, phone, vehicle, vehicle_year, status, region) VALUES
  ('John Smith', 'john@email.com', '+1234567890', 'Ford F-150', 2018, 'Ready', 'North'),
  ('Maria Garcia', 'maria@email.com', '+1234567891', 'Toyota Camry', 2020, 'Pending', 'South'),
  ('Robert Jones', 'robert@email.com', '+1234567892', 'Honda Civic', 2019, 'Sent', 'East'),
  ('Sarah Connor', 'sarah@email.com', '+1234567893', 'Jeep Wrangler', 2021, 'Ready', 'West');

-- Insert sample reminders (linked to clients)
INSERT INTO reminders (client_id, reminder_date, status, message)
SELECT id, CURRENT_DATE, status, 'Annual service reminder'
FROM clients;

-- Insert a tech center
INSERT INTO tech_centers (name, staff_count, status, region, address, phone) VALUES
  ('Paris Central', 12, 'Connected', 'Île-de-France', '123 Rue de Paris', '+33123456789'),
  ('Lyon Nord', 8, 'Connected', 'Auvergne-Rhône-Alpes', '45 Avenue des Lumières', '+33987654321');


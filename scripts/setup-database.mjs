import pg from 'pg';

const connectionString = 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';

const sslConfig = {
  rejectUnauthorized: false
};

const sql = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
`;

const enableRLS = `
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_centers ENABLE ROW LEVEL SECURITY;
`;

const createPolicies = `
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for clients') THEN
    CREATE POLICY "Allow all for clients" ON clients FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for reminders') THEN
    CREATE POLICY "Allow all for reminders" ON reminders FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for messages') THEN
    CREATE POLICY "Allow all for messages" ON messages FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for tech_centers') THEN
    CREATE POLICY "Allow all for tech_centers" ON tech_centers FOR ALL USING (true);
  END IF;
END $$;
`;

const createIndexes = `
CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_reminders_client ON reminders(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
`;

const insertSampleData = `
-- Check if data already exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM clients LIMIT 1) THEN
    INSERT INTO clients (name, email, phone, vehicle, vehicle_year, status, region) VALUES
      ('John Smith', 'john@email.com', '+1234567890', 'Ford F-150', 2018, 'Ready', 'North'),
      ('Maria Garcia', 'maria@email.com', '+1234567891', 'Toyota Camry', 2020, 'Pending', 'South'),
      ('Robert Jones', 'robert@email.com', '+1234567892', 'Honda Civic', 2019, 'Sent', 'East'),
      ('Sarah Connor', 'sarah@email.com', '+1234567893', 'Jeep Wrangler', 2021, 'Ready', 'West');
  END IF;
END $$;

-- Insert sample reminders
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM reminders LIMIT 1) THEN
    INSERT INTO reminders (client_id, reminder_date, status, message)
    SELECT id, CURRENT_DATE, status, 'Annual service reminder'
    FROM clients;
  END IF;
END $$;

-- Insert tech centers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tech_centers LIMIT 1) THEN
    INSERT INTO tech_centers (name, staff_count, status, region, address, phone) VALUES
      ('Paris Central', 12, 'Connected', 'Île-de-France', '123 Rue de Paris', '+33123456789'),
      ('Lyon Nord', 8, 'Connected', 'Auvergne-Rhône-Alpes', '45 Avenue des Lumières', '+33987654321');
  END IF;
END $$;
`;

async function setupDatabase() {
  const client = new pg.Client({ connectionString, ssl: sslConfig });
  
  try {
    console.log('🔌 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!');

    console.log('📦 Creating tables...');
    await client.query(sql);
    console.log('✅ Tables created!');

    console.log('🔒 Enabling Row Level Security...');
    await client.query(enableRLS);
    console.log('✅ RLS enabled!');

    console.log('📜 Creating policies...');
    await client.query(createPolicies);
    console.log('✅ Policies created!');

    console.log('📇 Creating indexes...');
    await client.query(createIndexes);
    console.log('✅ Indexes created!');

    console.log('📊 Inserting sample data...');
    await client.query(insertSampleData);
    console.log('✅ Sample data inserted!');

    console.log('\\n🎉 Database setup complete!');
    
    // Verify data
    const result = await client.query('SELECT COUNT(*) as count FROM clients');
    console.log(`📈 Total clients: ${result.rows[0].count}`);
    
    const remindersResult = await client.query('SELECT COUNT(*) as count FROM reminders');
    console.log(`📈 Total reminders: ${remindersResult.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\\n👋 Connection closed.');
  }
}

setupDatabase();


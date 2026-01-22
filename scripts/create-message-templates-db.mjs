import pg from 'pg';

const connectionString = 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';

const sslConfig = {
  rejectUnauthorized: false
};

const client = new pg.Client({
  connectionString,
  ssl: sslConfig
});

async function createMessageTemplatesTable() {
  console.log('🚀 Creating message_templates table and inserting default data...\n');

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Create the table
    console.log('1️⃣ Creating message_templates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        title VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        shortcut VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0
      );
    `);
    console.log('   ✅ Table created\n');

    // 2. Enable RLS
    console.log('2️⃣ Enabling Row Level Security...');
    await client.query(`ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;`);
    
    // Drop existing policy if exists
    await client.query(`DROP POLICY IF EXISTS "Allow all on message_templates" ON message_templates;`);
    
    // Create policy
    await client.query(`
      CREATE POLICY "Allow all on message_templates" ON message_templates
        FOR ALL USING (true) WITH CHECK (true);
    `);
    console.log('   ✅ RLS enabled with open policy\n');

    // 3. Create indexes
    console.log('3️⃣ Creating indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_message_templates_shortcut ON message_templates(shortcut);`);
    console.log('   ✅ Indexes created\n');

    // 4. Insert default templates
    console.log('4️⃣ Inserting default message templates...');
    
    // Clear existing templates first
    await client.query(`DELETE FROM message_templates;`);
    
    const insertQuery = `
      INSERT INTO message_templates (title, content, category, shortcut, sort_order, is_active) VALUES
      ('Salutation', 'Bonjour {{client_name}}, je suis votre conseiller Minerva CT. Comment puis-je vous aider ?', 'greeting', '/bonjour', 1, true),
      ('Confirmation RDV', 'Parfait {{client_name}} ! Votre rendez-vous est bien confirmé. Nous vous attendons avec plaisir. À très bientôt !', 'confirmation', '/rdv', 2, true),
      ('Rappel échéance', 'Bonjour {{client_name}}, pour rappel, le contrôle technique de votre {{vehicle}} arrive à échéance le {{due_date}}. Souhaitez-vous prendre rendez-vous ?', 'reminder', '/rappel', 3, true),
      ('Demande de créneaux', 'Avec plaisir ! Pourriez-vous me préciser le jour et l''heure qui vous conviendraient le mieux ?', 'general', '/creneau', 4, true),
      ('Demande de rappel', 'Bien sûr, je note votre demande de rappel. À quel numéro et à quelle heure préférez-vous être contacté(e) ?', 'general', '/rappeler', 5, true),
      ('Infos centre', 'Notre centre {{center_name}} est ouvert du lundi au samedi de 8h à 18h. L''adresse exacte vous sera envoyée avec la confirmation de RDV.', 'general', '/centre', 6, true),
      ('Prix contrôle technique', 'Le contrôle technique est à partir de 79€. Le tarif exact dépend du type de véhicule. Souhaitez-vous que je vérifie pour votre {{vehicle}} ?', 'general', '/prix', 7, true),
      ('Documents nécessaires', 'Pour votre contrôle technique, pensez à apporter : la carte grise du véhicule et l''ancien procès-verbal si contre-visite.', 'general', '/docs', 8, true),
      ('Remerciement', 'Merci {{client_name}} pour votre confiance ! N''hésitez pas si vous avez d''autres questions.', 'closing', '/merci', 9, true),
      ('Au revoir', 'Je vous remercie pour votre confiance. Excellente journée et à bientôt chez Minerva CT ! 🚗', 'closing', '/bye', 10, true)
      ON CONFLICT DO NOTHING;
    `;
    
    await client.query(insertQuery);
    console.log('   ✅ Default templates inserted\n');

    // 5. List all templates
    console.log('5️⃣ Current templates in database:');
    const { rows } = await client.query(`SELECT shortcut, title, category FROM message_templates ORDER BY sort_order;`);
    rows.forEach((row, i) => {
      console.log(`   ${i + 1}. [${row.shortcut}] ${row.title} (${row.category})`);
    });

    console.log('\n✅ Message templates setup complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

createMessageTemplatesTable();

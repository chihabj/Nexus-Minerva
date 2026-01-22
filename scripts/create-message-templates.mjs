import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load env from .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envFile = readFileSync(join(__dirname, '..', '.env.local'), 'utf-8');
  envFile.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
} catch (e) {
  console.log('Could not load .env.local, using environment variables');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createMessageTemplatesTable() {
  console.log('🚀 Creating message_templates table...\n');

  try {
    // 1. Create the table using raw SQL via RPC or direct query
    console.log('1️⃣ Creating table structure...');
    
    // Check if table exists first
    const { data: existingTable } = await supabase
      .from('message_templates')
      .select('id')
      .limit(1);

    if (existingTable !== null) {
      console.log('   ✅ Table already exists, skipping creation');
    } else {
      // Table doesn't exist, we need to create it via Supabase Dashboard or API
      console.log('   ⚠️ Table needs to be created via Supabase Dashboard');
      console.log('   Run this SQL in Supabase SQL Editor:\n');
      console.log(`
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

-- Enable RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for all authenticated users
CREATE POLICY "Allow all on message_templates" ON message_templates
  FOR ALL USING (true) WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);
CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active);
      `);
    }

    // 2. Insert default templates
    console.log('\n2️⃣ Inserting default message templates...');
    
    const defaultTemplates = [
      {
        title: 'Salutation',
        content: 'Bonjour {{client_name}}, je suis votre conseiller Minerva CT. Comment puis-je vous aider ?',
        category: 'greeting',
        shortcut: '/bonjour',
        sort_order: 1,
        is_active: true,
      },
      {
        title: 'Confirmation RDV',
        content: 'Parfait {{client_name}} ! Votre rendez-vous est bien confirmé. Nous vous attendons avec plaisir. À très bientôt !',
        category: 'confirmation',
        shortcut: '/rdv',
        sort_order: 2,
        is_active: true,
      },
      {
        title: 'Rappel échéance',
        content: 'Bonjour {{client_name}}, pour rappel, le contrôle technique de votre {{vehicle}} arrive à échéance le {{due_date}}. Souhaitez-vous prendre rendez-vous ?',
        category: 'reminder',
        shortcut: '/rappel',
        sort_order: 3,
        is_active: true,
      },
      {
        title: 'Demande de créneaux',
        content: 'Avec plaisir ! Pourriez-vous me préciser le jour et l\'heure qui vous conviendraient le mieux ?',
        category: 'general',
        shortcut: '/creneau',
        sort_order: 4,
        is_active: true,
      },
      {
        title: 'Demande de rappel',
        content: 'Bien sûr, je note votre demande de rappel. À quel numéro et à quelle heure préférez-vous être contacté(e) ?',
        category: 'general',
        shortcut: '/rappeler',
        sort_order: 5,
        is_active: true,
      },
      {
        title: 'Infos centre',
        content: 'Notre centre {{center_name}} est ouvert du lundi au samedi de 8h à 18h. L\'adresse exacte vous sera envoyée avec la confirmation de RDV.',
        category: 'general',
        shortcut: '/centre',
        sort_order: 6,
        is_active: true,
      },
      {
        title: 'Prix contrôle technique',
        content: 'Le contrôle technique est à partir de 79€. Le tarif exact dépend du type de véhicule. Souhaitez-vous que je vérifie pour votre {{vehicle}} ?',
        category: 'general',
        shortcut: '/prix',
        sort_order: 7,
        is_active: true,
      },
      {
        title: 'Documents nécessaires',
        content: 'Pour votre contrôle technique, pensez à apporter : la carte grise du véhicule et l\'ancien procès-verbal si contre-visite.',
        category: 'general',
        shortcut: '/docs',
        sort_order: 8,
        is_active: true,
      },
      {
        title: 'Remerciement',
        content: 'Merci {{client_name}} pour votre confiance ! N\'hésitez pas si vous avez d\'autres questions.',
        category: 'closing',
        shortcut: '/merci',
        sort_order: 9,
        is_active: true,
      },
      {
        title: 'Au revoir',
        content: 'Je vous remercie pour votre confiance. Excellente journée et à bientôt chez Minerva CT ! 🚗',
        category: 'closing',
        shortcut: '/bye',
        sort_order: 10,
        is_active: true,
      },
    ];

    // Try to insert templates
    const { data: insertedData, error: insertError } = await supabase
      .from('message_templates')
      .upsert(defaultTemplates, { 
        onConflict: 'shortcut',
        ignoreDuplicates: true 
      })
      .select();

    if (insertError) {
      console.log('   ⚠️ Insert error (table may not exist yet):', insertError.message);
      console.log('   Please create the table first using the SQL above, then run this script again.');
    } else {
      console.log(`   ✅ ${insertedData?.length || defaultTemplates.length} templates inserted/updated`);
    }

    // 3. List current templates
    console.log('\n3️⃣ Current templates in database:');
    const { data: templates, error: listError } = await supabase
      .from('message_templates')
      .select('*')
      .order('sort_order');

    if (listError) {
      console.log('   ⚠️ Could not list templates:', listError.message);
    } else if (templates) {
      templates.forEach((t, i) => {
        console.log(`   ${i + 1}. [${t.shortcut || '-'}] ${t.title} (${t.category})`);
      });
    }

    console.log('\n✅ Message templates setup complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createMessageTemplatesTable();

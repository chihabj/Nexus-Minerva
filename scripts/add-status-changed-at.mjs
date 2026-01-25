/**
 * Migration: Add status_changed_at column to reminders table
 * This enables tracking when status changes for KPIs like "Confirmed Today" and "Stagnant Cases"
 */

import pg from 'pg';

const connectionString = 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log('✅ Connecté\n');

    // 1. Add status_changed_at column
    console.log('📦 Ajout de la colonne status_changed_at...');
    await client.query(`
      ALTER TABLE reminders 
      ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT NOW();
    `);
    console.log('✅ Colonne ajoutée');

    // 2. Initialize with existing data (use sent_at or created_at since updated_at doesn't exist)
    console.log('📦 Initialisation des données existantes...');
    const { rowCount } = await client.query(`
      UPDATE reminders 
      SET status_changed_at = COALESCE(sent_at, last_reminder_at, created_at)
      WHERE status_changed_at IS NULL;
    `);
    console.log(`✅ ${rowCount} lignes mises à jour`);

    // 3. Create trigger function
    console.log('📦 Création de la fonction trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_status_changed_at()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
          NEW.status_changed_at = NOW();
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Fonction créée');

    // 4. Create trigger
    console.log('📦 Création du trigger...');
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_status_changed ON reminders;
    `);
    await client.query(`
      CREATE TRIGGER trigger_status_changed
        BEFORE UPDATE ON reminders
        FOR EACH ROW
        EXECUTE FUNCTION update_status_changed_at();
    `);
    console.log('✅ Trigger créé');

    // 5. Create indexes for performance
    console.log('📦 Création des index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reminders_status_changed_at ON reminders(status_changed_at);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reminders_due_date_status ON reminders(due_date, status);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_center_id ON clients(center_id);
    `);
    console.log('✅ Index créés');

    // 6. Verify
    console.log('\n📋 Vérification:');
    const { rows } = await client.query(`
      SELECT id, status, status_changed_at, sent_at, created_at
      FROM reminders
      LIMIT 5;
    `);
    console.table(rows);

    console.log('\n🎉 Migration terminée avec succès!');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

main();

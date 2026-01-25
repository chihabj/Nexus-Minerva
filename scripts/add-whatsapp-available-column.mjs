/**
 * Script pour ajouter la colonne whatsapp_available aux clients
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
    console.log('✅ Connecté à la base de données\n');

    // Ajouter la colonne whatsapp_available
    console.log('📝 Ajout de la colonne whatsapp_available...');
    
    await client.query(`
      ALTER TABLE clients 
      ADD COLUMN IF NOT EXISTS whatsapp_available BOOLEAN DEFAULT true;
    `);
    
    console.log('✅ Colonne whatsapp_available ajoutée (défaut: true)\n');

    // Vérifier
    const { rows } = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'clients' AND column_name = 'whatsapp_available';
    `);
    
    console.log('📋 Vérification:');
    console.table(rows);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 Connexion fermée');
  }
}

main();

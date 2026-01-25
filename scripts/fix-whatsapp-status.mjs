/**
 * Script pour réactiver whatsapp_available pour les clients affectés par erreur
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

    // Vérifier le statut actuel
    console.log('📋 Statut whatsapp_available actuel:');
    const { rows: before } = await client.query(`
      SELECT name, phone, whatsapp_available 
      FROM clients 
      ORDER BY created_at DESC;
    `);
    console.table(before);

    // Réactiver WhatsApp pour tous (reset)
    console.log('\n🔄 Réactivation de WhatsApp pour tous les clients...');
    await client.query(`
      UPDATE clients SET whatsapp_available = true;
    `);

    // Vérifier après
    console.log('\n📋 Statut après correction:');
    const { rows: after } = await client.query(`
      SELECT name, phone, whatsapp_available 
      FROM clients 
      ORDER BY created_at DESC;
    `);
    console.table(after);

    console.log('\n✅ Correction terminée!');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

main();

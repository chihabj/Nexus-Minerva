/**
 * Script pour corriger whatsapp_available basé sur les erreurs réelles de Meta
 * - 131026 = Message undeliverable (pas de WhatsApp) → false
 * - 131049 = Spam protection → garder true
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

    // Trouver les messages avec erreur 131026 (pas de WhatsApp)
    console.log('🔍 Recherche des messages avec erreur 131026 (pas de WhatsApp)...');
    const { rows: failedMessages } = await client.query(`
      SELECT DISTINCT c.client_id, cl.name, cl.phone, m.error_message
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN clients cl ON c.client_id = cl.id
      WHERE m.status = 'failed' 
        AND m.error_message LIKE '%131026%'
    `);

    console.log(`📋 ${failedMessages.length} client(s) sans WhatsApp détecté(s):`);
    console.table(failedMessages);

    // Désactiver WhatsApp pour ces clients
    if (failedMessages.length > 0) {
      const clientIds = failedMessages.map(m => m.client_id);
      
      console.log('\n🔄 Mise à jour de whatsapp_available = false pour ces clients...');
      
      for (const clientId of clientIds) {
        await client.query(`
          UPDATE clients SET whatsapp_available = false WHERE id = $1
        `, [clientId]);
      }
      
      console.log('✅ Mise à jour effectuée');
    }

    // Vérifier le résultat final
    console.log('\n📋 Statut final:');
    const { rows: final } = await client.query(`
      SELECT name, phone, whatsapp_available 
      FROM clients 
      ORDER BY whatsapp_available, name;
    `);
    console.table(final);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

main();

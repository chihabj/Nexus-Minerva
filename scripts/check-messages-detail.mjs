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

    console.log('📋 MESSAGES (avec wa_message_id):');
    const { rows: messages } = await client.query(`
      SELECT m.id, m.wa_message_id, m.conversation_id, m.direction, m.status, m.error_message,
             c.client_id, c.client_phone
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      ORDER BY m.created_at DESC;
    `);
    console.table(messages);

    // Vérifier spécifiquement le message failed pour Nonexistant
    console.log('\n📋 Message failed pour Nonexistant:');
    const { rows: failedMsg } = await client.query(`
      SELECT m.*, c.client_id, c.client_phone
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.status = 'failed' AND m.error_message LIKE '%131026%';
    `);
    console.table(failedMsg);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

main();

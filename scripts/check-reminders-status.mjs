/**
 * Script pour vérifier le statut des clients et reminders
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

    // 1. Clients
    console.log('📋 CLIENTS:');
    const { rows: clients } = await client.query(`
      SELECT id, name, phone, marque, modele, immatriculation, center_name, status, created_at
      FROM clients 
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    console.table(clients);

    // 2. Reminders
    console.log('\n📋 REMINDERS:');
    const { rows: reminders } = await client.query(`
      SELECT r.id, r.client_id, r.status, r.due_date, r.sent_at, r.message, r.created_at,
             c.name as client_name, c.phone as client_phone
      FROM reminders r
      LEFT JOIN clients c ON r.client_id = c.id
      ORDER BY r.created_at DESC
      LIMIT 10;
    `);
    console.table(reminders);

    // 3. Reminder Logs
    console.log('\n📋 REMINDER LOGS (derniers envois):');
    const { rows: logs } = await client.query(`
      SELECT * FROM reminder_logs 
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    if (logs.length > 0) {
      console.table(logs);
    } else {
      console.log('   Aucun log trouvé');
    }

    // 4. Messages
    console.log('\n📋 MESSAGES (derniers):');
    const { rows: messages } = await client.query(`
      SELECT id, direction, message_type, status, template_name, error_message, created_at
      FROM messages 
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    if (messages.length > 0) {
      console.table(messages);
    } else {
      console.log('   Aucun message trouvé');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

main();

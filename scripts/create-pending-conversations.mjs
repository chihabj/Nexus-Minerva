/**
 * Script pour créer des conversations "en attente" pour les clients 
 * dont les reminders sont bloqués en statut 'New' (échec de rate limit)
 * 
 * Usage: node scripts/create-pending-conversations.mjs
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

    // 1. Trouver tous les reminders en statut 'New' avec un numéro de téléphone valide
    console.log('🔍 Recherche des reminders bloqués en statut "New"...');
    const { rows: pendingReminders } = await client.query(`
      SELECT 
        r.id as reminder_id,
        r.client_id,
        r.status,
        r.due_date,
        c.name as client_name,
        c.phone as client_phone,
        c.center_name
      FROM reminders r
      JOIN clients c ON r.client_id = c.id
      WHERE r.status = 'New'
        AND c.phone IS NOT NULL 
        AND c.phone != ''
      ORDER BY r.due_date ASC;
    `);

    console.log(`📊 Trouvé ${pendingReminders.length} reminders bloqués avec numéro valide\n`);

    if (pendingReminders.length === 0) {
      console.log('✅ Aucun reminder bloqué à traiter.');
      return;
    }

    // 2. Vérifier quels clients ont déjà une conversation
    const clientIds = pendingReminders.map(r => r.client_id);
    const { rows: existingConversations } = await client.query(`
      SELECT client_id FROM conversations WHERE client_id = ANY($1);
    `, [clientIds]);

    const clientsWithConv = new Set(existingConversations.map(c => c.client_id));
    console.log(`📝 ${clientsWithConv.size} clients ont déjà une conversation\n`);

    // 3. Créer des conversations pour les clients qui n'en ont pas
    let created = 0;
    let skipped = 0;

    for (const reminder of pendingReminders) {
      if (clientsWithConv.has(reminder.client_id)) {
        skipped++;
        continue;
      }

      // Créer la conversation avec statut 'open' (seul statut autorisé)
      const { rows: [newConv] } = await client.query(`
        INSERT INTO conversations (
          client_id,
          client_phone,
          client_name,
          last_message,
          last_message_at,
          unread_count,
          status
        ) VALUES ($1, $2, $3, $4, NOW(), 0, 'open')
        RETURNING id;
      `, [
        reminder.client_id,
        reminder.client_phone,
        reminder.client_name,
        '[⏳ En attente d\'envoi] Relance WhatsApp à envoyer'
      ]);

      // Créer un message placeholder
      await client.query(`
        INSERT INTO messages (
          conversation_id,
          from_phone,
          to_phone,
          direction,
          message_type,
          content,
          status
        ) VALUES ($1, '33767668396', $2, 'outbound', 'template', $3, 'pending');
      `, [
        newConv.id,
        reminder.client_phone,
        `[En attente] Relance contrôle technique - ${reminder.center_name || 'Centre'}`
      ]);

      // Mettre à jour le statut du reminder en 'Pending' pour qu'il soit visible dans la TodoList
      await client.query(`
        UPDATE reminders SET status = 'Pending' WHERE id = $1;
      `, [reminder.reminder_id]);

      created++;
      console.log(`✅ Conversation créée pour ${reminder.client_name} (${reminder.client_phone})`);
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 RÉSUMÉ:`);
    console.log(`   - Conversations créées: ${created}`);
    console.log(`   - Déjà existantes (ignorées): ${skipped}`);
    console.log(`   - Reminders mis à jour en 'Pending': ${created}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Connexion fermée');
  }
}

main();

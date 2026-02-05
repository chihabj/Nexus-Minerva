/**
 * Script pour corriger les 48 conversations qui ont été créées avec le mauvais statut
 * Les WhatsApp ont été envoyés avec succès, mais les conversations montrent "en attente"
 * 
 * Ce script va:
 * 1. Mettre à jour les messages avec le bon contenu et statut "sent"
 * 2. Mettre à jour les reminders en statut "Reminder1_sent"
 * 3. Vérifier et signaler les doublons de conversations
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

    // 1. Trouver les conversations créées par le script (avec le message "en attente")
    console.log('🔍 Recherche des conversations à corriger...');
    const { rows: pendingConvs } = await client.query(`
      SELECT 
        c.id as conversation_id,
        c.client_id,
        c.client_phone,
        c.client_name,
        m.id as message_id,
        m.status as message_status,
        m.content as message_content,
        cl.center_name,
        r.id as reminder_id,
        r.status as reminder_status,
        r.due_date
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      LEFT JOIN clients cl ON cl.id = c.client_id
      LEFT JOIN reminders r ON r.client_id = c.client_id
      WHERE m.status = 'pending'
        OR m.content LIKE '%En attente%'
      ORDER BY c.created_at DESC;
    `);

    console.log(`📊 Trouvé ${pendingConvs.length} conversations à corriger\n`);

    if (pendingConvs.length === 0) {
      console.log('✅ Aucune conversation à corriger.');
      
      // Vérifier quand même les reminders en Pending
      const { rows: pendingReminders } = await client.query(`
        SELECT id, client_id, status FROM reminders WHERE status = 'Pending'
      `);
      
      if (pendingReminders.length > 0) {
        console.log(`\n⚠️ ${pendingReminders.length} reminders sont encore en statut 'Pending'`);
        console.log('Mise à jour vers Reminder1_sent...');
        
        await client.query(`
          UPDATE reminders 
          SET status = 'Reminder1_sent', 
              current_step = 1,
              sent_at = COALESCE(sent_at, NOW())
          WHERE status = 'Pending'
        `);
        console.log(`✅ ${pendingReminders.length} reminders mis à jour`);
      }
      return;
    }

    // 2. Vérifier les doublons de conversations (même client_id)
    console.log('🔍 Vérification des doublons...');
    const { rows: duplicates } = await client.query(`
      SELECT client_id, client_phone, COUNT(*) as count
      FROM conversations
      GROUP BY client_id, client_phone
      HAVING COUNT(*) > 1;
    `);

    if (duplicates.length > 0) {
      console.log(`⚠️ ${duplicates.length} clients ont des conversations en double:`);
      duplicates.forEach(d => console.log(`   - ${d.client_phone}: ${d.count} conversations`));
      console.log('');
    }

    // 3. Mettre à jour les messages avec le bon contenu
    console.log('📝 Mise à jour des messages...');
    let updatedMessages = 0;

    for (const conv of pendingConvs) {
      // Construire le contenu du message réel
      const centerName = conv.center_name || 'Saint-Maximin - Autosur';
      const dueDate = conv.due_date ? new Date(conv.due_date).toLocaleDateString('fr-FR') : 'N/A';
      
      const messageContent = `Madame, Monsieur,

Nous avons eu le plaisir de contrôler votre véhicule dans notre centre ${centerName}.

La validité de ce contrôle technique arrivant bientôt à échéance, le prochain devra s'effectuer avant le : ${dueDate}.

Nous vous invitons à prendre rendez-vous en ligne ou par téléphone.`;

      // Mettre à jour le message
      if (conv.message_id) {
        await client.query(`
          UPDATE messages 
          SET content = $1,
              status = 'sent',
              template_name = 'rappel_visite_technique_vf'
          WHERE id = $2
        `, [messageContent, conv.message_id]);
        updatedMessages++;
      }

      // Mettre à jour la conversation
      await client.query(`
        UPDATE conversations 
        SET last_message = '[Relance envoyée] Rappel contrôle technique',
            status = 'open'
        WHERE id = $1
      `, [conv.conversation_id]);

      // Mettre à jour le reminder
      if (conv.reminder_id && conv.reminder_status === 'Pending') {
        await client.query(`
          UPDATE reminders 
          SET status = 'Reminder1_sent',
              current_step = 1,
              sent_at = COALESCE(sent_at, NOW())
          WHERE id = $1
        `, [conv.reminder_id]);
      }
    }

    console.log(`✅ ${updatedMessages} messages mis à jour avec le contenu correct\n`);

    // 4. Mettre à jour tous les reminders Pending restants
    const { rows: remainingPending } = await client.query(`
      SELECT id FROM reminders WHERE status = 'Pending'
    `);

    if (remainingPending.length > 0) {
      await client.query(`
        UPDATE reminders 
        SET status = 'Reminder1_sent',
            current_step = 1,
            sent_at = COALESCE(sent_at, NOW())
        WHERE status = 'Pending'
      `);
      console.log(`✅ ${remainingPending.length} reminders supplémentaires mis à jour\n`);
    }

    // 5. Vérifier les réponses reçues (messages inbound)
    console.log('📥 Vérification des réponses reçues...');
    const { rows: inboundMessages } = await client.query(`
      SELECT 
        m.id,
        m.from_phone,
        m.content,
        m.created_at,
        c.client_name
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.direction = 'inbound'
      ORDER BY m.created_at DESC
      LIMIT 20;
    `);

    if (inboundMessages.length > 0) {
      console.log(`📬 ${inboundMessages.length} réponses reçues:`);
      inboundMessages.forEach(m => {
        console.log(`   - ${m.client_name || m.from_phone}: "${m.content?.substring(0, 50)}..." (${new Date(m.created_at).toLocaleString('fr-FR')})`);
      });
    } else {
      console.log('   Aucune réponse reçue pour le moment');
    }

    // 6. Résumé final
    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSUMÉ FINAL:');
    
    const { rows: [finalCounts] } = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM conversations) as conversations,
        (SELECT COUNT(*) FROM messages) as messages,
        (SELECT COUNT(*) FROM messages WHERE direction = 'inbound') as replies,
        (SELECT COUNT(*) FROM reminders WHERE status = 'Reminder1_sent') as sent_reminders,
        (SELECT COUNT(*) FROM reminders WHERE status = 'Pending') as pending_reminders
    `);

    console.log(`   - Conversations: ${finalCounts.conversations}`);
    console.log(`   - Messages total: ${finalCounts.messages}`);
    console.log(`   - Réponses reçues: ${finalCounts.replies}`);
    console.log(`   - Reminders envoyés: ${finalCounts.sent_reminders}`);
    console.log(`   - Reminders en attente: ${finalCounts.pending_reminders}`);
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

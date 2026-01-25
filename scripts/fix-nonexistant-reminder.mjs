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

    // Trouver les clients avec whatsapp_available = false et reminder pas en To_be_called
    console.log('🔍 Recherche des reminders à corriger...');
    const { rows } = await client.query(`
      SELECT r.id as reminder_id, r.status, c.name, c.phone, c.whatsapp_available
      FROM reminders r
      JOIN clients c ON r.client_id = c.id
      WHERE c.whatsapp_available = false
        AND r.status NOT IN ('To_be_called', 'Completed', 'Closed', 'Appointment_confirmed');
    `);
    console.table(rows);

    if (rows.length > 0) {
      console.log('\n🔄 Mise à jour des reminders...');
      for (const row of rows) {
        await client.query(`
          UPDATE reminders 
          SET status = 'To_be_called', 
              call_required = true,
              message = 'WhatsApp non délivré - Appel requis'
          WHERE id = $1
        `, [row.reminder_id]);
        console.log(`✅ Reminder ${row.reminder_id} mis à jour pour ${row.name}`);
      }
    }

    // Vérifier le résultat
    console.log('\n📋 Reminders après correction:');
    const { rows: final } = await client.query(`
      SELECT r.id, c.name, r.status, r.call_required, c.whatsapp_available
      FROM reminders r
      JOIN clients c ON r.client_id = c.id
      ORDER BY c.name;
    `);
    console.table(final);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

main();

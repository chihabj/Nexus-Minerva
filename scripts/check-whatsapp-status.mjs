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

    console.log('📋 Statut whatsapp_available:');
    const { rows } = await client.query(`
      SELECT id, name, phone, whatsapp_available
      FROM clients
      ORDER BY name;
    `);
    console.table(rows);

    console.log('\n📋 Notes système:');
    const { rows: notes } = await client.query(`
      SELECT cn.client_id, c.name, cn.content, cn.author, cn.created_at
      FROM client_notes cn
      JOIN clients c ON cn.client_id = c.id
      ORDER BY cn.created_at DESC;
    `);
    if (notes.length > 0) {
      console.table(notes);
    } else {
      console.log('Aucune note');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

main();

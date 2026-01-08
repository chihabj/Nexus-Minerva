import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  await client.connect();
  
  // List tables
  const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
  console.log('Tables:', tables.rows.map(x => x.table_name).join(', '));
  
  // List clients columns
  const cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clients' ORDER BY ordinal_position`);
  console.log('\\nClients columns:');
  cols.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
  
  await client.end();
}

checkSchema().catch(console.error);

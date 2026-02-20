import pg from 'pg';
import readline from 'readline';

const connectionString = 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';

const sslConfig = {
  rejectUnauthorized: false
};

const client = new pg.Client({
  connectionString,
  ssl: sslConfig
});

function askConfirmation(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function deleteTodayClients() {
  const targetDate = process.argv[2] || 'today';
  const dateFilter = targetDate === 'today'
    ? `created_at::date = CURRENT_DATE`
    : `created_at::date = '${targetDate}'`;

  console.log(`\n🗑️  Delete clients imported on: ${targetDate === 'today' ? 'TODAY' : targetDate}\n`);

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Preview: show clients that will be deleted
    const { rows: preview } = await client.query(`
      SELECT id, name, phone, center_name, created_at
      FROM clients
      WHERE ${dateFilter}
      ORDER BY created_at DESC;
    `);

    if (preview.length === 0) {
      console.log('ℹ️  No clients found for this date. Nothing to delete.');
      return;
    }

    console.log(`📊 Found ${preview.length} client(s) to delete:\n`);
    console.log('  ┌────────────────────────────┬──────────────────┬─────────────────────────┐');
    console.log('  │ Name                       │ Phone            │ Centre                  │');
    console.log('  ├────────────────────────────┼──────────────────┼─────────────────────────┤');
    for (const row of preview.slice(0, 20)) {
      const name = (row.name || '-').padEnd(26).slice(0, 26);
      const phone = (row.phone || '-').padEnd(16).slice(0, 16);
      const center = (row.center_name || '-').padEnd(23).slice(0, 23);
      console.log(`  │ ${name} │ ${phone} │ ${center} │`);
    }
    console.log('  └────────────────────────────┴──────────────────┴─────────────────────────┘');
    if (preview.length > 20) {
      console.log(`  ... and ${preview.length - 20} more\n`);
    }

    // Count related records
    const clientIds = preview.map(r => r.id);
    const idList = clientIds.map(id => `'${id}'`).join(',');

    const { rows: reminderCount } = await client.query(`SELECT COUNT(*) as count FROM reminders WHERE client_id IN (${idList});`);
    const { rows: noteCount } = await client.query(`SELECT COUNT(*) as count FROM client_notes WHERE client_id IN (${idList});`);
    const { rows: convCount } = await client.query(`SELECT COUNT(*) as count FROM conversations WHERE client_id IN (${idList});`);

    let messageCount = 0;
    let statusLogCount = 0;
    if (parseInt(convCount[0].count) > 0) {
      const { rows: msgCount } = await client.query(`
        SELECT COUNT(*) as count FROM messages
        WHERE conversation_id IN (SELECT id FROM conversations WHERE client_id IN (${idList}));
      `);
      messageCount = parseInt(msgCount[0].count);

      try {
        const { rows: logCount } = await client.query(`
          SELECT COUNT(*) as count FROM whatsapp_status_log
          WHERE message_id IN (
            SELECT id FROM messages
            WHERE conversation_id IN (SELECT id FROM conversations WHERE client_id IN (${idList}))
          );
        `);
        statusLogCount = parseInt(logCount[0].count);
      } catch { /* table might not exist */ }
    }

    // Check for reminder_logs
    let reminderLogCount = 0;
    try {
      const { rows: rLogCount } = await client.query(`
        SELECT COUNT(*) as count FROM reminder_logs
        WHERE reminder_id IN (SELECT id FROM reminders WHERE client_id IN (${idList}));
      `);
      reminderLogCount = parseInt(rLogCount[0].count);
    } catch { /* table might not exist */ }

    console.log('\n📋 Related records that will also be deleted:');
    console.log(`   • ${reminderCount[0].count} reminders`);
    console.log(`   • ${reminderLogCount} reminder logs`);
    console.log(`   • ${noteCount[0].count} client notes`);
    console.log(`   • ${messageCount} messages`);
    console.log(`   • ${statusLogCount} whatsapp status logs`);
    console.log(`   • ${convCount[0].count} conversations`);

    // Ask for confirmation
    const answer = await askConfirmation(`\n⚠️  Are you sure you want to delete ${preview.length} clients and all related data? (yes/no): `);

    if (answer !== 'yes' && answer !== 'y') {
      console.log('\n❌ Cancelled. No data was deleted.');
      return;
    }

    console.log('\n🔄 Deleting...\n');

    // Delete in FK-safe order
    console.log('1️⃣  Deleting whatsapp_status_log...');
    try {
      const { rowCount: r1 } = await client.query(`
        DELETE FROM whatsapp_status_log
        WHERE message_id IN (
          SELECT id FROM messages
          WHERE conversation_id IN (SELECT id FROM conversations WHERE client_id IN (${idList}))
        );
      `);
      console.log(`   ✅ ${r1 || 0} rows deleted\n`);
    } catch {
      console.log('   ⏭️  Table does not exist, skipping\n');
    }

    console.log('2️⃣  Deleting reminder_logs...');
    try {
      const { rowCount: r2 } = await client.query(`
        DELETE FROM reminder_logs
        WHERE reminder_id IN (SELECT id FROM reminders WHERE client_id IN (${idList}));
      `);
      console.log(`   ✅ ${r2 || 0} rows deleted\n`);
    } catch {
      console.log('   ⏭️  Table does not exist, skipping\n');
    }

    console.log('3️⃣  Deleting client_notes...');
    const { rowCount: r3 } = await client.query(`DELETE FROM client_notes WHERE client_id IN (${idList});`);
    console.log(`   ✅ ${r3 || 0} rows deleted\n`);

    console.log('4️⃣  Deleting messages...');
    const { rowCount: r4 } = await client.query(`
      DELETE FROM messages
      WHERE conversation_id IN (SELECT id FROM conversations WHERE client_id IN (${idList}));
    `);
    console.log(`   ✅ ${r4 || 0} rows deleted\n`);

    console.log('5️⃣  Deleting conversations...');
    const { rowCount: r5 } = await client.query(`DELETE FROM conversations WHERE client_id IN (${idList});`);
    console.log(`   ✅ ${r5 || 0} rows deleted\n`);

    console.log('6️⃣  Deleting reminders...');
    const { rowCount: r6 } = await client.query(`DELETE FROM reminders WHERE client_id IN (${idList});`);
    console.log(`   ✅ ${r6 || 0} rows deleted\n`);

    console.log('7️⃣  Deleting clients...');
    const { rowCount: r7 } = await client.query(`DELETE FROM clients WHERE ${dateFilter};`);
    console.log(`   ✅ ${r7 || 0} rows deleted\n`);

    // Verify
    const { rows: verifyRows } = await client.query(`SELECT COUNT(*) as count FROM clients WHERE ${dateFilter};`);
    console.log(`✅ Deletion complete! Remaining clients for this date: ${verifyRows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

deleteTodayClients();

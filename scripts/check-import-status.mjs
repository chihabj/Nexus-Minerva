import pg from 'pg';

const connectionString = 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';

const sslConfig = {
  rejectUnauthorized: false
};

const client = new pg.Client({
  connectionString,
  ssl: sslConfig
});

async function checkImportStatus() {
  console.log('🔍 Checking import status and WhatsApp sends...\n');

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Get all clients
    console.log('1️⃣ Clients in database:');
    const { rows: clients } = await client.query(`
      SELECT id, name, phone, last_visit, status, created_at
      FROM clients
      ORDER BY created_at DESC;
    `);
    
    clients.forEach((client, i) => {
      console.log(`   ${i + 1}. ${client.name || 'N/A'} (${client.phone})`);
      console.log(`      Status: ${client.status}`);
      console.log(`      Last visit: ${client.last_visit}`);
      console.log(`      Created: ${new Date(client.created_at).toLocaleString('fr-FR')}`);
    });
    console.log('');

    // 2. Get all reminders
    console.log('2️⃣ Reminders for these clients:');
    const { rows: reminders } = await client.query(`
      SELECT 
        r.id,
        r.client_id,
        c.name as client_name,
        c.phone as client_phone,
        r.due_date,
        r.status,
        r.current_step,
        r.sent_at,
        r.message_template,
        r.created_at
      FROM reminders r
      JOIN clients c ON r.client_id = c.id
      ORDER BY r.created_at DESC;
    `);
    
    reminders.forEach((reminder, i) => {
      const today = new Date();
      const dueDate = new Date(reminder.due_date);
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`   ${i + 1}. ${reminder.client_name || reminder.client_phone}`);
      console.log(`      Due date: ${reminder.due_date} (${daysUntilDue > 0 ? `J+${daysUntilDue}` : `J${daysUntilDue}`} jours)`);
      console.log(`      Status: ${reminder.status}`);
      console.log(`      Current step: ${reminder.current_step}`);
      console.log(`      Message template: ${reminder.message_template || 'N/A'}`);
      console.log(`      Sent at: ${reminder.sent_at ? new Date(reminder.sent_at).toLocaleString('fr-FR') : '❌ NOT SENT'}`);
      console.log(`      Created: ${new Date(reminder.created_at).toLocaleString('fr-FR')}`);
      
      if (daysUntilDue <= 30 && daysUntilDue >= 0) {
        if (reminder.status === 'Reminder1_sent' && reminder.sent_at) {
          console.log(`      ✅ WhatsApp should have been sent (due in ${daysUntilDue} days)`);
        } else {
          console.log(`      ⚠️ WhatsApp should have been sent but status is ${reminder.status} and sent_at is ${reminder.sent_at ? 'set' : 'NULL'}`);
        }
      } else if (daysUntilDue < 0) {
        console.log(`      ⚠️ OVERDUE (${Math.abs(daysUntilDue)} days late) - Should have been sent immediately`);
        if (reminder.status === 'Reminder1_sent' && reminder.sent_at) {
          console.log(`      ✅ WhatsApp was sent`);
        } else {
          console.log(`      ❌ WhatsApp was NOT sent - Status: ${reminder.status}, sent_at: ${reminder.sent_at || 'NULL'}`);
        }
      } else {
        console.log(`      ℹ️ Due in ${daysUntilDue} days - Will be sent by cron at J-30`);
      }
      console.log('');
    });

    // 3. Check reminder_logs for sent messages
    console.log('3️⃣ Reminder logs (WhatsApp sends):');
    const { rows: logs } = await client.query(`
      SELECT 
        rl.id,
        rl.reminder_id,
        c.name as client_name,
        c.phone as client_phone,
        rl.action_type,
        rl.status,
        rl.sent_at,
        rl.error_message,
        rl.created_at
      FROM reminder_logs rl
      JOIN reminders r ON rl.reminder_id = r.id
      JOIN clients c ON r.client_id = c.id
      ORDER BY rl.created_at DESC
      LIMIT 20;
    `);
    
    if (logs.length === 0) {
      console.log('   ⚠️ No reminder logs found');
    } else {
      logs.forEach((log, i) => {
        console.log(`   ${i + 1}. ${log.client_name || log.client_phone}`);
        console.log(`      Action: ${log.action_type}`);
        console.log(`      Status: ${log.status}`);
        console.log(`      Sent at: ${log.sent_at ? new Date(log.sent_at).toLocaleString('fr-FR') : 'N/A'}`);
        if (log.error_message) {
          console.log(`      ❌ Error: ${log.error_message}`);
        }
        console.log(`      Created: ${new Date(log.created_at).toLocaleString('fr-FR')}`);
        console.log('');
      });
    }

    // 4. Summary
    console.log('4️⃣ Summary:');
    const overdueCount = reminders.filter(r => {
      const today = new Date();
      const dueDate = new Date(r.due_date);
      return dueDate < today;
    }).length;
    
    const sentCount = reminders.filter(r => r.sent_at !== null).length;
    const shouldHaveBeenSent = reminders.filter(r => {
      const today = new Date();
      const dueDate = new Date(r.due_date);
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDue <= 30 && daysUntilDue >= 0;
    }).length;
    
    console.log(`   Total clients: ${clients.length}`);
    console.log(`   Total reminders: ${reminders.length}`);
    console.log(`   Overdue reminders: ${overdueCount}`);
    console.log(`   Reminders that should have been sent (≤30 days): ${shouldHaveBeenSent}`);
    console.log(`   Reminders with sent_at set: ${sentCount}`);
    
    if (shouldHaveBeenSent > sentCount) {
      console.log(`   ⚠️ WARNING: ${shouldHaveBeenSent - sentCount} reminders should have been sent but weren't!`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

checkImportStatus();

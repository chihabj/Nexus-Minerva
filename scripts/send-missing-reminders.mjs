import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load env
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envFile = readFileSync(join(__dirname, '..', '.env.local'), 'utf-8');
  envFile.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
} catch (e) {
  console.log('Could not load .env.local, using environment variables');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const whatsappToken = process.env.VITE_WHATSAPP_API_TOKEN;
const whatsappPhoneId = process.env.VITE_WHATSAPP_PHONE_ID;

const supabase = createClient(supabaseUrl, supabaseKey);

const connectionString = 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';
const sslConfig = { rejectUnauthorized: false };
const client = new pg.Client({ connectionString, ssl: sslConfig });

async function sendWhatsAppTemplate(to, clientName, vehicleName, dateEcheance) {
  const cleanedPhone = to.replace(/[^\d]/g, '').replace(/^\+/, '');
  
  const response = await fetch(
    `https://graph.facebook.com/v17.0/${whatsappPhoneId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanedPhone,
        type: 'template',
        template: {
          name: 'rappel_visite_technique_vf',
          language: { code: 'fr' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: clientName || 'Client' },
                { type: 'text', text: vehicleName || 'Votre véhicule' },
                { type: 'text', text: dateEcheance },
              ],
            },
          ],
        },
      }),
    }
  );

  const data = await response.json();
  return { success: response.ok, messageId: data.messages?.[0]?.id, error: data.error?.message };
}

async function sendMissingReminders() {
  console.log('📤 Sending missing reminders for overdue clients...\n');

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get reminders that should have been sent
    const { rows: reminders } = await client.query(`
      SELECT 
        r.id,
        r.client_id,
        r.due_date,
        r.status,
        r.current_step,
        c.name as client_name,
        c.phone as client_phone,
        c.vehicle
      FROM reminders r
      JOIN clients c ON r.client_id = c.id
      WHERE r.status = 'New'
        AND r.due_date <= CURRENT_DATE + INTERVAL '30 days'
        AND c.phone IS NOT NULL
      ORDER BY r.due_date ASC;
    `);

    if (reminders.length === 0) {
      console.log('✅ No missing reminders to send\n');
      return;
    }

    console.log(`Found ${reminders.length} reminders to process\n`);

    for (const reminder of reminders) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(reminder.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let newStatus, newStep;
      let shouldSend = false;

      // Same logic as import: J-30 to J-15 → Reminder1, including overdue within 30 days
      if (daysUntilDue > 15 || (daysUntilDue <= 0 && daysUntilDue >= -30)) {
        newStatus = 'Reminder1_sent';
        newStep = 1;
        shouldSend = true;
      } else if (daysUntilDue > 7) {
        newStatus = 'Reminder2_sent';
        newStep = 2;
        shouldSend = true;
      } else if (daysUntilDue > 3) {
        newStatus = 'Reminder3_sent';
        newStep = 3;
        shouldSend = true;
      } else {
        newStatus = 'To_be_called';
        newStep = 4;
        shouldSend = false;
      }

      const formattedDueDate = dueDate.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      if (shouldSend) {
        console.log(`📤 Sending WhatsApp to ${reminder.client_name || reminder.client_phone} (${daysUntilDue} days until due)...`);
        
        const result = await sendWhatsAppTemplate(
          reminder.client_phone,
          reminder.client_name || 'Client',
          reminder.vehicle || 'Votre véhicule',
          formattedDueDate
        );

        if (result.success) {
          console.log(`   ✅ Sent successfully (${result.messageId})`);
          
          // Update reminder
          await supabase
            .from('reminders')
            .update({
              status: newStatus,
              current_step: newStep,
              sent_at: new Date().toISOString(),
            })
            .eq('id', reminder.id);
        } else {
          console.log(`   ❌ Failed: ${result.error}`);
        }
      } else {
        console.log(`📞 Marking ${reminder.client_name || reminder.client_phone} as To_be_called (${daysUntilDue} days until due)...`);
        
        await supabase
          .from('reminders')
          .update({
            status: newStatus,
            current_step: newStep,
            call_required: true,
          })
          .eq('id', reminder.id);
      }
    }

    console.log('\n✅ Missing reminders processed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

sendMissingReminders();

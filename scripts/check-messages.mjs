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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://aefzpamcvbzzcgwkuita.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMessages() {
  console.log('🔍 Checking messages in database...\n');

  // 1. Check all conversations
  console.log('📋 Conversations:');
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false });

  if (convError) {
    console.error('❌ Error fetching conversations:', convError);
    return;
  }

  console.log(`Found ${conversations?.length || 0} conversations\n`);
  
  if (conversations && conversations.length > 0) {
    conversations.forEach((conv, idx) => {
      console.log(`${idx + 1}. ${conv.client_name || conv.client_phone} (ID: ${conv.id})`);
      console.log(`   Last message: ${conv.last_message || 'N/A'}`);
      console.log(`   Last message at: ${conv.last_message_at || 'N/A'}`);
      console.log(`   Unread: ${conv.unread_count || 0}\n`);
    });

    // 2. Check messages for each conversation
    console.log('\n📨 Messages by conversation:');
    for (const conv of conversations) {
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });

      if (msgError) {
        console.error(`❌ Error fetching messages for conversation ${conv.id}:`, msgError);
        continue;
      }

      console.log(`\nConversation: ${conv.client_name || conv.client_phone} (${conv.id})`);
      console.log(`  Messages found: ${messages?.length || 0}`);
      
      if (messages && messages.length > 0) {
        messages.forEach((msg, idx) => {
          console.log(`  ${idx + 1}. [${msg.direction}] ${msg.content?.substring(0, 50) || `[${msg.message_type}]`} (${msg.created_at})`);
        });
      } else {
        console.log('  ⚠️ No messages found for this conversation');
      }
    }
  } else {
    console.log('⚠️ No conversations found');
  }

  // 3. Check all messages (regardless of conversation)
  console.log('\n\n📊 All messages in database:');
  const { data: allMessages, error: allMsgError } = await supabase
    .from('messages')
    .select('*, conversation:conversations(*)')
    .order('created_at', { ascending: false })
    .limit(20);

  if (allMsgError) {
    console.error('❌ Error fetching all messages:', allMsgError);
    return;
  }

  console.log(`Total messages found: ${allMessages?.length || 0}\n`);
  
  if (allMessages && allMessages.length > 0) {
    allMessages.forEach((msg, idx) => {
      const conv = msg.conversation;
      console.log(`${idx + 1}. [${msg.direction}] ${msg.content?.substring(0, 50) || `[${msg.message_type}]`}`);
      console.log(`   Conversation: ${conv?.client_name || conv?.client_phone || 'N/A'} (${msg.conversation_id})`);
      console.log(`   Created: ${msg.created_at}\n`);
    });
  } else {
    console.log('⚠️ No messages found in database');
  }
}

checkMessages()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

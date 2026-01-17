import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://aefzpamcvbzzcgwkuita.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZnpwYW1jdmJ6emNnd2t1aXRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY4NTkwOCwiZXhwIjoyMDgzMjYxOTA4fQ.Q1s_5dc37-HkKomDlbmet5SixnYoHcdA0g8yhFNCx-w'
);

async function cleanup() {
  console.log('🧹 Suppression des données de test...\n');
  
  // Delete messages first (foreign key)
  const { error: msgErr, count: msgCount } = await supabase
    .from('messages')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (msgErr) console.log('❌ Messages error:', msgErr.message);
  else console.log('✅ Messages supprimés');
  
  // Delete conversations
  const { error: convErr } = await supabase
    .from('conversations')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (convErr) console.log('❌ Conversations error:', convErr.message);
  else console.log('✅ Conversations supprimées');
  
  // Verify
  const { data: convs } = await supabase.from('conversations').select('id');
  const { data: msgs } = await supabase.from('messages').select('id');
  console.log('\n📊 État actuel:');
  console.log('- Conversations:', convs?.length || 0);
  console.log('- Messages:', msgs?.length || 0);
}

cleanup();

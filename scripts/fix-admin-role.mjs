import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://aefzpamcvbzzcgwkuita.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZnpwYW1jdmJ6emNnd2t1aXRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY4NTkwOCwiZXhwIjoyMDgzMjYxOTA4fQ.Q1s_5dc37-HkKomDlbmet5SixnYoHcdA0g8yhFNCx-w'
);

async function fixAdminRole() {
  // Update admin role
  const { error } = await supabase
    .from('user_profiles')
    .update({ role: 'admin', full_name: 'Admin Minerva' })
    .eq('email', 'admin@minerva-ct.fr');

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('✅ admin@minerva-ct.fr role updated to "admin"');
  }

  // Display all users
  const { data } = await supabase
    .from('user_profiles')
    .select('email, full_name, role, is_active')
    .order('created_at', { ascending: true });

  console.log('\n📋 All users:');
  console.table(data);
}

fixAdminRole();

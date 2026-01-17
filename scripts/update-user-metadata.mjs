import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://aefzpamcvbzzcgwkuita.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZnpwYW1jdmJ6emNnd2t1aXRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY4NTkwOCwiZXhwIjoyMDgzMjYxOTA4fQ.Q1s_5dc37-HkKomDlbmet5SixnYoHcdA0g8yhFNCx-w'
);

async function updateMetadata() {
  console.log('📝 Updating user metadata...\n');

  const users = [
    { email: 'superadmin@minerva-ct.fr', full_name: 'Super Admin', role: 'superadmin' },
    { email: 'admin@minerva-ct.fr', full_name: 'Admin Minerva', role: 'admin' },
    { email: 'agent@minerva-ct.fr', full_name: 'Agent Minerva', role: 'agent' },
  ];

  for (const user of users) {
    // Get user by email
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
    const authUser = authUsers.find(u => u.email === user.email);
    
    if (authUser) {
      // Update metadata
      const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          full_name: user.full_name,
          role: user.role,
        }
      });

      if (error) {
        console.log(`❌ Error updating ${user.email}:`, error.message);
      } else {
        console.log(`✅ ${user.email} - metadata updated (${user.role})`);
      }
    } else {
      console.log(`⚠️ User ${user.email} not found`);
    }
  }

  console.log('\n✅ Done!');
}

updateMetadata();

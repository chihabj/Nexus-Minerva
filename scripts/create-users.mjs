// Script to create users with different roles
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aefzpamcvbzzcgwkuita.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZnpwYW1jdmJ6emNnd2t1aXRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY4NTkwOCwiZXhwIjoyMDgzMjYxOTA4fQ.Q1s_5dc37-HkKomDlbmet5SixnYoHcdA0g8yhFNCx-w';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const users = [
  {
    email: 'superadmin@minerva-ct.fr',
    password: 'superadmin123',
    full_name: 'Super Admin',
    role: 'superadmin'
  },
  {
    email: 'admin@minerva-ct.fr',
    password: 'admin123',
    full_name: 'Admin Minerva',
    role: 'admin'
  },
  {
    email: 'agent@minerva-ct.fr',
    password: 'agent123',
    full_name: 'Agent Minerva',
    role: 'agent'
  }
];

async function createUsers() {
  console.log('👥 Creating users...\n');

  for (const user of users) {
    console.log(`📝 Creating ${user.role}: ${user.email}`);
    
    // Check if user already exists
    const { data: existingUsers } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('email', user.email);
    
    if (existingUsers && existingUsers.length > 0) {
      console.log(`   ⚠️ User ${user.email} already exists, skipping...\n`);
      continue;
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        full_name: user.full_name,
        role: user.role
      }
    });

    if (authError) {
      console.error(`   ❌ Error creating auth user: ${authError.message}\n`);
      continue;
    }

    console.log(`   ✅ Auth user created: ${authData.user.id}`);

    // Create or update user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: authData.user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (profileError) {
      console.error(`   ❌ Error creating profile: ${profileError.message}\n`);
    } else {
      console.log(`   ✅ Profile created with role: ${user.role}\n`);
    }
  }

  // Display all users
  console.log('\n📋 All users in database:');
  const { data: allUsers } = await supabase
    .from('user_profiles')
    .select('email, full_name, role, is_active')
    .order('role', { ascending: true });

  if (allUsers) {
    console.table(allUsers);
  }

  console.log('\n✅ Done!');
}

createUsers().catch(console.error);

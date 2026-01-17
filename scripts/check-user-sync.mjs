import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://aefzpamcvbzzcgwkuita.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZnpwYW1jdmJ6emNnd2t1aXRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY4NTkwOCwiZXhwIjoyMDgzMjYxOTA4fQ.Q1s_5dc37-HkKomDlbmet5SixnYoHcdA0g8yhFNCx-w'
);

async function checkSync() {
  console.log('🔍 Checking user synchronization...\n');

  // Get all auth users
  const { data: authData } = await supabase.auth.admin.listUsers();
  const authUsers = authData.users;
  
  console.log('📋 Auth Users:');
  authUsers.forEach(u => console.log(`  - ${u.id} | ${u.email}`));

  // Get all profiles
  const { data: profiles } = await supabase.from('user_profiles').select('id, email, role');
  
  console.log('\n📋 Profiles:');
  profiles.forEach(p => console.log(`  - ${p.id} | ${p.email} (${p.role})`));

  // Check for mismatches and fix them
  console.log('\n🔍 Checking ID matches and fixing...');
  
  for (const authUser of authUsers) {
    const profile = profiles.find(p => p.email === authUser.email);
    
    if (!profile) {
      console.log(`  ⚠️ No profile for ${authUser.email} - creating one`);
      
      // Determine role from metadata or default
      const role = authUser.user_metadata?.role || 'agent';
      const fullName = authUser.user_metadata?.full_name || authUser.email.split('@')[0];
      
      await supabase.from('user_profiles').insert({
        id: authUser.id,
        email: authUser.email,
        full_name: fullName,
        role: role,
        is_active: true
      });
      console.log(`     ✅ Created profile for ${authUser.email} with role ${role}`);
      
    } else if (profile.id !== authUser.id) {
      console.log(`  ❌ ID MISMATCH for ${authUser.email}`);
      console.log(`     Auth ID:    ${authUser.id}`);
      console.log(`     Profile ID: ${profile.id}`);
      console.log(`     Fixing...`);
      
      // Update profile ID to match auth ID
      await supabase.from('user_profiles').delete().eq('id', profile.id);
      await supabase.from('user_profiles').insert({
        id: authUser.id,
        email: profile.email,
        full_name: profile.full_name || authUser.email.split('@')[0],
        role: profile.role,
        is_active: true
      });
      console.log(`     ✅ Fixed! Profile now has correct ID`);
      
    } else {
      console.log(`  ✅ ${authUser.email} - IDs match`);
    }
  }

  // Final check
  console.log('\n\n📊 Final state:');
  const { data: finalProfiles } = await supabase.from('user_profiles').select('id, email, full_name, role');
  console.table(finalProfiles);
}

checkSync();

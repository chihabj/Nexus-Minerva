/**
 * Creates the first superadmin user
 * Run this script once to create the initial admin account
 * 
 * Usage: node scripts/create-superadmin.mjs <email> <password> <full_name>
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aefzpamcvbzzcgwkuita.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZnpwYW1jdmJ6emNnd2t1aXRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY4NTkwOCwiZXhwIjoyMDgzMjYxOTA4fQ.Q1s_5dc37-HkKomDlbmet5SixnYoHcdA0g8yhFNCx-w';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const email = process.argv[2] || 'admin@minerva-ct.fr';
  const password = process.argv[3] || 'Minerva2024!';
  const fullName = process.argv[4] || 'Admin Minerva';

  console.log('🔄 Creating superadmin user...\n');
  console.log(`Email: ${email}`);
  console.log(`Name: ${fullName}`);
  console.log('');

  try {
    // Create user via Admin API
    const { data: user, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'superadmin',
      },
    });

    if (createError) {
      if (createError.message.includes('already been registered')) {
        console.log('⚠️ User already exists. Updating role to superadmin...');
        
        // Get user by email
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;
        
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
          // Update the user profile to superadmin
          await supabase
            .from('user_profiles')
            .upsert({
              id: existingUser.id,
              email: email,
              full_name: fullName,
              role: 'superadmin',
              is_active: true,
            });
          
          console.log('✅ User updated to superadmin!');
        }
      } else {
        throw createError;
      }
    } else {
      console.log('✅ Superadmin user created successfully!');
      console.log(`User ID: ${user.user.id}`);
    }

    console.log('\n📋 Login credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('\n🚀 You can now login at: https://nexus-minerva.vercel.app/#/login');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();

// Fix Supabase environment variables on Vercel
const VERCEL_TOKEN = 'h3JH04ItPhvmCMK1HzCsqHaw';
const PROJECT_NAME = 'nexus-minerva';

// Correct Supabase values
const SUPABASE_URL = 'https://aefzpamcvbzzcgwkuita.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZnpwYW1jdmJ6emNnd2t1aXRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2ODU5MDgsImV4cCI6MjA4MzI2MTkwOH0.MK_StcNp-QkYsbrrb4ut_ZI7mzAzG1TCm0jAV_bRKos';

async function fixSupabaseEnv() {
  console.log('🔧 Fixing Supabase environment variables on Vercel...\n');

  // Get existing env vars
  const listResponse = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_NAME}/env`, {
    headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
  });
  const listData = await listResponse.json();

  // Delete old VITE_SUPABASE vars
  const oldVars = listData.envs?.filter(e => 
    e.key === 'VITE_SUPABASE_URL' || e.key === 'VITE_SUPABASE_ANON_KEY'
  ) || [];

  console.log(`Found ${oldVars.length} existing VITE_SUPABASE_* entries`);

  for (const env of oldVars) {
    console.log(`  Deleting ${env.key} (${env.id})`);
    await fetch(`https://api.vercel.com/v9/projects/${PROJECT_NAME}/env/${env.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
    });
  }

  // Create new vars with correct values
  console.log('\n📝 Creating new environment variables...');

  // VITE_SUPABASE_URL
  const urlResponse = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_NAME}/env`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: 'VITE_SUPABASE_URL',
      value: SUPABASE_URL,
      type: 'plain',
      target: ['production', 'preview', 'development']
    })
  });
  const urlData = await urlResponse.json();
  console.log(`  VITE_SUPABASE_URL: ${urlData.error ? '❌ ' + urlData.error.message : '✅'}`);

  // VITE_SUPABASE_ANON_KEY
  const keyResponse = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_NAME}/env`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: 'VITE_SUPABASE_ANON_KEY',
      value: SUPABASE_ANON_KEY,
      type: 'plain',
      target: ['production', 'preview', 'development']
    })
  });
  const keyData = await keyResponse.json();
  console.log(`  VITE_SUPABASE_ANON_KEY: ${keyData.error ? '❌ ' + keyData.error.message : '✅'}`);

  // Verify
  console.log('\n📋 Verification:');
  const verifyResponse = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_NAME}/env`, {
    headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
  });
  const verifyData = await verifyResponse.json();
  
  const viteUrl = verifyData.envs?.find(e => e.key === 'VITE_SUPABASE_URL');
  const viteKey = verifyData.envs?.find(e => e.key === 'VITE_SUPABASE_ANON_KEY');
  
  console.log(`  VITE_SUPABASE_URL: ${viteUrl?.value || '(not found)'}`);
  console.log(`  VITE_SUPABASE_ANON_KEY: ${viteKey?.value?.substring(0, 50)}...`);

  console.log('\n⚠️ Now triggering redeploy...');
}

fixSupabaseEnv();

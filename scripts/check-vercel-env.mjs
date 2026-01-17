// Check Vercel environment variables
const VERCEL_TOKEN = 'h3JH04ItPhvmCMK1HzCsqHaw';
const PROJECT_NAME = 'nexus-minerva';

async function checkEnv() {
  console.log('🔍 Checking Vercel environment variables...\n');
  
  const response = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_NAME}/env`, {
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`
    }
  });
  
  const data = await response.json();
  
  if (data.envs) {
    console.log('📋 WhatsApp Variables:');
    const whatsappVars = data.envs.filter(e => e.key.includes('WHATSAPP'));
    whatsappVars.forEach(e => {
      console.log(`  ${e.key}: ${e.value || '(encrypted)'}`);
    });
    
    console.log('\n📋 Supabase Variables:');
    const supabaseVars = data.envs.filter(e => e.key.includes('SUPABASE'));
    supabaseVars.forEach(e => {
      console.log(`  ${e.key}: ${e.value ? e.value.substring(0, 30) + '...' : '(encrypted)'}`);
    });
  } else {
    console.log('Error:', data);
  }
}

checkEnv();

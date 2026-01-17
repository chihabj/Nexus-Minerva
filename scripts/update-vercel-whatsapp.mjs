// Update WhatsApp Phone ID on Vercel
const VERCEL_TOKEN = 'h3JH04ItPhvmCMK1HzCsqHaw';
const PROJECT_NAME = 'nexus-minerva';
const NEW_PHONE_ID = '926286233904546';

async function updateEnv() {
  console.log('🔄 Updating VITE_WHATSAPP_PHONE_ID on Vercel...\n');
  
  // First, get all env vars to find the IDs of existing WHATSAPP vars
  const listResponse = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_NAME}/env`, {
    headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
  });
  const listData = await listResponse.json();
  
  // Find existing VITE_WHATSAPP_PHONE_ID entries
  const phoneIdVars = listData.envs?.filter(e => e.key === 'VITE_WHATSAPP_PHONE_ID') || [];
  
  console.log(`Found ${phoneIdVars.length} existing VITE_WHATSAPP_PHONE_ID entries`);
  
  // Delete existing ones
  for (const env of phoneIdVars) {
    console.log(`  Deleting ${env.id} (target: ${env.target?.join(', ')})`);
    await fetch(`https://api.vercel.com/v9/projects/${PROJECT_NAME}/env/${env.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
    });
  }
  
  // Create new one for all targets
  console.log(`\n📝 Creating new VITE_WHATSAPP_PHONE_ID = ${NEW_PHONE_ID}`);
  
  const createResponse = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_NAME}/env`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: 'VITE_WHATSAPP_PHONE_ID',
      value: NEW_PHONE_ID,
      type: 'plain',
      target: ['production', 'preview', 'development']
    })
  });
  
  const createData = await createResponse.json();
  
  if (createData.error) {
    console.log('❌ Error:', createData.error);
  } else {
    console.log('✅ Successfully updated VITE_WHATSAPP_PHONE_ID');
  }
  
  // Verify
  console.log('\n📋 Verification:');
  const verifyResponse = await fetch(`https://api.vercel.com/v9/projects/${PROJECT_NAME}/env`, {
    headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
  });
  const verifyData = await verifyResponse.json();
  const updated = verifyData.envs?.find(e => e.key === 'VITE_WHATSAPP_PHONE_ID');
  console.log(`  VITE_WHATSAPP_PHONE_ID: ${updated?.value || '(not found)'}`);
  
  console.log('\n⚠️ Remember: You need to redeploy for changes to take effect!');
}

updateEnv();

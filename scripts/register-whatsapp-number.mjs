// Register WhatsApp phone number via Cloud API
// You need to run this AFTER enabling two-step verification

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || 'YOUR_TOKEN_HERE';
const PHONE_NUMBER_ID = '926286233904546';

// Get the PIN from command line argument
const PIN = process.argv[2];

if (!PIN || PIN.length !== 6) {
  console.log('❌ Usage: node scripts/register-whatsapp-number.mjs <6-digit-PIN>');
  console.log('');
  console.log('Example: node scripts/register-whatsapp-number.mjs 123456');
  console.log('');
  console.log('The PIN is the one you set in Two-step verification on Meta Business Suite.');
  process.exit(1);
}

async function registerNumber() {
  console.log('📱 Registering WhatsApp phone number...');
  console.log(`   Phone Number ID: ${PHONE_NUMBER_ID}`);
  console.log(`   PIN: ******`);
  console.log('');

  const response = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/register`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      pin: PIN,
    }),
  });

  const data = await response.json();

  if (data.success) {
    console.log('✅ Phone number registered successfully!');
    console.log('');
    console.log('You can now send WhatsApp messages from this number.');
  } else {
    console.log('❌ Registration failed:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.error?.code === 136025) {
      console.log('');
      console.log('💡 This error means you need to enable Two-step verification first.');
      console.log('   Go to: WhatsApp Manager > Phone numbers > Your number > Two-step verification');
    }
  }
}

registerNumber();

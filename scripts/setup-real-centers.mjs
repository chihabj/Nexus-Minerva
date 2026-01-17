// Script to replace mock centers with real Minerva CT centers
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aefzpamcvbzzcgwkuita.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZnpwYW1jdmJ6emNnd2t1aXRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY4NTkwOCwiZXhwIjoyMDgzMjYxOTA4fQ.Q1s_5dc37-HkKomDlbmet5SixnYoHcdA0g8yhFNCx-w';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// All real Minerva CT centers from https://www.minerva-ct.fr/listing
const realCenters = [
  {
    name: "Conches-en-Ouche - Auto Sécurité",
    address: "Rue François Mitterrand, 27190 Conches-en-Ouche",
    region: "Normandie",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Saint-Sulpice-sur-Risle - Auto Sécurité",
    address: "48 Route de Paris, 61300 Saint-Sulpice-sur-Risle",
    region: "Normandie",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Gradignan - Auto Sécurité",
    address: "Avenue de l'Europe Parc technoclub, 33170 Gradignan",
    region: "Aquitaine",
    status: "Connected",
    staff_count: 4,
    phone: null
  },
  {
    name: "Argentan - Auto Sécurité",
    address: "2 Rue du Croissant, 61200 Argentan",
    region: "Normandie",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Lormont - Autosur",
    address: "7, Rond-Point des évadés de France, 33310 Lormont",
    region: "Aquitaine",
    status: "Connected",
    staff_count: 4,
    phone: null
  },
  {
    name: "Cenon - Auto Sécurité",
    address: "205 rue Carnot, 33150 Cenon",
    region: "Aquitaine",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Pauillac - Sécuritest",
    address: "75 bis, rue albert 1er, 33250 Pauillac",
    region: "Aquitaine",
    status: "Connected",
    staff_count: 2,
    phone: null
  },
  {
    name: "Saint Laurent Medoc - Sécuritest",
    address: "17 za de saint laurent, 33112 Saint-Laurent-Médoc",
    region: "Aquitaine",
    status: "Connected",
    staff_count: 2,
    phone: null
  },
  {
    name: "Compiègne - Dekra",
    address: "3 Avenue Henri Adnot, 60200 Compiègne",
    region: "Hauts-de-France",
    status: "Connected",
    staff_count: 4,
    phone: null
  },
  {
    name: "Ris-Orangis - Autosur",
    address: "2 Rue Paul Langevin, 91130 Ris-Orangis",
    region: "Ile-de-France",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Évry - Autosur",
    address: "50 Rue Paul Claudel, 91000 Évry",
    region: "Ile-de-France",
    status: "Connected",
    staff_count: 4,
    phone: null
  },
  {
    name: "Saint-Maximin - Autosur",
    address: "Rue Albert Einstein ZAE, 60740 Saint-Maximin",
    region: "Hauts-de-France",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Senlis-Chamant - Auto Sécurité",
    address: "Avenue du Poteau - Zone Commerciale Intermarché, 60300 Senlis-Chamant",
    region: "Hauts-de-France",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Bourg-la-Reine - Autosur",
    address: "28 Avenue du Général Leclerc, 92340 Bourg-la-Reine",
    region: "Ile-de-France",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Bègles - Auto Sécurité",
    address: "25 chemin Chatry, 33130 Bègles",
    region: "Aquitaine",
    status: "Connected",
    staff_count: 4,
    phone: null
  },
  {
    name: "Saint-Vivien-de-Médoc - Autosur",
    address: "Route du Petit Maurin-Est, 33590 Saint-Vivien-de-Médoc",
    region: "Aquitaine",
    status: "Connected",
    staff_count: 2,
    phone: null
  },
  {
    name: "Soissons - Autosur",
    address: "Rue de la Cité Gilbert, 02200 Soissons",
    region: "Hauts-de-France",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Montataire - Autosur",
    address: "99 Rue Louis Blanc, 60160 Montataire",
    region: "Hauts-de-France",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Mérignac - Auto Sécurité",
    address: "364 avenue d'Ares, 33700 Mérignac",
    region: "Aquitaine",
    status: "Connected",
    staff_count: 4,
    phone: null
  },
  {
    name: "Eysines - Auto Sécurité",
    address: "122 avenue du Medoc, 33320 Eysines",
    region: "Aquitaine",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Saint-Pierre les Nemours - Autosur",
    address: "8 Rue Loing, 77140 Saint Pierre les Nemours",
    region: "Ile-de-France",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Morangis - Autosur",
    address: "1 rue Gustave Eiffel, 91420 Morangis",
    region: "Ile-de-France",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Pessac - Auto Sécurité",
    address: "14 avenue Arago, 33600 Pessac",
    region: "Aquitaine",
    status: "Connected",
    staff_count: 4,
    phone: null
  },
  {
    name: "Castelnau-de-Médoc - Autosur",
    address: "16 route d'Avensan, 33480 Castelnau-de-Médoc",
    region: "Aquitaine",
    status: "Connected",
    staff_count: 2,
    phone: null
  },
  {
    name: "Montgeron - Autosur",
    address: "Z.A.C. du Réveil Matin, 91230 Montgeron",
    region: "Ile-de-France",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Nogent-sur-Oise - DEKRA",
    address: "4 Rue du Clos Barrois, 60180 Nogent-sur-Oise",
    region: "Hauts-de-France",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Sainte-Geneviève-des-Bois - Autosur",
    address: "4 Rue Coli, 91700 Sainte-Geneviève-des-Bois",
    region: "Ile-de-France",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Nemours - Autovision",
    address: "113 Route de Moret, 77140 Nemours",
    region: "Ile-de-France",
    status: "Connected",
    staff_count: 3,
    phone: null
  },
  {
    name: "Lesparre-Médoc - Autosur",
    address: "8 Rue des Forgerons, 33340 Lesparre-Médoc",
    region: "Aquitaine",
    status: "Connected",
    staff_count: 2,
    phone: null
  },
  {
    name: "Saint-Quentin - Autovision",
    address: "111 Rue Georges Pompidou, 02100 Saint-Quentin",
    region: "Hauts-de-France",
    status: "Connected",
    staff_count: 4,
    phone: null
  }
];

async function setupRealCenters() {
  console.log('🏢 Setting up real Minerva CT centers...\n');

  // Step 1: Delete all existing centers
  console.log('1️⃣ Deleting existing mock centers...');
  const { error: deleteError } = await supabase
    .from('tech_centers')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (deleteError) {
    console.error('❌ Error deleting centers:', deleteError.message);
    // Continue anyway - table might be empty
  } else {
    console.log('✅ Existing centers deleted');
  }

  // Step 2: Insert all real centers
  console.log('\n2️⃣ Inserting real Minerva CT centers...');
  
  const { data: insertedCenters, error: insertError } = await supabase
    .from('tech_centers')
    .insert(realCenters)
    .select();

  if (insertError) {
    console.error('❌ Error inserting centers:', insertError.message);
    process.exit(1);
  }

  console.log(`✅ Successfully inserted ${insertedCenters.length} centers\n`);

  // Step 3: Display summary by region
  console.log('📊 Summary by region:');
  const byRegion = {};
  for (const center of insertedCenters) {
    byRegion[center.region] = (byRegion[center.region] || 0) + 1;
  }
  for (const [region, count] of Object.entries(byRegion)) {
    console.log(`   - ${region}: ${count} centres`);
  }

  // Step 4: Display all centers
  console.log('\n📋 All centers:');
  for (const center of insertedCenters) {
    console.log(`   ✓ ${center.name}`);
    console.log(`     📍 ${center.address}`);
    console.log(`     🗺️  ${center.region}\n`);
  }

  console.log('\n✅ Setup complete! 30 real Minerva CT centers are now in the database.');
}

setupRealCenters().catch(console.error);

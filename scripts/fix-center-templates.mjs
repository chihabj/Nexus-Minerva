/**
 * Script pour corriger les templates mal configurés
 */

import pg from 'pg';

const connectionString = 'postgres://postgres.aefzpamcvbzzcgwkuita:lBxWZIStQSS64uOC@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';

const sslConfig = {
  rejectUnauthorized: false
};

const client = new pg.Client({
  connectionString,
  ssl: sslConfig
});

async function main() {
  console.log('🔧 Correction des templates...\n');

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');

    // 1. Corriger Évry (accent)
    console.log('1️⃣ Mise à jour Évry...');
    const evryResult = await client.query(`
      UPDATE tech_centers 
      SET template_name = 'rappel_autosur__evry', network = 'AUTOSUR'
      WHERE name ILIKE '%vry%' AND name ILIKE '%autosur%';
    `);
    console.log(`   ✅ ${evryResult.rowCount} centre(s) mis à jour\n`);

    // 2. Corriger Saint-Sulpice-sur-Risle (mauvais match)
    console.log('2️⃣ Correction Saint-Sulpice-sur-Risle...');
    const sulpiceResult = await client.query(`
      UPDATE tech_centers 
      SET template_name = NULL, network = NULL
      WHERE name ILIKE '%sulpice%risle%';
    `);
    console.log(`   ✅ ${sulpiceResult.rowCount} centre(s) corrigé(s)\n`);

    // 3. Afficher la configuration finale
    console.log('📋 Configuration finale des centres avec templates:');
    const { rows: centers } = await client.query(`
      SELECT name, template_name, network
      FROM tech_centers 
      WHERE template_name IS NOT NULL
      ORDER BY name;
    `);
    console.table(centers);

    console.log('\n📋 Centres sans template (utiliseront le template par défaut):');
    const { rows: centersNoTemplate } = await client.query(`
      SELECT name
      FROM tech_centers 
      WHERE template_name IS NULL
      ORDER BY name;
    `);
    centersNoTemplate.forEach(c => console.log(`   - ${c.name}`));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connexion fermée');
  }
}

main();

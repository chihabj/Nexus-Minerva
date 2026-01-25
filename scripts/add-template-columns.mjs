/**
 * Script pour ajouter les colonnes template_name, short_url, network à tech_centers
 * 
 * Usage: node scripts/add-template-columns.mjs
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
  console.log('🔧 Configuration des colonnes pour tech_centers...\n');

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');

    // 1. Ajouter les colonnes si elles n'existent pas
    console.log('1️⃣ Ajout des colonnes template_name, short_url, network...');
    
    await client.query(`
      ALTER TABLE tech_centers ADD COLUMN IF NOT EXISTS template_name TEXT;
    `);
    console.log('   ✅ Colonne template_name ajoutée');

    await client.query(`
      ALTER TABLE tech_centers ADD COLUMN IF NOT EXISTS short_url TEXT;
    `);
    console.log('   ✅ Colonne short_url ajoutée');

    await client.query(`
      ALTER TABLE tech_centers ADD COLUMN IF NOT EXISTS network TEXT;
    `);
    console.log('   ✅ Colonne network ajoutée\n');

    // 2. Afficher les centres existants
    console.log('📋 Centres existants:');
    const { rows: centers } = await client.query(`
      SELECT id, name, template_name, network, phone, short_url 
      FROM tech_centers 
      ORDER BY name;
    `);

    if (centers.length > 0) {
      console.table(centers);
    } else {
      console.log('⚠️ Aucun centre trouvé dans la base.\n');
    }

    // 3. Mettre à jour les templates pour les centres existants
    console.log('\n2️⃣ Mise à jour des templates par centre...');
    
    const templateMappings = [
      { pattern: 'montgeron', template: 'rappel_autosur__montgeron', network: 'AUTOSUR' },
      { pattern: 'morangis', template: 'rappel_autosur__morangis', network: 'AUTOSUR' },
      { pattern: 'ris', template: 'rappel__autosur__ris_orangis', network: 'AUTOSUR' },
      { pattern: 'nemours', template: 'rappel__autosur__nemours', network: 'AUTOSUR' },
      { pattern: 'evry', template: 'rappel_autosur__evry', network: 'AUTOSUR' },
      { pattern: 'montataire', template: 'rappel_autosur__montataire', network: 'AUTOSUR' },
      { pattern: 'lormont', template: 'rappel_autosur__lormont', network: 'AUTOSUR' },
      { pattern: 'lesparre', template: 'rappel_autosur__lesparremdoc', network: 'AUTOSUR' },
      { pattern: 'bourg', template: 'rappel_autosur__bourglareine', network: 'AUTOSUR' },
      { pattern: 'castelnau', template: 'rappel__autosur__castelnaumdoc', network: 'AUTOSUR' },
    ];

    let updated = 0;
    for (const mapping of templateMappings) {
      const result = await client.query(`
        UPDATE tech_centers 
        SET template_name = $1, network = $2
        WHERE LOWER(name) LIKE $3 AND template_name IS NULL;
      `, [mapping.template, mapping.network, `%${mapping.pattern}%`]);
      
      if (result.rowCount > 0) {
        console.log(`   ✅ ${result.rowCount} centre(s) mis à jour avec ${mapping.template}`);
        updated += result.rowCount;
      }
    }

    if (updated === 0) {
      console.log('   ℹ️ Aucun centre à mettre à jour (déjà configurés ou aucun match)');
    }

    // 4. Afficher la configuration finale
    console.log('\n📋 Configuration finale des centres:');
    const { rows: finalCenters } = await client.query(`
      SELECT id, name, template_name, network, phone, short_url 
      FROM tech_centers 
      ORDER BY name;
    `);

    if (finalCenters.length > 0) {
      console.table(finalCenters);
    }

    console.log('\n✅ Configuration terminée!');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connexion fermée');
  }
}

main();

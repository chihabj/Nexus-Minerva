/**
 * Script pour ajouter les colonnes marque, modele, immatriculation et vin à la table clients
 * 
 * Usage: node scripts/add-immat-vin-columns.mjs
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
  console.log('🔧 Ajout des colonnes marque, modele, immatriculation et vin à la table clients...\n');

  try {
    await client.connect();
    console.log('✅ Connecté à la base de données\n');

    // 1. Ajouter la colonne marque
    console.log('1️⃣ Ajout de la colonne marque...');
    await client.query(`
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS marque TEXT;
    `);
    console.log('   ✅ Colonne marque ajoutée');

    // 2. Ajouter la colonne modele
    console.log('2️⃣ Ajout de la colonne modele...');
    await client.query(`
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS modele TEXT;
    `);
    console.log('   ✅ Colonne modele ajoutée');

    // 3. Ajouter la colonne immatriculation
    console.log('3️⃣ Ajout de la colonne immatriculation...');
    await client.query(`
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS immatriculation TEXT;
    `);
    console.log('   ✅ Colonne immatriculation ajoutée');

    // 4. Ajouter la colonne vin
    console.log('4️⃣ Ajout de la colonne vin...');
    await client.query(`
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS vin TEXT;
    `);
    console.log('   ✅ Colonne vin ajoutée');

    // 5. Vérifier la structure
    console.log('\n📋 Structure de la table clients:');
    const { rows } = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'clients'
      ORDER BY ordinal_position;
    `);
    console.table(rows);

    console.log('\n✅ Colonnes ajoutées avec succès!');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connexion fermée');
  }
}

main();

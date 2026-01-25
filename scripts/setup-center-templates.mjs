/**
 * Script pour configurer les templates WhatsApp par centre
 * 
 * Usage: node scripts/setup-center-templates.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.log('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configuration des templates par centre
// Les noms de template doivent correspondre EXACTEMENT aux noms dans Meta Business Manager
const CENTER_TEMPLATES = [
  {
    namePattern: 'montgeron',
    templateName: 'rappel_autosur__montgeron',
    network: 'AUTOSUR',
  },
  {
    namePattern: 'morangis',
    templateName: 'rappel_autosur__morangis',
    network: 'AUTOSUR',
  },
  {
    namePattern: 'ris',
    altPattern: 'orangis',
    templateName: 'rappel__autosur__ris_orangis',
    network: 'AUTOSUR',
  },
  {
    namePattern: 'nemours',
    templateName: 'rappel__autosur__nemours',
    network: 'AUTOSUR',
  },
  {
    namePattern: 'evry',
    templateName: 'rappel_autosur__evry',
    network: 'AUTOSUR',
  },
  {
    namePattern: 'montataire',
    templateName: 'rappel_autosur__montataire',
    network: 'AUTOSUR',
  },
  {
    namePattern: 'lormont',
    templateName: 'rappel_autosur__lormont',
    network: 'AUTOSUR',
  },
  {
    namePattern: 'lesparre',
    altPattern: 'medoc',
    templateName: 'rappel_autosur__lesparremdoc',
    network: 'AUTOSUR',
  },
  {
    namePattern: 'bourg',
    altPattern: 'reine',
    templateName: 'rappel_autosur__bourglareine',
    network: 'AUTOSUR',
  },
  {
    namePattern: 'castelnau',
    templateName: 'rappel__autosur__castelnaumdoc',
    network: 'AUTOSUR',
  },
];

async function main() {
  console.log('🔧 Configuration des templates WhatsApp par centre...\n');

  // 1. Récupérer tous les centres
  const { data: centers, error } = await supabase
    .from('tech_centers')
    .select('*');

  if (error) {
    console.error('❌ Erreur lors de la récupération des centres:', error.message);
    process.exit(1);
  }

  console.log(`📋 ${centers?.length || 0} centres trouvés dans la base\n`);

  if (!centers || centers.length === 0) {
    console.log('⚠️ Aucun centre trouvé. Créez d\'abord les centres dans la base.');
    return;
  }

  let updated = 0;
  let notFound = 0;

  // 2. Pour chaque centre, trouver le template correspondant
  for (const center of centers) {
    const centerNameLower = center.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    let matchedTemplate = null;
    for (const config of CENTER_TEMPLATES) {
      const pattern1 = config.namePattern.toLowerCase();
      const pattern2 = config.altPattern?.toLowerCase();
      
      if (centerNameLower.includes(pattern1) || (pattern2 && centerNameLower.includes(pattern2))) {
        matchedTemplate = config;
        break;
      }
    }

    if (matchedTemplate) {
      const { error: updateError } = await supabase
        .from('tech_centers')
        .update({
          template_name: matchedTemplate.templateName,
          network: matchedTemplate.network,
        })
        .eq('id', center.id);

      if (updateError) {
        console.log(`❌ Erreur mise à jour ${center.name}:`, updateError.message);
      } else {
        console.log(`✅ ${center.name} → ${matchedTemplate.templateName}`);
        updated++;
      }
    } else {
      console.log(`⚠️ ${center.name} → Aucun template trouvé (utilisera le template par défaut)`);
      notFound++;
    }
  }

  console.log(`\n📊 Résumé: ${updated} centres mis à jour, ${notFound} sans template spécifique`);

  // 3. Afficher la configuration finale
  console.log('\n📋 Configuration finale des centres:');
  const { data: updatedCenters } = await supabase
    .from('tech_centers')
    .select('name, template_name, network, phone, short_url')
    .order('name');

  if (updatedCenters) {
    console.table(updatedCenters);
  }
}

main().catch(console.error);

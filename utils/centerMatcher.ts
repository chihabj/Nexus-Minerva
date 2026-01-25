/**
 * Utilitaires pour matcher les centres techniques lors de l'import
 */

import { supabase } from '../services/supabaseClient';

/**
 * Normalise un nom de centre pour faciliter le matching
 * - Convertit en minuscules
 * - Supprime les accents
 * - Supprime les caractères spéciaux
 * - Normalise les espaces
 */
export function normalizeCenterName(name: string | null | undefined): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    // Supprime les accents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remplace les caractères spéciaux par des espaces
    .replace(/[-_']/g, ' ')
    // Supprime la ponctuation
    .replace(/[.,;:!?()]/g, '')
    // Normalise les espaces multiples
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrait les mots-clés d'un nom de centre pour le matching
 */
export function extractCenterKeywords(name: string): string[] {
  const normalized = normalizeCenterName(name);
  
  // Mots à ignorer dans le matching
  const stopWords = new Set([
    'autosur', 'secta', 'dekra', 'controle', 'technique',
    'centre', 'ct', 'auto', 'de', 'la', 'le', 'les', 'du', 'des',
    'en', 'sur', 'sous'
  ]);
  
  return normalized
    .split(' ')
    .filter(word => word.length > 2 && !stopWords.has(word));
}

/**
 * Calcule un score de similarité entre deux noms de centres
 */
export function calculateSimilarity(name1: string, name2: string): number {
  const keywords1 = extractCenterKeywords(name1);
  const keywords2 = extractCenterKeywords(name2);
  
  if (keywords1.length === 0 || keywords2.length === 0) return 0;
  
  // Compte les mots-clés en commun
  const commonKeywords = keywords1.filter(kw => 
    keywords2.some(kw2 => kw2.includes(kw) || kw.includes(kw2))
  );
  
  // Score basé sur le ratio de mots-clés communs
  const maxKeywords = Math.max(keywords1.length, keywords2.length);
  return commonKeywords.length / maxKeywords;
}

export interface CenterMatch {
  center_id: string;
  center_name: string;
  template_name: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  score: number;
}

/**
 * Cache des centres pour éviter de requêter la base à chaque import
 */
let centersCache: Array<{
  id: string;
  name: string;
  template_name: string | null;
  phone: string | null;
  short_url: string | null;
  network: string | null;
}> | null = null;

/**
 * Charge les centres depuis la base de données (avec cache)
 */
export async function loadCenters(forceReload = false): Promise<typeof centersCache> {
  if (centersCache && !forceReload) {
    return centersCache;
  }
  
  const { data, error } = await supabase
    .from('tech_centers')
    .select('id, name, template_name, phone, short_url, network');
  
  if (error) {
    console.error('Erreur chargement des centres:', error);
    return [];
  }
  
  centersCache = data || [];
  console.log(`📋 ${centersCache.length} centres chargés dans le cache`);
  return centersCache;
}

/**
 * Invalide le cache des centres
 */
export function invalidateCentersCache(): void {
  centersCache = null;
}

/**
 * Trouve le centre correspondant à un nom importé
 */
export async function matchCenter(importedCenterName: string): Promise<CenterMatch | null> {
  if (!importedCenterName || importedCenterName.trim() === '') {
    return null;
  }
  
  const centers = await loadCenters();
  if (!centers || centers.length === 0) {
    return null;
  }
  
  const normalizedImport = normalizeCenterName(importedCenterName);
  
  let bestMatch: CenterMatch | null = null;
  let bestScore = 0;
  
  for (const center of centers) {
    const normalizedCenter = normalizeCenterName(center.name);
    
    // Match exact (après normalisation)
    if (normalizedImport === normalizedCenter) {
      return {
        center_id: center.id,
        center_name: center.name,
        template_name: center.template_name,
        confidence: 'high',
        score: 1,
      };
    }
    
    // L'un contient l'autre
    if (normalizedImport.includes(normalizedCenter) || normalizedCenter.includes(normalizedImport)) {
      const score = 0.9;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          center_id: center.id,
          center_name: center.name,
          template_name: center.template_name,
          confidence: 'high',
          score,
        };
      }
      continue;
    }
    
    // Score de similarité par mots-clés
    const score = calculateSimilarity(importedCenterName, center.name);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        center_id: center.id,
        center_name: center.name,
        template_name: center.template_name,
        confidence: score >= 0.7 ? 'high' : score >= 0.5 ? 'medium' : score >= 0.3 ? 'low' : 'none',
        score,
      };
    }
  }
  
  // Ne retourne que si le score est suffisant
  if (bestMatch && bestMatch.score >= 0.3) {
    console.log(`🔗 Match centre: "${importedCenterName}" → "${bestMatch.center_name}" (${bestMatch.confidence}, score: ${bestMatch.score.toFixed(2)})`);
    return bestMatch;
  }
  
  console.log(`⚠️ Aucun match trouvé pour le centre: "${importedCenterName}"`);
  return null;
}

/**
 * Trouve ou crée un centre technique
 * Si le centre n'existe pas, il peut être créé automatiquement
 */
export async function findOrCreateCenter(
  importedCenterName: string,
  autoCreate = false
): Promise<{ center_id: string | null; center_name: string; isNew: boolean }> {
  const match = await matchCenter(importedCenterName);
  
  if (match && match.confidence !== 'none') {
    return {
      center_id: match.center_id,
      center_name: match.center_name,
      isNew: false,
    };
  }
  
  // Pas de match trouvé
  if (!autoCreate) {
    return {
      center_id: null,
      center_name: importedCenterName,
      isNew: false,
    };
  }
  
  // Créer automatiquement le centre
  const { data: newCenter, error } = await supabase
    .from('tech_centers')
    .insert({
      name: importedCenterName,
      status: 'Pending',
      region: 'Non définie',
    })
    .select()
    .single();
  
  if (error) {
    console.error('Erreur création centre:', error);
    return {
      center_id: null,
      center_name: importedCenterName,
      isNew: false,
    };
  }
  
  // Invalider le cache pour inclure le nouveau centre
  invalidateCentersCache();
  
  console.log(`✅ Nouveau centre créé: "${newCenter.name}" (${newCenter.id})`);
  
  return {
    center_id: newCenter.id,
    center_name: newCenter.name,
    isNew: true,
  };
}

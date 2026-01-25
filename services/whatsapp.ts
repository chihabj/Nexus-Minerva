/**
 * WhatsApp Business API Service (Meta Cloud API)
 * 
 * ⚠️ ATTENTION: En production, les appels API WhatsApp doivent passer par un backend
 * pour protéger le token. Cette implémentation est pour le développement/test uniquement.
 */

const WHATSAPP_API_TOKEN = import.meta.env.VITE_WHATSAPP_API_TOKEN;
const WHATSAPP_PHONE_ID = import.meta.env.VITE_WHATSAPP_PHONE_ID;
const GRAPH_API_VERSION = 'v17.0';
const GRAPH_API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_ID}/messages`;

/**
 * ✅ WhatsApp API activée
 * Configurée avec le nouveau numéro Minerva Controle Technique
 */
const WHATSAPP_ENABLED = true;

/**
 * Vérifie si WhatsApp est activé et configuré
 */
export function isWhatsAppEnabled(): boolean {
  return WHATSAPP_ENABLED && !!WHATSAPP_API_TOKEN && !!WHATSAPP_PHONE_ID;
}

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters?: TemplateParameter[];
  sub_type?: string;
  index?: number;
}

export interface WhatsAppTemplateParams {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: TemplateComponent[];
}

/**
 * Paramètres spécifiques pour le template rappel_visite_technique
 * 
 * Variables du template:
 * - DatePrecedentVisite: Date de la précédente visite (format: DD/MM/YYYY)
 * - Marque: Marque du véhicule (ex: "Peugeot")
 * - Modele: Modèle du véhicule (ex: "308")
 * - Immat: Immatriculation du véhicule
 * - DateProchVis: Date de la prochaine visite (format: DD/MM/YYYY)
 * - TypeCentre: Type/réseau du centre (ex: "AUTOSUR")
 * - centre: Nom complet du centre (ex: "AUTOSUR - BOURG-LA-REINE")
 * 
 * Boutons:
 * - "Prendre RDV": Bouton URL avec la short_url du centre
 * - "Nous appeler": Bouton téléphone avec le numéro du centre
 */
export interface RappelVisiteTechniqueParams {
  to: string;
  templateName?: string; // Nom du template WhatsApp spécifique au centre (optionnel, défaut: rappel_visite_technique_vf)
  datePrecedentVisite: string; // Format: DD/MM/YYYY
  marque: string;
  modele: string;
  immat: string;
  dateProchVis: string; // Format: DD/MM/YYYY
  typeCentre: string;
  nomCentre: string;
  shortUrlRendezVous: string; // URL pour le bouton "Prendre RDV"
  numeroAppelCentre: string; // Numéro de téléphone pour le bouton "Nous appeler"
}

/**
 * Nettoie un numéro de téléphone pour l'API WhatsApp
 * - Garde uniquement les chiffres
 * - Supprime le '+' initial
 */
export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Supprime tous les caractères non numériques sauf le +
  let cleaned = phone.replace(/[^\d+]/g, '');
  // Supprime le + au début si présent (WhatsApp API n'en a pas besoin)
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  // Si commence par 00, remplacer par rien (format international sans préfixe)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
}

/**
 * Envoie un template WhatsApp générique via l'API Meta Cloud
 */
export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = 'fr',
  components = [],
}: WhatsAppTemplateParams): Promise<WhatsAppResponse> {
  
  // Check if WhatsApp is enabled
  if (!WHATSAPP_ENABLED) {
    console.warn('⚠️ WhatsApp API désactivée temporairement');
    return {
      success: false,
      error: 'WhatsApp API désactivée temporairement. Configuration en cours...',
    };
  }
  
  // Validation
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
    console.error('WhatsApp API credentials not configured');
    return {
      success: false,
      error: 'WhatsApp API non configurée. Vérifiez les variables d\'environnement.',
    };
  }

  const cleanedPhone = cleanPhoneNumber(to);
  if (!cleanedPhone || cleanedPhone.length < 10) {
    return {
      success: false,
      error: 'Numéro de téléphone invalide',
    };
  }

  // Construire le body de la requête
  const requestBody: any = {
    messaging_product: 'whatsapp',
    to: cleanedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
    },
  };

  // Ajouter les components si fournis (pour les templates avec variables)
  if (components.length > 0) {
    requestBody.template.components = components;
  }

  console.log('📤 Sending WhatsApp message:', {
    to: cleanedPhone,
    template: templateName,
    language: languageCode,
    components: JSON.stringify(components),
  });

  try {
    const response = await fetch(GRAPH_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ WhatsApp API Error:', data);
      return {
        success: false,
        error: data.error?.message || `Erreur API: ${response.status}`,
      };
    }

    console.log('✅ WhatsApp message sent:', data);
    
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    console.error('❌ WhatsApp API Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur réseau',
    };
  }
}

/**
 * Envoie le template "rappel_visite_technique_vf" avec les variables du client
 * 
 * Variables du template (dans l'ordre):
 * - DatePrecedentVisite: Date de la précédente visite
 * - Marque: Marque du véhicule
 * - Modele: Modèle du véhicule
 * - Immat: Immatriculation
 * - DateProchVis: Date de la prochaine visite
 * - TypeCentre: Type/réseau du centre
 * - centre: Nom complet du centre
 * 
 * Boutons:
 * - Index 0: "Prendre RDV" (URL)
 * - Index 1: "Nous appeler" (Téléphone)
 */
export async function sendRappelVisiteTechnique({
  to,
  templateName,
  datePrecedentVisite,
  marque,
  modele,
  immat,
  dateProchVis,
  typeCentre,
  nomCentre,
  shortUrlRendezVous,
  numeroAppelCentre,
}: RappelVisiteTechniqueParams): Promise<WhatsAppResponse> {
  
  // Utiliser le template spécifique au centre, ou le template par défaut
  const finalTemplateName = templateName || 'rappel_visite_technique_vf';
  
  const components: TemplateComponent[] = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: datePrecedentVisite || 'N/A' },  // DatePrecedentVisite
        { type: 'text', text: marque || 'N/A' },               // Marque
        { type: 'text', text: modele || 'N/A' },               // Modele
        { type: 'text', text: immat || 'N/A' },                // Immat
        { type: 'text', text: dateProchVis || 'N/A' },        // DateProchVis
        { type: 'text', text: typeCentre || 'N/A' },           // TypeCentre
        { type: 'text', text: nomCentre || 'N/A' },            // centre
      ],
    },
    // Bouton "Prendre RDV" (URL) - Seulement si le template a des boutons dynamiques
    // Note: Pour les templates par centre avec boutons fixes, ces composants seront ignorés par l'API
    {
      type: 'button',
      sub_type: 'url',
      index: 0,
      parameters: [
        {
          type: 'text',
          text: shortUrlRendezVous || '',
        },
      ],
    },
    // Bouton "Nous appeler" (Téléphone)
    {
      type: 'button',
      sub_type: 'phone_number',
      index: 1,
      parameters: [
        {
          type: 'text',
          text: cleanPhoneNumber(numeroAppelCentre) || '',
        },
      ],
    },
  ];

  console.log(`📤 Utilisation du template: ${finalTemplateName}`);

  return sendWhatsAppTemplate({
    to,
    templateName: finalTemplateName,
    languageCode: 'fr',
    components,
  });
}

/**
 * Envoie le template hello_world (template par défaut du Sandbox)
 * Utile pour les tests
 */
export async function sendHelloWorldTemplate(to: string): Promise<WhatsAppResponse> {
  return sendWhatsAppTemplate({
    to,
    templateName: 'hello_world',
    languageCode: 'en_US',
  });
}

/**
 * Envoie un message texte simple via WhatsApp
 * ⚠️ Note: Les messages texte ne peuvent être envoyés que dans les 24h 
 * suivant le dernier message du client (règle Meta)
 */
export async function sendTextMessage(to: string, text: string): Promise<WhatsAppResponse> {
  // Check if WhatsApp is enabled
  if (!WHATSAPP_ENABLED) {
    console.warn('⚠️ WhatsApp API désactivée temporairement');
    return {
      success: false,
      error: 'WhatsApp API désactivée temporairement. Configuration en cours...',
    };
  }
  
  // Validation
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
    console.error('WhatsApp API credentials not configured');
    return {
      success: false,
      error: 'WhatsApp API non configurée. Vérifiez les variables d\'environnement.',
    };
  }

  const cleanedPhone = cleanPhoneNumber(to);
  if (!cleanedPhone || cleanedPhone.length < 10) {
    return {
      success: false,
      error: 'Numéro de téléphone invalide',
    };
  }

  if (!text || text.trim().length === 0) {
    return {
      success: false,
      error: 'Le message ne peut pas être vide',
    };
  }

  const requestBody = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanedPhone,
    type: 'text',
    text: {
      preview_url: true,
      body: text,
    },
  };

  console.log('📤 Sending WhatsApp text message:', {
    to: cleanedPhone,
    text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
  });

  try {
    const response = await fetch(GRAPH_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ WhatsApp API Error:', data);
      return {
        success: false,
        error: data.error?.message || `Erreur API: ${response.status}`,
      };
    }

    console.log('✅ WhatsApp text message sent:', data);
    
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    console.error('❌ WhatsApp API Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur réseau',
    };
  }
}

/**
 * Marque un message comme lu (envoie un read receipt)
 */
export async function markMessageAsRead(messageId: string): Promise<boolean> {
  if (!WHATSAPP_ENABLED || !WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
    return false;
  }

  try {
    const response = await fetch(GRAPH_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

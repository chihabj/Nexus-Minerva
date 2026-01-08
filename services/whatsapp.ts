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

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppTemplateParams {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: any[];
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
 * Envoie un template WhatsApp via l'API Meta Cloud
 * 
 * @param to - Numéro de téléphone du destinataire (format E.164 sans +)
 * @param templateName - Nom du template approuvé (ex: 'hello_world')
 * @param languageCode - Code langue du template (défaut: 'en_US')
 */
export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = 'en_US',
  components = [],
}: WhatsAppTemplateParams): Promise<WhatsAppResponse> {
  
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
    url: GRAPH_API_URL,
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
 * Envoie le template hello_world (template par défaut du Sandbox)
 */
export async function sendHelloWorldTemplate(to: string): Promise<WhatsAppResponse> {
  return sendWhatsAppTemplate({
    to,
    templateName: 'hello_world',
    languageCode: 'en_US',
  });
}

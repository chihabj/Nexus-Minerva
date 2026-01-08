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
 */
export interface RappelVisiteTechniqueParams {
  to: string;
  clientName: string;
  vehicleName: string;
  dateEcheance: string;
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
 * Envoie le template "rappel_visite_technique" avec les variables du client
 * 
 * Variables du template:
 * - {{1}} = Nom du client
 * - {{2}} = Véhicule
 * - {{3}} = Date d'échéance
 */
export async function sendRappelVisiteTechnique({
  to,
  clientName,
  vehicleName,
  dateEcheance,
}: RappelVisiteTechniqueParams): Promise<WhatsAppResponse> {
  
  const components: TemplateComponent[] = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: clientName || 'Client' },      // {{1}}
        { type: 'text', text: vehicleName || 'Véhicule' },   // {{2}}
        { type: 'text', text: dateEcheance || 'Bientôt' },   // {{3}}
      ],
    },
  ];

  return sendWhatsAppTemplate({
    to,
    templateName: 'rappel_visite_technique',
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

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
  isRateLimited?: boolean;
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
 * Paramètres spécifiques pour le template rappel_visite_technique (v2 simplifié)
 * 
 * Variables du template:
 * - {{1}} nomCentre: Nom complet du centre (ex: "Bourg-la-Reine - Autosur")
 * - {{2}} dateProchVis: Date de la prochaine visite (format: DD/MM/YYYY)
 * 
 * Boutons:
 * - "Prendre RDV": Bouton URL avec la short_url du centre
 * - "Nous appeler": Bouton téléphone avec le numéro du centre
 */
export interface RappelVisiteTechniqueParams {
  to: string;
  templateName?: string; // Nom du template WhatsApp spécifique au centre
  nomCentre: string;           // {{1}} - Ex: "Bourg-la-Reine - Autosur"
  dateProchVis: string;        // {{2}} - Format: DD/MM/YYYY
  shortUrlRendezVous: string;  // URL pour le bouton "Prendre RDV"
  numeroAppelCentre: string;   // Numéro de téléphone pour le bouton "Nous appeler"
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
      
      // Detect rate limiting (HTTP 429 or specific error codes)
      const isRateLimited = response.status === 429 || 
        data.error?.code === 130429 || // WhatsApp rate limit error code
        data.error?.message?.toLowerCase().includes('rate') ||
        data.error?.message?.toLowerCase().includes('limit') ||
        data.error?.message?.toLowerCase().includes('too many');
      
      if (isRateLimited) {
        console.warn('🚨 Rate limit détecté par l\'API WhatsApp');
      }
      
      return {
        success: false,
        error: data.error?.message || `Erreur API: ${response.status}`,
        isRateLimited,
      };
    }

    console.log('✅ WhatsApp message sent:', data);
    
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    console.error('❌ WhatsApp API Exception:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur réseau';
    return {
      success: false,
      error: errorMessage,
      isRateLimited: errorMessage.toLowerCase().includes('rate') || errorMessage.toLowerCase().includes('limit'),
    };
  }
}

/**
 * Envoie le template rappel visite technique (v2 simplifié) avec les variables du client
 * 
 * Variables du template (dans l'ordre):
 * - {{1}} nomCentre: Nom complet du centre (ex: "Bourg-la-Reine - Autosur")
 * - {{2}} dateProchVis: Date de la prochaine visite
 * 
 * Boutons:
 * - Index 0: "Prendre RDV" (URL)
 * - Index 1: "Nous appeler" (Téléphone)
 */
export async function sendRappelVisiteTechnique({
  to,
  templateName,
  nomCentre,
  dateProchVis,
  shortUrlRendezVous,
  numeroAppelCentre,
}: RappelVisiteTechniqueParams): Promise<WhatsAppResponse> {
  
  // Utiliser le template spécifique au centre, ou le template par défaut
  const finalTemplateName = templateName || 'rappel_visite_technique_vf';
  
  // Template simplifié: 2 variables
  // {{1}} nomCentre, {{2}} dateProchVis
  const bodyParameters = [
    { type: 'text', text: nomCentre || 'N/A' },      // {{1}} Centre
    { type: 'text', text: dateProchVis || 'N/A' },   // {{2}} Date prochaine visite
  ];

  const components: TemplateComponent[] = [
    {
      type: 'body',
      parameters: bodyParameters,
    },
    // Bouton "Prendre RDV" (URL)
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

  // Pour les templates par centre (avec boutons statiques), ne pas envoyer les composants de boutons
  const hasStaticButtons = templateName && templateName !== 'rappel_visite_technique_vf';
  
  const finalComponents = hasStaticButtons 
    ? components.filter(c => c.type !== 'button') // Seulement le body
    : components; // Tous les composants

  console.log(`📤 Utilisation du template: ${finalTemplateName} (boutons statiques: ${hasStaticButtons})`);

  return sendWhatsAppTemplate({
    to,
    templateName: finalTemplateName,
    languageCode: 'en', // Templates are registered in English in Meta
    components: finalComponents,
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

/**
 * Envoie le template de suivi "assistance_rdv" pour proposer un appel
 * 
 * Ce message est envoyé après qu'un client ait lu le premier message de relance
 * mais n'a pas répondu après 2 heures.
 * 
 * Template Meta requis: "assistance_rdv"
 * Corps: "Bonjour ! Suite à notre précédent message, souhaitez-vous qu'on vous appelle 
 *         pour vous assister dans la prise de votre prochain rendez-vous ?"
 * 
 * Boutons Quick Reply (configurés dans Meta):
 * - "Oui, appelez-moi"
 * - "Non merci"
 * 
 * @param to - Numéro de téléphone du destinataire
 * @param clientName - Nom du client (optionnel, pour personnaliser le message si le template le supporte)
 */
export async function sendAssistanceRdvTemplate(
  to: string,
  clientName?: string
): Promise<WhatsAppResponse> {
  
  // Le template assistance_rdv peut avoir 1 variable optionnelle pour le nom
  const components: TemplateComponent[] = clientName 
    ? [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: clientName },
          ],
        },
      ]
    : [];

  return sendWhatsAppTemplate({
    to,
    templateName: 'assistance_rdv',
    languageCode: 'fr',
    components,
  });
}

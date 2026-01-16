/**
 * WhatsApp Webhook for Vercel Serverless Functions
 * 
 * This endpoint handles:
 * 1. Webhook verification (GET request from Meta)
 * 2. Incoming messages (POST requests from Meta)
 * 
 * Environment variables needed:
 * - WHATSAPP_VERIFY_TOKEN: Your custom verify token for webhook setup
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_KEY: Your Supabase service role key (for server-side operations)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role key for server-side operations
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'nexus_webhook_verify_2024';
const OUR_PHONE_NUMBER = process.env.WHATSAPP_PHONE_NUMBER || '33767668396'; // Without +

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Type definitions for WhatsApp webhook payloads
interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'reaction' | 'sticker';
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  document?: { id: string; mime_type: string; sha256: string; filename: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; caption?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  reaction?: { message_id: string; emoji: string };
}

interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}

interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: { display_phone_number: string; phone_number_id: string };
      contacts?: Array<{ profile: { name: string }; wa_id: string }>;
      messages?: WhatsAppMessage[];
      statuses?: WhatsAppStatus[];
    };
    field: string;
  }>;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

/**
 * GET handler - Webhook verification
 */
async function handleVerification(req: VercelRequest, res: VercelResponse) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('📥 Webhook verification request:', { mode, token, challenge });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    return res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed');
    return res.status(403).json({ error: 'Verification failed' });
  }
}

/**
 * Find or create a conversation for a phone number
 */
async function getOrCreateConversation(phone: string, contactName?: string) {
  // Clean phone number (remove + if present)
  const cleanPhone = phone.startsWith('+') ? phone.substring(1) : phone;
  
  // Try to find existing conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('client_phone', cleanPhone)
    .single();

  if (existing) {
    return existing;
  }

  // Try to find client by phone
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, phone')
    .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
    .single();

  // Create new conversation
  const { data: newConversation, error } = await supabase
    .from('conversations')
    .insert({
      client_id: client?.id || null,
      client_phone: cleanPhone,
      client_name: contactName || client?.name || null,
      status: 'open',
      unread_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }

  return newConversation;
}

/**
 * Save an incoming message to the database
 */
async function saveIncomingMessage(
  conversationId: string,
  message: WhatsAppMessage,
  contactName?: string
) {
  const messageData = {
    conversation_id: conversationId,
    wa_message_id: message.id,
    from_phone: message.from,
    to_phone: OUR_PHONE_NUMBER,
    direction: 'inbound' as const,
    message_type: message.type,
    content: message.text?.body || message.image?.caption || message.document?.caption || message.video?.caption || null,
    media_url: null, // TODO: Download media and store URL
    status: 'delivered' as const,
    metadata: {
      timestamp: message.timestamp,
      contact_name: contactName,
      ...(message.image && { image: message.image }),
      ...(message.document && { document: message.document }),
      ...(message.audio && { audio: message.audio }),
      ...(message.video && { video: message.video }),
      ...(message.location && { location: message.location }),
      ...(message.reaction && { reaction: message.reaction }),
    },
  };

  const { data, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select()
    .single();

  if (error) {
    console.error('Error saving message:', error);
    throw error;
  }

  console.log('✅ Message saved:', data.id);
  return data;
}

/**
 * Update message status (sent/delivered/read)
 */
async function updateMessageStatus(waMessageId: string, status: string) {
  const { error } = await supabase
    .from('messages')
    .update({ status })
    .eq('wa_message_id', waMessageId);

  if (error) {
    console.error('Error updating message status:', error);
  } else {
    console.log(`✅ Message ${waMessageId} status updated to ${status}`);
  }
}

/**
 * POST handler - Process incoming messages and status updates
 */
async function handleIncomingWebhook(req: VercelRequest, res: VercelResponse) {
  try {
    const payload = req.body as WhatsAppWebhookPayload;
    
    console.log('📥 Incoming webhook:', JSON.stringify(payload, null, 2));

    if (payload.object !== 'whatsapp_business_account') {
      return res.status(400).json({ error: 'Invalid webhook object' });
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        // Process incoming messages
        if (value.messages && value.messages.length > 0) {
          const contactName = value.contacts?.[0]?.profile?.name;
          
          for (const message of value.messages) {
            console.log(`📩 New message from ${message.from}: ${message.text?.body || `[${message.type}]`}`);
            
            // Get or create conversation
            const conversation = await getOrCreateConversation(message.from, contactName);
            
            // Save the message
            await saveIncomingMessage(conversation.id, message, contactName);
          }
        }

        // Process status updates (sent, delivered, read)
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            console.log(`📊 Status update for ${status.id}: ${status.status}`);
            await updateMessageStatus(status.id, status.status);
          }
        }
      }
    }

    // Always respond with 200 to acknowledge receipt
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    // Still return 200 to prevent Meta from retrying
    return res.status(200).json({ success: false, error: 'Internal error' });
  }
}

/**
 * Main handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return handleVerification(req, res);
  }

  if (req.method === 'POST') {
    return handleIncomingWebhook(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

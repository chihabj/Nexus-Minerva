// ===========================================
// DATABASE TYPES (matching Supabase schema)
// ===========================================

// Workflow statuses for reminders
export type ReminderStatus = 
  | 'New'                    // Nouveau client importé
  | 'Pending'                // En attente de réponse client (manuel)
  | 'Reminder1_sent'         // Relance J-30 envoyée
  | 'Reminder2_sent'         // Relance J-15 envoyée
  | 'Reminder3_sent'         // Relance J-7 envoyée
  | 'Onhold'                 // Client a répondu, attente action agent
  | 'To_be_called'           // J-3 sans réponse, appel requis
  | 'To_be_contacted'        // Client demande à être rappelé
  | 'Appointment_confirmed'  // RDV confirmé
  | 'Closed'                 // Dossier fermé
  | 'Completed';             // Visite effectuée (futur)
export type NoteType = 'note' | 'call' | 'appointment' | 'system';
export type MessageSender = 'user' | 'agent' | 'system';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageType = 'text' | 'template' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'reaction' | 'system';
export type ConversationStatus = 'open' | 'resolved' | 'pending';
export type CenterStatus = 'Connected' | 'Pending' | 'Disconnected';
export type MappingConfidence = 'High' | 'Low' | 'None';
export type UserRole = 'superadmin' | 'admin' | 'agent';
export type NotificationType = 'info' | 'warning' | 'error' | 'success' | 'action_required';
export type ReminderActionType = 'whatsapp' | 'call' | 'email';
export type MessageTemplateCategory = 'greeting' | 'confirmation' | 'reminder' | 'closing' | 'general';

// Client table
export interface Client {
  id: string;
  created_at: string;
  updated_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  vehicle: string | null;
  vehicle_year: number | null;
  last_visit: string | null;
  status: ReminderStatus;
  region: string | null;
  center_id: string | null;
  center_name: string | null;
}

// Reminder table (for Dashboard)
export interface Reminder {
  id: string;
  created_at: string;
  updated_at: string;
  client_id: string;
  due_date: string;           // Date d'échéance (last_visit + 2 ans)
  reminder_date: string;      // Date d'envoi (due_date - 30 jours)
  status: ReminderStatus;
  message: string | null;
  message_template: string | null;
  // Workflow tracking
  last_reminder_sent: 'J30' | 'J15' | 'J7' | null;  // Dernière relance envoyée
  last_reminder_at: string | null;                   // Date de la dernière relance
  response_received_at: string | null;               // Date de réponse client
  agent_notes: string | null;                        // Notes de l'agent
  // Joined fields from clients
  client?: Client;
}

// Conversation table (for WhatsApp conversations)
export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  client_id: string | null;
  client_phone: string;
  client_name: string | null;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
  status: ConversationStatus;
  assigned_agent: string | null;
  // Joined fields
  client?: Client;
  messages?: Message[];
}

// Message table (WhatsApp messages)
export interface Message {
  id: string;
  created_at: string;
  conversation_id: string;
  wa_message_id: string | null;
  from_phone: string;
  to_phone: string;
  direction: MessageDirection;
  message_type: MessageType;
  content: string | null;
  template_name: string | null;
  media_url: string | null;
  status: MessageStatus;
  error_message: string | null;
  metadata: Record<string, any>;
  // Joined fields
  conversation?: Conversation;
}

// TechCenter table
export interface TechCenter {
  id: string;
  created_at: string;
  name: string;
  staff_count: number;
  status: CenterStatus;
  region: string;
  address: string | null;
  phone: string | null;
  short_url: string | null;  // URL courte pour la réservation en ligne (ex: https://qr1.be/LYBCLW)
  network: string | null;     // Réseau du centre (ex: SECTA, AUTOSUR)
  template_name: string | null; // Nom du template WhatsApp spécifique au centre (ex: rappel_autosur__montgeron)
}

// ClientNote table (for internal notes on clients)
export interface ClientNote {
  id: string;
  created_at: string;
  client_id: string;
  content: string;
  author: string;
  note_type: NoteType;
}

// Mapping fields for import feature
export interface MappingField {
  dbField: string;
  label: string;
  required: boolean;
  mappedColumn?: string;
  confidence: MappingConfidence;
  sampleValue?: string;
}

// User Profile (extends Supabase auth.users)
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  center_id: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

// Reminder Step (workflow definition)
export interface ReminderStep {
  id: string;
  step_order: number;
  days_before_due: number;
  action_type: ReminderActionType;
  template_name: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

// Reminder Log (tracks sent reminders)
export interface ReminderLog {
  id: string;
  reminder_id: string;
  step_id: string | null;
  action_type: ReminderActionType;
  status: MessageStatus;
  sent_at: string | null;
  response_received: boolean;
  response_text: string | null;
  error_message: string | null;
  created_at: string;
}

// Notification
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// Message Template (pre-registered quick replies)
export interface MessageTemplate {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  content: string;
  category: MessageTemplateCategory;
  shortcut: string | null;
  is_active: boolean;
  sort_order: number;
}

// ===========================================
// SUPABASE DATABASE TYPE HELPER
// ===========================================

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: Client;
        Insert: Omit<Client, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Client, 'id' | 'created_at'>>;
      };
      reminders: {
        Row: Reminder;
        Insert: Omit<Reminder, 'id' | 'created_at'>;
        Update: Partial<Omit<Reminder, 'id' | 'created_at'>>;
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Conversation, 'id' | 'created_at'>>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at'>;
        Update: Partial<Omit<Message, 'id' | 'created_at'>>;
      };
      tech_centers: {
        Row: TechCenter;
        Insert: Omit<TechCenter, 'id' | 'created_at'>;
        Update: Partial<Omit<TechCenter, 'id' | 'created_at'>>;
      };
      client_notes: {
        Row: ClientNote;
        Insert: Omit<ClientNote, 'id' | 'created_at'>;
        Update: Partial<Omit<ClientNote, 'id' | 'created_at'>>;
      };
    };
  };
}
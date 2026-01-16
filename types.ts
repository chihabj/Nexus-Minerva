// ===========================================
// DATABASE TYPES (matching Supabase schema)
// ===========================================

export type ReminderStatus = 'Ready' | 'Pending' | 'Sent' | 'Failed' | 'Resolved';
export type NoteType = 'note' | 'call' | 'appointment' | 'system';
export type MessageSender = 'user' | 'agent' | 'system';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageType = 'text' | 'template' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'reaction' | 'system';
export type ConversationStatus = 'open' | 'resolved' | 'pending';
export type CenterStatus = 'Connected' | 'Pending' | 'Disconnected';
export type MappingConfidence = 'High' | 'Low' | 'None';

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
  client_id: string;
  due_date: string;           // Date d'échéance (last_visit + 2 ans)
  reminder_date: string;      // Date d'envoi (due_date - 30 jours)
  status: ReminderStatus;
  message: string | null;
  message_template: string | null;
  sent_at: string | null;
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

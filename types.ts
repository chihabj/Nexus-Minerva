// ===========================================
// DATABASE TYPES (matching Supabase schema)
// ===========================================

export type ReminderStatus = 'Ready' | 'Pending' | 'Sent' | 'Failed';
export type MessageSender = 'user' | 'agent' | 'system';
export type MessageStatus = 'sent' | 'delivered' | 'read';
export type CenterStatus = 'Connected' | 'Pending' | 'Disconnected';
export type MappingConfidence = 'High' | 'Low' | 'None';

// Client table
export interface Client {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  vehicle: string | null;
  vehicle_year: number | null;
  last_visit: string | null;
  status: ReminderStatus;
  region: string | null;
  center_id: string | null;
}

// Reminder table (for Dashboard)
export interface Reminder {
  id: string;
  created_at: string;
  client_id: string;
  reminder_date: string;
  status: ReminderStatus;
  message: string | null;
  sent_at: string | null;
  // Joined fields from clients
  client?: Client;
}

// Message table
export interface Message {
  id: string;
  created_at: string;
  client_id: string;
  sender: MessageSender;
  text: string;
  status: MessageStatus;
  read_at: string | null;
  // Joined fields
  client?: Client;
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
    };
  };
}

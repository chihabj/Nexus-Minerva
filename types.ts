
export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  lastVisit: string;
  status: 'Ready' | 'Pending' | 'Sent' | 'Failed';
  region: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
}

export interface TechCenter {
  id: string;
  name: string;
  staffCount: number;
  status: 'Connected' | 'Pending' | 'Disconnected';
  region: string;
}

export interface MappingField {
  dbField: string;
  label: string;
  required: boolean;
  mappedColumn?: string;
  confidence: 'High' | 'Low' | 'None';
  sampleValue?: string;
}

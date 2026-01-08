/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_WHATSAPP_API_TOKEN: string;
  readonly VITE_WHATSAPP_PHONE_ID: string;
  readonly VITE_WHATSAPP_BUSINESS_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


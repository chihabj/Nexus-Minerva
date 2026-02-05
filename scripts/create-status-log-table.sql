-- Table pour stocker TOUS les statuts WhatsApp reçus
-- Permet de réconcilier les statuts même si le message n'existe pas encore (race condition)

CREATE TABLE IF NOT EXISTS whatsapp_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Identifiant du message WhatsApp (clé de réconciliation)
  wa_message_id TEXT NOT NULL,
  
  -- Statut reçu: sent, delivered, read, failed
  status TEXT NOT NULL,
  
  -- Téléphone du destinataire
  recipient_phone TEXT,
  
  -- Erreurs éventuelles (pour les failed)
  errors JSONB,
  
  -- Suivi de la réconciliation
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  
  -- Lien vers le message (NULL si pas encore réconcilié)
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL
);

-- Index pour rechercher par wa_message_id (réconciliation)
CREATE INDEX IF NOT EXISTS idx_status_log_wa_message_id 
ON whatsapp_status_log(wa_message_id);

-- Index pour trouver les statuts non traités
CREATE INDEX IF NOT EXISTS idx_status_log_unprocessed 
ON whatsapp_status_log(processed) 
WHERE NOT processed;

-- Index pour le nettoyage des vieux logs
CREATE INDEX IF NOT EXISTS idx_status_log_created_at 
ON whatsapp_status_log(created_at);

-- Commentaires
COMMENT ON TABLE whatsapp_status_log IS 'Log de tous les statuts WhatsApp reçus via webhook pour traçabilité et réconciliation';
COMMENT ON COLUMN whatsapp_status_log.wa_message_id IS 'ID du message WhatsApp retourné par Meta';
COMMENT ON COLUMN whatsapp_status_log.processed IS 'TRUE si le statut a été appliqué au message correspondant';
COMMENT ON COLUMN whatsapp_status_log.message_id IS 'Référence au message après réconciliation';

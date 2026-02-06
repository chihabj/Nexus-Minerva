-- Ajout des champs pour le suivi des follow-up "Souhaitez-vous qu'on vous appelle?"
-- Ce message est envoyé quand:
-- - La première relance a été envoyée il y a 2h+
-- - Le message a été marqué "read" par WhatsApp
-- - Heure actuelle entre 9h et 19h
-- - Statut = Reminder1_sent

-- Champ pour tracker si le follow-up a été envoyé
ALTER TABLE reminders 
ADD COLUMN IF NOT EXISTS follow_up_sent BOOLEAN DEFAULT FALSE;

-- Champ pour la date d'envoi du follow-up
ALTER TABLE reminders 
ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ;

-- Index pour optimiser la requête du cron job
CREATE INDEX IF NOT EXISTS idx_reminders_followup 
ON reminders(status, follow_up_sent) 
WHERE status = 'Reminder1_sent' AND follow_up_sent = FALSE;

-- Commentaires
COMMENT ON COLUMN reminders.follow_up_sent IS 'TRUE si le message de suivi "Souhaitez-vous qu''on vous appelle?" a été envoyé';
COMMENT ON COLUMN reminders.follow_up_sent_at IS 'Date/heure d''envoi du message de suivi';

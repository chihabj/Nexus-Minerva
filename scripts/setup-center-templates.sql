-- ===========================================
-- SETUP CENTER TEMPLATES
-- Ajoute la colonne template_name et configure les templates par centre
-- ===========================================

-- 1. Ajouter les colonnes si elles n'existent pas
ALTER TABLE tech_centers ADD COLUMN IF NOT EXISTS template_name TEXT;
ALTER TABLE tech_centers ADD COLUMN IF NOT EXISTS short_url TEXT;
ALTER TABLE tech_centers ADD COLUMN IF NOT EXISTS network TEXT;

-- 2. Mettre à jour les centres existants avec leurs templates
-- (Les noms doivent correspondre exactement aux noms dans Meta Business Manager)

-- AUTOSUR - MONTGERON
UPDATE tech_centers 
SET template_name = 'rappel_autosur__montgeron',
    network = 'AUTOSUR'
WHERE LOWER(name) LIKE '%montgeron%';

-- AUTOSUR - MORANGIS
UPDATE tech_centers 
SET template_name = 'rappel_autosur__morangis',
    network = 'AUTOSUR'
WHERE LOWER(name) LIKE '%morangis%';

-- AUTOSUR - RIS-ORANGIS
UPDATE tech_centers 
SET template_name = 'rappel__autosur__ris_orangis',
    network = 'AUTOSUR'
WHERE LOWER(name) LIKE '%ris%orangis%' OR LOWER(name) LIKE '%ris-orangis%';

-- AUTOSUR - NEMOURS
UPDATE tech_centers 
SET template_name = 'rappel__autosur__nemours',
    network = 'AUTOSUR'
WHERE LOWER(name) LIKE '%nemours%';

-- AUTOSUR - EVRY
UPDATE tech_centers 
SET template_name = 'rappel_autosur__evry',
    network = 'AUTOSUR'
WHERE LOWER(name) LIKE '%evry%';

-- AUTOSUR - MONTATAIRE
UPDATE tech_centers 
SET template_name = 'rappel_autosur__montataire',
    network = 'AUTOSUR'
WHERE LOWER(name) LIKE '%montataire%';

-- AUTOSUR - LORMONT
UPDATE tech_centers 
SET template_name = 'rappel_autosur__lormont',
    network = 'AUTOSUR'
WHERE LOWER(name) LIKE '%lormont%';

-- AUTOSUR - LESPARRE-MÉDOC
UPDATE tech_centers 
SET template_name = 'rappel_autosur__lesparremdoc',
    network = 'AUTOSUR'
WHERE LOWER(name) LIKE '%lesparre%' OR LOWER(name) LIKE '%médoc%' OR LOWER(name) LIKE '%medoc%';

-- AUTOSUR - BOURG-LA-REINE
UPDATE tech_centers 
SET template_name = 'rappel_autosur__bourglareine',
    network = 'AUTOSUR'
WHERE LOWER(name) LIKE '%bourg%la%reine%' OR LOWER(name) LIKE '%bourg-la-reine%';

-- AUTOSUR - CASTELNAU-DE-MÉDOC
UPDATE tech_centers 
SET template_name = 'rappel__autosur__castelnaumdoc',
    network = 'AUTOSUR'
WHERE LOWER(name) LIKE '%castelnau%';

-- 3. Vérifier les résultats
SELECT id, name, template_name, network, phone, short_url 
FROM tech_centers 
ORDER BY name;

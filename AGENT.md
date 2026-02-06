# AGENT.md - Minerva CT / Nexus Connect CRM

> Ce fichier contient toutes les règles et le contexte global du projet pour permettre à un agent AI d'avoir le knowledge complet à tout moment.

---

## 📌 Métadonnées Documentation

| Info | Valeur |
|------|--------|
| **Version** | 2.2.0 |
| **Dernière mise à jour** | 2026-01-23 |
| **Branche principale** | main |
| **Branche active** | main |

### Historique des mises à jour
| Version | Date | Description |
|---------|------|-------------|
| 2.2.0 | 2026-01-23 | Follow-up "Souhaitez-vous qu'on vous appelle?" avec Quick Reply |
| 2.1.0 | 2026-01-23 | Ajout système de log des statuts WhatsApp + réconciliation |
| 2.0.0 | 2026-01-23 | Notifications cliquables + batch sending avec rate limit |
| 1.0.0 | 2026-01-22 | Version initiale de la documentation |

---

## 📋 Projet Overview

| Attribut | Valeur |
|----------|--------|
| **Nom** | Minerva CT (Nexus Connect CRM) |
| **Objectif** | CRM pour centres de contrôle technique avec relances WhatsApp automatisées |
| **URL Production** | https://nexus-minerva.vercel.app |
| **Repo GitHub** | https://github.com/chihabj/Nexus-Minerva |

---

## 🏗️ Stack Technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Vercel Serverless Functions |
| Database | Supabase (PostgreSQL) |
| Messaging | Meta WhatsApp Cloud API |
| AI | Google Gemini (mapping intelligent import) |
| Auth | Supabase Auth (JWT automatique) |

---

## 📁 Structure du Projet

```
/api/                    # Serverless functions Vercel
  webhook.ts             # Webhook WhatsApp (réception messages + statuts)
  cron/send-reminders.ts # Cron quotidien (10h30) - relances auto
  cron/send-followups.ts # Cron horaire Lun-Ven 9h-17h - follow-up "Vous appeler?"

/views/                  # Pages React
  Dashboard.tsx          # KPIs + Actions urgentes + Pipeline 30j
  TodoList.tsx           # Tâches agent (Onhold, To_be_called, etc.)
  Inbox.tsx              # Messagerie WhatsApp
  Clients.tsx            # Annuaire clients
  ClientDetails.tsx      # Fiche client détaillée
  ImportData.tsx         # Import CSV/Excel avec mapping intelligent
  Settings.tsx           # Paramètres (superadmin only)
  Centers.tsx            # Gestion des centres techniques
  Login.tsx              # Authentification
  Documentation.tsx      # Documentation intégrée

/hooks/
  useDashboardData.ts    # Logique KPIs et tables dashboard
  useImportProcess.ts    # Logique d'import avec mapping AI + batch sending

/services/
  supabaseClient.ts      # Client Supabase (anon key)
  whatsapp.ts            # Envoi messages WhatsApp (frontend)
  geminiService.ts       # AI pour mapping colonnes CSV
  statusReconciliation.ts # Réconciliation des statuts WhatsApp (NEW)

/actions/
  sendReminder.ts        # Envoi de relances WhatsApp unitaires et batch

/utils/
  centerMatcher.ts       # Matching centres par similarité de nom
  dataNormalizer.ts      # Normalisation téléphone/date/email
  excelParser.ts         # Parsing fichiers Excel/CSV

/contexts/
  AuthContext.tsx        # Authentification + gestion rôles

/scripts/                # Scripts utilitaires Node.js
  truncate-clients.mjs   # Vider la base clients (+ reminders, messages, etc.)
  create-superadmin.mjs  # Créer utilisateurs admin
  setup-database.mjs     # Setup initial DB
  check-db-state.mjs     # Vérifier l'état des tables
  fix-sent-conversations.mjs  # Réparer les conversations
  create-status-log-table.sql # SQL pour la table de log des statuts
  add-followup-fields.sql     # SQL pour les champs follow_up sur reminders
```

---

## 🔄 Workflow des Relances Automatiques

```
IMPORT CLIENT
    ↓
  [New]
    ↓ (J-30 avant échéance)
  [Reminder1_sent] → WhatsApp template envoyé
    │
    ├── Si message "read" + 2h sans réponse + heures ouvrées (9h-19h)
    │   → Envoie follow-up "Souhaitez-vous qu'on vous appelle?"
    │   → follow_up_sent = TRUE
    │   │
    │   ├── Client répond "Oui, appelez-moi" → [To_be_called] (sort du workflow)
    │   └── Client répond "Non merci" → [Onhold]
    │
    ↓ (J-15, si pas de réponse)
  [Reminder2_sent] → WhatsApp envoyé
    ↓ (J-7, si pas de réponse)
  [Reminder3_sent] → WhatsApp envoyé
    ↓ (J-3, si pas de réponse)
  [To_be_called] → Appel requis (pas de message)

ÉVÉNEMENTS INTERRUPTION :
  • Client répond       → [Onhold] (agent doit décider)
  • WhatsApp KO (131026)→ [To_be_called] + whatsapp_available=false
  • Agent confirme RDV  → [Appointment_confirmed]
  • Agent ferme dossier → [Closed]
```

---

## 📊 Statuts Reminder (ReminderStatus)

| Statut | Description | Visible dans |
|--------|-------------|--------------|
| `New` | Nouveau client importé | - |
| `Pending` | En attente manuelle | TodoList (En attente) |
| `Reminder1_sent` | J-30 envoyé | Messages |
| `Reminder2_sent` | J-15 envoyé | Messages |
| `Reminder3_sent` | J-7 envoyé | Messages |
| `Onhold` | Client a répondu | TodoList (À traiter) |
| `To_be_called` | J-3 ou WhatsApp KO | TodoList (À appeler) |
| `To_be_contacted` | Client demande rappel | TodoList (À recontacter) |
| `Appointment_confirmed` | RDV confirmé | Dashboard |
| `Closed` | Dossier fermé | - |
| `Completed` | Visite effectuée | - |

### Constantes associées (types.ts)
```typescript
export const FINAL_STATUSES = ['Appointment_confirmed', 'Closed', 'Completed'];
export const ACTION_STATUSES = ['To_be_contacted', 'Onhold', 'To_be_called'];
export const REMINDER_SENT_STATUSES = ['Reminder1_sent', 'Reminder2_sent', 'Reminder3_sent'];
```

---

## 🗄️ Tables Supabase

| Table | Description | Clés étrangères |
|-------|-------------|-----------------|
| `clients` | Clients avec infos véhicule | center_id → tech_centers |
| `reminders` | Dossiers de relance (1 par client) | client_id → clients |
| `conversations` | Conversations WhatsApp | client_id → clients |
| `messages` | Messages WhatsApp | conversation_id → conversations |
| `tech_centers` | Centres techniques | - |
| `client_notes` | Notes internes | client_id → clients |
| `user_profiles` | Utilisateurs (auth) | - |
| `notifications` | Notifications agents | user_id → user_profiles |
| `message_templates` | Réponses rapides | - |
| `reminder_logs` | Historique des relances | reminder_id → reminders |
| `reminder_steps` | Configuration workflow (jours) | - |
| `whatsapp_status_log` | **NEW** Log de tous les statuts WhatsApp | message_id → messages |

### Champs importants clients
- `whatsapp_available` (boolean) : false = ne jamais envoyer WhatsApp
- `center_id` / `center_name` : Lien vers le centre technique
- `immatriculation`, `marque`, `modele`, `vin` : Infos véhicule

### Champs importants reminders
- `status_changed_at` : Date du dernier changement de statut (pour KPIs)
- `last_reminder_sent` : 'J30' | 'J15' | 'J7' | null
- `response_received_at` : Date de réponse client

### Table whatsapp_status_log (NOUVELLE)
```sql
CREATE TABLE whatsapp_status_log (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ,
  wa_message_id TEXT NOT NULL,     -- ID message WhatsApp (clé de réconciliation)
  status TEXT NOT NULL,            -- sent, delivered, read, failed
  recipient_phone TEXT,
  errors JSONB,
  processed BOOLEAN DEFAULT FALSE, -- TRUE si appliqué au message
  processed_at TIMESTAMPTZ,
  message_id UUID REFERENCES messages(id)
);
```

**But** : Stocker TOUS les statuts WhatsApp reçus via webhook pour :
1. Traçabilité complète
2. Réconciliation (quand le webhook arrive avant l'insertion du message)

---

## 📱 WhatsApp Integration

### Webhook (api/webhook.ts)
- **GET** : Vérification Meta (`hub.verify_token`)
- **POST** : Réception messages entrants + statuts de livraison

### Flux de statut avec réconciliation

```
1. Message envoyé → API WhatsApp retourne wa_message_id
2. Meta envoie webhook "delivered" (peut arriver AVANT insertion en base)
3. Webhook → TOUJOURS logger dans whatsapp_status_log (processed=false)
4. Webhook → Tente de mettre à jour le message
   - Si trouvé → update + log processed=true
   - Si non trouvé → log reste processed=false
5. Message inséré en base de données
6. Réconciliation → Cherche les statuts en attente pour ce wa_message_id
7. Applique le statut le plus récent (read > delivered > sent)
8. Marque les logs comme processed=true
```

### Gestion des erreurs Meta
| Code | Signification | Action |
|------|---------------|--------|
| `131026` | Numéro sans WhatsApp | `whatsapp_available=false` + `To_be_called` |
| `131049` | Spam protection | Note système, pas de désactivation |
| `131047/48` | Rate limiting | Note système, pas de désactivation |

### Rate Limiting et Batch Sending

**Configuration (useImportProcess.ts)** :
```typescript
const BATCH_CONFIG = {
  BATCH_SIZE: 10,                    // Messages par batch
  DELAY_BETWEEN_MESSAGES: 1500,      // 1.5s entre chaque message
  DELAY_BETWEEN_BATCHES: 10000,      // 10s entre chaque batch
  RATE_LIMIT_PAUSE: 30000,           // 30s pause si rate limit détecté
};
```

**Détection rate limit** :
- Code HTTP 429
- Code erreur Meta 130429
- 3+ échecs consécutifs

### Templates WhatsApp

**⚠️ IMPORTANT** : Les boutons URL dans les templates Meta ne supportent PAS les URLs dynamiques. C'est pourquoi **un template par centre** est créé, avec l'URL de réservation en dur.

#### Template simplifié (v2)
Variables :
- `{{1}}` : Nom du centre (ex: "Bourg-la-Reine - Autosur")
- `{{2}}` : Date prochaine visite (ex: "01/03/2026")

Boutons (statiques par centre) :
- "Prendre RDV" → URL fixe du centre
- "Appeler" → Numéro fixe du centre

### Statuts de message affichés (Inbox)
| Statut | Icône | Couleur |
|--------|-------|---------|
| `sent` | ✓ | Gris |
| `delivered` | ✓✓ | Gris |
| `read` | ✓✓ | Bleu |
| `failed` | ❌ | Rouge |

---

## 🔔 Notifications

### Types de notifications
| Type | Icône | Description |
|------|-------|-------------|
| `info` | ℹ️ | Information générale |
| `warning` | ⚠️ | Avertissement |
| `success` | ✅ | Succès |
| `action_required` | 🔔 | Action requise par l'agent |

### Notifications cliquables (NEW v2.0)
Les notifications peuvent contenir un `link` qui navigue vers la page concernée :

```typescript
// Exemple : notification de réponse client
createNotificationForAdmins(
  '💬 Nouveau message WhatsApp',
  `${contactName}: ${content}`,
  'info',
  `/inbox?phone=${encodeURIComponent(cleanedFromPhone)}`  // Lien vers la conversation
);
```

**Liens générés** :
- Nouveau message → `/inbox?phone=33612345678`
- Nouveau contact → `/inbox?phone=...`
- Réponse client → `/inbox?phone=...`

**UI** : Les notifications avec lien affichent "Cliquez pour voir" + icône chevron.

---

## 🔑 Variables d'Environnement

### Frontend (.env.local)
```env
VITE_SUPABASE_URL=https://aefzpamcvbzzcgwkuita.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_WHATSAPP_API_TOKEN=EAAL...
VITE_WHATSAPP_PHONE_ID=902557892947329
VITE_WHATSAPP_BUSINESS_ID=268874247480706
```

### Vercel (pour API/Cron)
```env
SUPABASE_URL=https://aefzpamcvbzzcgwkuita.supabase.co
SUPABASE_SERVICE_KEY=eyJ... (service_role key)
WHATSAPP_VERIFY_TOKEN=nexus_webhook_verify_2024
```

### ⚠️ Attention
- **URL Supabase correcte** : `aefzpamcvbzzcgwkuita.supabase.co`
- Les scripts doivent utiliser la **service_role key** pour écrire (bypass RLS)

---

## 👥 Rôles Utilisateurs

| Rôle | Accès |
|------|-------|
| `superadmin` | Tout (Settings, Users, Import, etc.) |
| `admin` | Import, Centres, Clients |
| `agent` | Dashboard, TodoList, Messages, Clients |

### Comptes de test
| Email | Mot de passe | Rôle |
|-------|--------------|------|
| `superadmin@minerva-ct.fr` | `superadmin123` | superadmin |
| `admin@minerva-ct.fr` | `admin123` | admin |
| `agent@minerva-ct.fr` | `agent123` | agent |

---

## 🚀 Cron Jobs

### 1. Relances automatiques (api/cron/send-reminders.ts)

- **Horaire** : 10h30 Paris (`30 9 * * *`)
- **Délai entre envois** : 1500ms (rate limit protection)
- **Workflow** :
  - J-30 : `New` → `Reminder1_sent`
  - J-15 : `Reminder1_sent`/`Pending` → `Reminder2_sent`
  - J-7 : `Reminder2_sent`/`Pending` → `Reminder3_sent`
  - J-3 : `Reminder3_sent`/`Pending` → `To_be_called` (pas de message)

### 2. Follow-up "Assistance RDV" (api/cron/send-followups.ts) - NEW

- **Horaire** : Toutes les heures Lun-Ven 9h à 17h Paris (`0 7-16 * * 1-5`)
- **Weekend** : Pas d'envoi. Les messages lus samedi/dimanche sont envoyés lundi matin automatiquement
- **Template** : `assistance_rdv` (Quick Reply buttons)
- **Message** : "Souhaitez-vous qu'on vous appelle pour vous assister dans la prise de votre prochain rendez-vous ?"

**Conditions d'envoi** :
1. Statut = `Reminder1_sent`
2. Premier message lu ("read") par WhatsApp
3. Envoyé depuis 2h+ sans réponse
4. Heure actuelle entre 9h et 19h (Paris)
5. `follow_up_sent = FALSE`

**Boutons Quick Reply** :
- "Oui, appelez-moi" → `To_be_called` (sort du workflow)
- "Non merci" → `Onhold` (agent décide)

### Statuts NON traités par les crons
- `Onhold` : Client a répondu, attente décision agent
- `To_be_called` : Déjà marqué pour appel
- `Appointment_confirmed`, `Closed`, `Completed` : Finaux

---

## 🎯 Règles Métier Importantes

1. **Onhold** = Workflow auto STOPPÉ, agent doit décider
2. **whatsapp_available=false** = Ne JAMAIS envoyer WhatsApp
3. **Templates par centre** = URL de réservation statique dans le template
4. **Matching centres** = Par similarité de nom (centerMatcher.ts)
5. **Normalisation téléphone** = Format E.164 (+33..., +212...)
6. **Boutons URL/Phone** = Pas de tracking possible (pas de callback Meta)
7. **Quick Reply buttons** = Trackables via webhook (utilisé pour follow-up)
8. **Rate limiting** = 1.5s entre chaque message, pause 30s si détecté
9. **Statuts WhatsApp** = TOUJOURS loggés dans whatsapp_status_log
10. **Réconciliation** = Automatique après chaque insertion de message
11. **Follow-up "read"** = Envoyé 2h après lecture si pas de réponse (9h-19h)

---

## 🛠️ Scripts Utilitaires

```bash
# Vider la base clients (+ reminders, messages, conversations, notes)
node scripts/truncate-clients.mjs

# Créer un utilisateur admin
node scripts/create-superadmin.mjs

# Vérifier l'état de la base de données
node scripts/check-db-state.mjs

# Réparer les conversations mal loguées
node scripts/fix-sent-conversations.mjs

# Vérifier si la table whatsapp_status_log existe
node scripts/run-sql.mjs
```

### Connexion directe Supabase (pour scripts)
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://aefzpamcvbzzcgwkuita.supabase.co',
  'SERVICE_ROLE_KEY' // Nécessaire pour bypass RLS
);
```

---

## ⚠️ Points d'Attention / Pièges Courants

1. **Mauvaise URL Supabase** : Utiliser `aefzpamcvbzzcgwkuita`, pas l'ancienne
2. **RLS Policies** : Les scripts Node.js doivent utiliser service_role key
3. **Boutons URL** : Pas de tracking possible (Meta ne notifie pas les clics)
4. **Templates Meta** : URLs statiques, donc 1 template par centre
5. **Duplications messages** : Vérifier `wa_message_id` pour éviter doublons
6. **Git credentials** : Le compte `chihabJekwip` est collaborateur du repo
7. **Cron timing** : 10h30 Paris = 9h30 UTC (`30 9 * * *`)
8. **Race condition statuts** : Le webhook peut arriver AVANT l'insertion → utiliser la réconciliation
9. **Truncate DB** : NE JAMAIS truncate sans demande explicite de l'utilisateur
10. **PowerShell** : `&&` ne fonctionne pas, utiliser `;` ou commandes séparées

---

## 📝 Changelog Notable

### v2.3.0 (2026-01-23)
- **Documentation in-app** : Page `/documentation` avec 8 onglets (Prise en main, Dashboard, Todo List, Messages, Import, Clients & Centres, Workflow, FAQ)
- **Sidebar** : Lien Documentation ajouté en bas de la navigation
- **README.md** : Réécriture complète pour GitHub (structure, setup, workflow, tables DB, rôles, déploiement)
- **Cron follow-up** : Ajusté Lun-Ven 9h-17h Paris (`0 7-16 * * 1-5`), pas d'envoi le weekend

### v2.2.0 (2026-01-23)
- **Follow-up "Assistance RDV"** : Message de suivi envoyé 2h après lecture
- **Quick Reply buttons** : "Oui, appelez-moi" / "Non merci"
- **Nouveau cron** : `send-followups.ts` (Lun-Ven 9h-17h, weekend skip → envoi lundi)
- **Champs reminders** : `follow_up_sent`, `follow_up_sent_at`
- **Webhook** : Gestion des réponses Quick Reply → To_be_called ou Onhold

### v2.1.0 (2026-01-23)
- **whatsapp_status_log** : Nouvelle table pour logger tous les statuts
- **Réconciliation automatique** : Service `statusReconciliation.ts`
- **Webhook amélioré** : Log avant update pour éviter la perte de statuts

### v2.0.0 (2026-01-23)
- **Notifications cliquables** : Navigation vers la conversation
- **Batch sending** : Rate limit protection (1.5s entre messages)
- **Progress indicator** : Affichage progression pendant l'import

### v1.x
- Template WhatsApp v2 : Simplifié à 2 variables (centre + date)
- Dashboard redesign : KPIs cliquables + tables urgences
- TodoList : Ajout statut "Pending", scroll complet
- Inbox : Notification visuelle pour clics de boutons
- Clients : Colonne "Matricule" au lieu de "Véhicule"

---

## 📋 TODO / Roadmap

### Priorité Haute
- [ ] **Réinitialisation mot de passe** : Page "Mot de passe oublié" + email reset
- [ ] **Changement mot de passe** : Section dans Settings pour utilisateur connecté
- [ ] **Page reset-password** : Traiter le lien de réinitialisation Supabase
- [ ] **UTM Tracking** : Ajouter tracking des clics boutons URL via raccourcisseur

### Priorité Moyenne
- [ ] **Cron réconciliation** : Endpoint pour réconcilier les statuts orphelins
- [ ] **Email de bienvenue** : Envoyer credentials aux nouveaux utilisateurs
- [ ] **Assignation agents** : Assigner des clients/centres à des agents spécifiques
- [ ] **Rapports/Stats** : Dashboard avec métriques avancées par période

### Priorité Basse
- [ ] **Confirmation email** : Flow complet de vérification email
- [ ] **Multi-langue** : Support FR/EN
- [ ] **Export données** : Export CSV/Excel des clients/reminders

---

## 🔗 Liens Utiles

- [Supabase Dashboard](https://supabase.com/dashboard/project/aefzpamcvbzzcgwkuita)
- [Meta Business Manager](https://business.facebook.com/)
- [Vercel Dashboard](https://vercel.com/)
- [WhatsApp API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api/)

---

## 📚 Comment Mettre à Jour Cette Documentation

### Quand mettre à jour
- Nouvelle fonctionnalité majeure
- Nouvelle table en base de données
- Changement de workflow
- Nouveau script utilitaire
- Bug important corrigé

### Comment mettre à jour
1. Incrémenter la version dans les métadonnées
2. Ajouter une ligne dans l'historique des mises à jour
3. Mettre à jour la section concernée
4. Ajouter au changelog si notable
5. Commiter avec message `docs: update AGENT.md to vX.Y.Z`

### Conventions de version
- **MAJOR** (X.0.0) : Changement majeur d'architecture ou de workflow
- **MINOR** (0.X.0) : Nouvelle fonctionnalité
- **PATCH** (0.0.X) : Correction ou mise à jour mineure de la doc

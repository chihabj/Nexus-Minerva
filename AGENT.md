# AGENT.md - Minerva CT / Nexus Connect CRM

> Ce fichier contient toutes les règles et le contexte global du projet pour permettre à un agent AI d'avoir le knowledge complet à tout moment.

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
  useImportProcess.ts    # Logique d'import avec mapping AI

/services/
  supabaseClient.ts      # Client Supabase (anon key)
  whatsapp.ts            # Envoi messages WhatsApp (frontend)
  geminiService.ts       # AI pour mapping colonnes CSV

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
  check-*.mjs            # Scripts de diagnostic
```

---

## 🔄 Workflow des Relances Automatiques

```
IMPORT CLIENT
    ↓
  [New]
    ↓ (J-30 avant échéance)
  [Reminder1_sent] → WhatsApp envoyé
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

### Champs importants clients
- `whatsapp_available` (boolean) : false = ne jamais envoyer WhatsApp
- `center_id` / `center_name` : Lien vers le centre technique
- `immatriculation`, `marque`, `modele`, `vin` : Infos véhicule

### Champs importants reminders
- `status_changed_at` : Date du dernier changement de statut (pour KPIs)
- `last_reminder_sent` : 'J30' | 'J15' | 'J7' | null
- `response_received_at` : Date de réponse client

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

## 📱 WhatsApp Integration

### Webhook (api/webhook.ts)
- **GET** : Vérification Meta (`hub.verify_token`)
- **POST** : Réception messages entrants + statuts de livraison

### Gestion des erreurs Meta
| Code | Signification | Action |
|------|---------------|--------|
| `131026` | Numéro sans WhatsApp | `whatsapp_available=false` + `To_be_called` |
| `131049` | Spam protection | Note système, pas de désactivation |
| `131047/48` | Rate limiting | Note système, pas de désactivation |

### Templates WhatsApp

**⚠️ IMPORTANT** : Les boutons URL dans les templates Meta ne supportent PAS les URLs dynamiques. C'est pourquoi **un template par centre** est créé, avec l'URL de réservation en dur.

#### Template simplifié (v2)
Variables :
- `{{1}}` : Nom du centre (ex: "Bourg-la-Reine - Autosur")
- `{{2}}` : Date prochaine visite (ex: "01/03/2026")

Boutons (statiques par centre) :
- "Prendre RDV" → URL fixe du centre
- "Appeler" → Numéro fixe du centre

#### Stockage templates par centre
Chaque centre dans `tech_centers` a un champ `template_name` qui référence son template WhatsApp spécifique.

### Types de messages trackés
- `text` : Message texte normal
- `template` : Message template envoyé
- `button` / `interactive` : Clic sur bouton (Quick Reply uniquement)
- `image`, `document`, `audio`, `video` : Médias

**Note** : Les boutons URL et Phone ne génèrent PAS de callback webhook (l'action sort de WhatsApp).

---

## 🚀 Cron Job (api/cron/send-reminders.ts)

- **Horaire** : 10h30 Paris (`30 9 * * *` dans vercel.json)
- **Workflow** :
  - J-30 : `New` → `Reminder1_sent`
  - J-15 : `Reminder1_sent`/`Pending` → `Reminder2_sent`
  - J-7 : `Reminder2_sent`/`Pending` → `Reminder3_sent`
  - J-3 : `Reminder3_sent`/`Pending` → `To_be_called` (pas de message)

### Statuts NON traités par le cron
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
7. **Quick Reply buttons** = Seuls boutons trackables via webhook

---

## 🛠️ Scripts Utilitaires

```bash
# Vider la base clients (+ reminders, messages, conversations, notes)
node scripts/truncate-clients.mjs

# Créer un utilisateur admin
node scripts/create-superadmin.mjs

# Vérifier statuts des reminders
node scripts/check-reminders-status.mjs

# Vérifier conversations
node scripts/check-conversations.mjs

# Vérifier statut WhatsApp des clients
node scripts/check-whatsapp-status.mjs
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

---

## 📝 Changelog Notable

- **Template WhatsApp v2** : Simplifié à 2 variables (centre + date)
- **Dashboard redesign** : KPIs cliquables + tables urgences
- **TodoList** : Ajout statut "Pending", scroll complet
- **Inbox** : Notification visuelle pour clics de boutons
- **Clients** : Colonne "Matricule" au lieu de "Véhicule"

---

## 🔗 Liens Utiles

- [Supabase Dashboard](https://supabase.com/dashboard/project/aefzpamcvbzzcgwkuita)
- [Meta Business Manager](https://business.facebook.com/)
- [Vercel Dashboard](https://vercel.com/)
- [WhatsApp API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api/)

# Minerva CT - Nexus Connect CRM

> Plateforme CRM opérationnelle pour la gestion des relances de contrôle technique automobile via WhatsApp.

## Aperçu

Minerva CT (Nexus Connect CRM) est un outil interne conçu pour les centres de contrôle technique. Il automatise les rappels clients via WhatsApp et centralise le suivi des dossiers de relance.

### Fonctionnalités principales

- **Dashboard opérationnel** : KPIs en temps réel, actions urgentes, pipeline 30 jours
- **Relances WhatsApp automatiques** : Workflow J-30 / J-15 / J-7 / J-3 avec suivi de livraison et lecture
- **Follow-up intelligent** : Message de suivi automatique si la relance est lue mais sans réponse (Lun-Ven 9h-17h)
- **Messagerie WhatsApp** : Interface de conversation intégrée avec templates et statuts de livraison
- **Import de données** : Import Excel/CSV avec mapping IA (Gemini) et validation automatique
- **Todo List** : File d'attente des actions agents (appels, réponses en attente, relances)
- **Gestion des clients et centres** : Fiches clients, notes internes, configuration par centre
- **Notifications temps réel** : Alertes cliquables lors de réponses clients
- **Rôles et permissions** : SuperAdmin / Admin / Agent avec accès différenciés

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Routing | React Router (HashRouter) |
| Base de données | Supabase (PostgreSQL + Auth + Realtime) |
| Hébergement | Vercel (frontend + serverless functions + cron jobs) |
| WhatsApp | Meta Cloud API (Business) |
| IA (mapping import) | Google Gemini |

## Structure du projet

```
Nexus/
├── api/                        # Serverless functions (Vercel)
│   ├── cron/
│   │   ├── send-reminders.ts   # Cron quotidien 10h30 - relances automatiques
│   │   └── send-followups.ts   # Cron horaire Lun-Ven 9h-17h - follow-up
│   └── webhook.ts              # Webhook WhatsApp (messages + statuts)
├── actions/
│   └── sendReminder.ts         # Envoi unitaire de relance
├── contexts/
│   └── AuthContext.tsx          # Contexte d'authentification Supabase
├── hooks/
│   ├── useDashboardData.ts     # Logique Dashboard (KPIs, queries)
│   └── useImportProcess.ts     # Logique import (parsing, validation, batch send)
├── services/
│   ├── supabaseClient.ts       # Client Supabase
│   ├── whatsapp.ts             # API WhatsApp (templates, messages)
│   ├── geminiService.ts        # IA Gemini (mapping colonnes)
│   └── statusReconciliation.ts # Réconciliation statuts WhatsApp
├── utils/
│   ├── excelParser.ts          # Parser Excel/CSV
│   ├── dataNormalizer.ts       # Normalisation des données
│   └── centerMatcher.ts        # Matching des centres techniques
├── views/
│   ├── Dashboard.tsx           # Dashboard opérationnel
│   ├── TodoList.tsx            # File d'attente agents
│   ├── Inbox.tsx               # Messagerie WhatsApp
│   ├── ImportData.tsx          # Import de données
│   ├── Clients.tsx             # Liste des clients
│   ├── ClientDetails.tsx       # Fiche client
│   ├── Centers.tsx             # Gestion des centres
│   ├── Settings.tsx            # Paramètres (SuperAdmin)
│   ├── Documentation.tsx       # Documentation utilisateur in-app
│   └── Login.tsx               # Page de connexion
├── App.tsx                     # Composant racine (routing, sidebar, topbar)
├── types.ts                    # Types TypeScript
├── AGENT.md                    # Documentation technique / règles projet
├── .cursorrules                # Règles Cursor AI
└── vercel.json                 # Configuration Vercel (crons, rewrites)
```

## Installation locale

### Prérequis

- Node.js >= 18
- Compte Supabase
- Compte Meta Business (WhatsApp Business API)
- Compte Vercel (pour le déploiement)

### Setup

1. Cloner le repository :
```bash
git clone https://github.com/chihabj/Nexus-Minerva.git
cd Nexus-Minerva
```

2. Installer les dépendances :
```bash
npm install
```

3. Configurer les variables d'environnement - créer un fichier `.env.local` :
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre_anon_key
VITE_WHATSAPP_API_TOKEN=votre_token_whatsapp
VITE_WHATSAPP_PHONE_ID=votre_phone_id
```

4. Lancer le serveur de développement :
```bash
npm run dev
```

### Variables d'environnement Vercel (backend)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_KEY` | Clé service_role Supabase (bypass RLS) |
| `VITE_WHATSAPP_API_TOKEN` | Token API WhatsApp permanent (System User) |
| `VITE_WHATSAPP_PHONE_ID` | Phone Number ID WhatsApp Business |
| `API_KEY` | Clé API Google Gemini |

## Workflow de relance

```
[Import Client] → New
       │
       │  J-30 (Cron 10h30)
       ▼
  Reminder1_sent  ──→ [Client répond] → Onhold → Agent traite
       │
       │  J-15
       ▼
  Reminder2_sent  ──→ [Client répond] → Onhold
       │
       │  J-7
       ▼
  Reminder3_sent  ──→ [Client répond] → Onhold
       │
       │  J-3
       ▼
  To_be_called    ──→ Agent appelle → Appointment_confirmed / Closed
```

**Follow-up automatique** : Si la 1ère relance est lue sans réponse (2h+), un message de suivi est envoyé (Lun-Ven 9h-17h).

## Cron Jobs

| Cron | Schedule | Description |
|------|----------|-------------|
| `send-reminders` | `30 9 * * *` (10h30 Paris) | Relances automatiques J-30/J-15/J-7/J-3 |
| `send-followups` | `0 7-16 * * 1-5` (9h-17h Lun-Ven Paris) | Follow-up si message lu sans réponse |

## Base de données

### Tables principales

| Table | Description |
|-------|-------------|
| `clients` | Informations clients (nom, téléphone, véhicule, centre) |
| `reminders` | Dossiers de relance avec statut du workflow |
| `conversations` | Conversations WhatsApp |
| `messages` | Messages individuels avec statut de livraison |
| `tech_centers` | Centres techniques (config, template WhatsApp) |
| `user_profiles` | Profils utilisateurs (rôle, email) |
| `notifications` | Notifications temps réel |
| `whatsapp_status_log` | Log des statuts WhatsApp (réconciliation) |
| `reminder_steps` | Configuration du workflow de relance |
| `message_templates` | Templates de messages pré-enregistrés |
| `client_notes` | Notes internes sur les clients |

## Rôles utilisateurs

| Rôle | Accès |
|------|-------|
| `superadmin` | Tout (Settings, Workflow, Users) |
| `admin` | Dashboard, Todo, Messages, Import, Clients, Centres |
| `agent` | Dashboard, Todo, Messages, Clients |

## Déploiement

Le projet est déployé sur **Vercel** (Team Pro "Minerva CT"). Chaque push sur `main` déclenche un déploiement automatique.

```bash
git push origin main
```

## Scripts utiles

```bash
npm run dev        # Serveur de développement
npm run build      # Build de production
npm run preview    # Prévisualiser le build
```

Scripts de maintenance (dans `scripts/`) :
- `setup-database.mjs` - Configuration initiale de la base
- `create-superadmin.mjs` - Création d'un super-admin
- `truncate-clients.mjs` - Vidage de la base clients (avec confirmation)

## Documentation

- **In-app** : Page `/documentation` accessible à tous les utilisateurs connectés
- **Technique** : Fichier `AGENT.md` à la racine (contexte projet, règles, changelog)
- **Cursor AI** : Fichier `.cursorrules` (règles pour l'assistant IA)

## Changelog

Voir `AGENT.md` pour le changelog complet.

---

**Minerva CT** - Nexus Connect CRM | Développé pour les centres de contrôle technique

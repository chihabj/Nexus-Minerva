# 📘 Présentation Complète de la Plateforme Nexus Connect CRM

## Table des Matières

1. [Présentation de l'outil](#1-présentation-de-loutil)
2. [Fonctionnalités principales](#2-fonctionnalités-principales)
3. [Workflows détaillés](#3-workflows-détaillés)
4. [Architecture technique](#4-architecture-technique)
5. [Guide de navigation du code](#5-guide-de-navigation-du-code)

---

## 1. Présentation de l'outil

### 1.1 Qu'est-ce que Nexus Connect CRM ?

**Nexus Connect CRM** est une plateforme opérationnelle interne conçue spécialement pour les **centres de contrôle technique**. Elle permet de gérer efficacement la relation client, les relances automatiques, et le suivi des visites techniques.

### 1.2 Objectifs principaux

- ✅ **Automatiser les relances** : Envoi automatique de rappels WhatsApp aux clients avant l'échéance de leur contrôle technique
- ✅ **Centraliser la communication** : Interface unique pour gérer toutes les conversations WhatsApp avec les clients
- ✅ **Suivre le pipeline** : Tableau de bord opérationnel pour visualiser les cas urgents et le pipeline des relances
- ✅ **Importer des données** : Import intelligent de fichiers Excel/CSV avec mapping automatique assisté par IA
- ✅ **Gérer les centres** : Administration des centres techniques et de leurs configurations

### 1.3 Public cible

- **Agents** : Gestion des conversations, suivi des clients, mise à jour des statuts
- **Administrateurs** : Import de données, gestion des centres, configuration
- **Super-administrateurs** : Accès complet, paramètres système

---

## 2. Fonctionnalités principales

### 2.1 Dashboard Opérationnel

**Fichier** : `views/Dashboard.tsx`

Le dashboard est le cockpit opérationnel de la plateforme. Il affiche :

#### KPIs (Indicateurs clés)
- 🔴 **Cas en retard** : Clients dont l'échéance est dépassée
- 🟠 **Échéance ≤7j** : Clients avec échéance dans les 7 prochains jours
- 🟡 **Pipeline ≤30j** : Clients avec échéance dans les 30 prochains jours
- 🟣 **Actions requises** : Cas nécessitant une intervention (en attente, à appeler, etc.)
- 🟢 **Confirmés aujourd'hui** : RDV confirmés dans la journée

#### Tables de données
- **Actions Urgentes** : Liste triée par urgence des cas nécessitant une action immédiate
- **Pipeline 30 jours** : Vue d'ensemble des clients avec échéance dans le mois

**Fonctionnalités** :
- Filtrage par centre technique
- Filtrage par KPI (cliquer sur une carte filtre la table)
- Actualisation manuelle
- Navigation rapide vers les détails client ou la messagerie

### 2.2 Messagerie WhatsApp (Inbox)

**Fichier** : `views/Inbox.tsx`

Interface de messagerie complète pour gérer les conversations WhatsApp avec les clients.

#### Fonctionnalités principales
- 📱 **Liste des conversations** : Toutes les conversations WhatsApp organisées par statut
- 💬 **Envoi de messages** : Envoi de messages texte directement depuis l'interface
- 📋 **Templates de messages** : Réponses rapides pré-configurées avec variables dynamiques
- 🏷️ **Gestion des statuts** : Changement de statut du dossier directement depuis la conversation
- 🔍 **Recherche et filtres** : Filtres par statut (À traiter, En cours, Résolus, etc.)
- 📊 **Informations client** : Panneau latéral avec détails du client, véhicule, et statut du dossier

#### Filtres disponibles
- **Tous** : Toutes les conversations
- **À traiter** : Conversations nécessitant une action (Onhold, To_be_called, To_be_contacted)
- **En cours** : Conversations en cours de traitement
- **En attente** : Conversations en attente de réponse
- **Résolus** : Conversations terminées
- **Relances automatiques** : Relances envoyées sans réponse du client

### 2.3 Import de données

**Fichier** : `views/ImportData.tsx`

Système d'import intelligent avec mapping automatique assisté par IA.

#### Processus en 4 étapes

1. **Upload** : Téléchargement du fichier Excel/CSV
2. **Mapping** : Association des colonnes du fichier aux champs de la base de données
   - **Auto-Match IA** : Utilise Gemini AI pour suggérer les mappings
   - **Mapping manuel** : Possibilité de corriger les suggestions
   - **Aperçu des données** : Visualisation des premières lignes du fichier
3. **Validation** : Vérification des données avant import
   - Détection des erreurs (champs requis manquants, formats invalides)
   - Détection des avertissements (données à normaliser)
4. **Import** : Enregistrement dans la base de données
   - Création automatique des clients
   - Création automatique des reminders (si échéance < 30 jours)
   - Option d'envoi immédiat des relances pour les cas urgents

#### Champs supportés
- Informations client : nom, email, téléphone
- Informations véhicule : marque, modèle, immatriculation, VIN, année
- Informations centre : centre technique, région
- Date de dernière visite

### 2.4 Gestion des clients

**Fichiers** : `views/Clients.tsx`, `views/ClientDetails.tsx`

#### Liste des clients
- Recherche et filtrage
- Affichage des informations principales
- Navigation vers les détails

#### Fiche client détaillée
- Informations complètes du client
- Historique des conversations
- Notes internes
- Historique des statuts
- Actions rapides (appel, WhatsApp, changement de statut)

### 2.5 Gestion des centres techniques

**Fichier** : `views/Centers.tsx`

Gestion des centres de contrôle technique :
- Liste des centres
- Configuration par centre :
  - Nom et adresse
  - Numéro de téléphone
  - URL de réservation en ligne
  - Réseau (SECTA, AUTOSUR, etc.)
  - Template WhatsApp spécifique

### 2.6 Todo List

**Fichier** : `views/TodoList.tsx`

Liste de tâches opérationnelles :
- Cas nécessitant une action
- Tri par urgence
- Filtres par statut
- Actions rapides

### 2.7 Paramètres

**Fichier** : `views/Settings.tsx`

Configuration système (super-admin uniquement) :
- Gestion des utilisateurs
- Configuration des templates de messages
- Paramètres système

---

## 3. Workflows détaillés

### 3.1 Workflow de relance automatique

Le système de relances automatiques suit un workflow précis basé sur les jours avant l'échéance.

#### Diagramme du workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW DE RELANCE AUTOMATIQUE               │
└─────────────────────────────────────────────────────────────────┘

    [Import Client]
         │
         ▼
    ┌─────────┐
    │  New    │  ← Nouveau client importé
    └────┬────┘
         │
         │ (J-30 : 30 jours avant échéance)
         ▼
    ┌─────────────────┐
    │ Reminder1_sent  │  ← Relance J-30 envoyée (WhatsApp)
    └────────┬────────┘
             │
             ├─→ [Client répond] ──→ ┌─────────┐
             │                      │  Onhold  │  ← En attente action agent
             │                      └────┬─────┘
             │                           │
             │                           ├─→ Appointment_confirmed
             │                           ├─→ To_be_contacted
             │                           └─→ Closed
             │
             │ (J-15 : 15 jours avant échéance)
             │ [Pas de réponse]
             ▼
    ┌─────────────────┐
    │ Reminder2_sent  │  ← Relance J-15 envoyée (WhatsApp)
    └────────┬────────┘
             │
             ├─→ [Client répond] ──→ Onhold
             │
             │ (J-7 : 7 jours avant échéance)
             │ [Pas de réponse]
             ▼
    ┌─────────────────┐
    │ Reminder3_sent  │  ← Relance J-7 envoyée (WhatsApp)
    └────────┬────────┘
             │
             ├─→ [Client répond] ──→ Onhold
             │
             │ (J-3 : 3 jours avant échéance)
             │ [Pas de réponse]
             ▼
    ┌─────────────────┐
    │ To_be_called    │  ← Appel téléphonique requis (agent)
    └────────┬────────┘
             │
             ├─→ Appointment_confirmed
             ├─→ To_be_contacted
             └─→ Closed

    [Statuts finaux]
    ┌──────────────────────┐
    │ Appointment_confirmed│  ← RDV confirmé
    │ Completed            │  ← Visite effectuée
    │ Closed               │  ← Dossier fermé
    └──────────────────────┘
```

#### Exécution automatique

**Fichier** : `api/cron/send-reminders.ts`

Le workflow est exécuté automatiquement chaque jour à **10h30** (heure de Paris) via un cron job Vercel.

**Configuration** : `vercel.json`
```json
"crons": [
  {
    "path": "/api/cron/send-reminders",
    "schedule": "30 9 * * *"  // 9h30 UTC = 10h30 Paris
  }
]
```

#### Étapes du workflow

1. **J-30** : 
   - Statut source : `New`
   - Action : Envoi WhatsApp avec template `rappel_visite_technique`
   - Nouveau statut : `Reminder1_sent`
   - Champ mis à jour : `last_reminder_sent = 'J30'`

2. **J-15** :
   - Statut source : `Reminder1_sent` ou `Pending`
   - Action : Envoi WhatsApp
   - Nouveau statut : `Reminder2_sent`
   - Champ mis à jour : `last_reminder_sent = 'J15'`

3. **J-7** :
   - Statut source : `Reminder2_sent` ou `Pending`
   - Action : Envoi WhatsApp
   - Nouveau statut : `Reminder3_sent`
   - Champ mis à jour : `last_reminder_sent = 'J7'`

4. **J-3** :
   - Statut source : `Reminder3_sent` ou `Pending`
   - Action : **Aucun message** (marquage pour appel)
   - Nouveau statut : `To_be_called`
   - Notification créée pour les agents

#### Gestion des réponses client

Quand un client répond à une relance :
- Le statut peut être changé manuellement à `Onhold` par l'agent
- Le champ `response_received_at` est mis à jour
- Le workflow automatique **ne traite pas** les statuts `Onhold` (le client a répondu, l'agent doit agir)

### 3.2 Workflow d'import de données

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW D'IMPORT DE DONNÉES                  │
└─────────────────────────────────────────────────────────────────┘

    [Étape 1 : Upload]
         │
         │ Fichier Excel/CSV
         ▼
    ┌──────────────┐
    │ Parse File   │  ← Lecture et parsing du fichier
    └──────┬───────┘
           │
           ▼
    [Étape 2 : Mapping]
         │
         ├─→ [Auto-Match IA] ──→ Suggestions Gemini AI
         │
         ├─→ [Mapping manuel] ──→ Correction des mappings
         │
         └─→ [Aperçu données] ──→ Visualisation des premières lignes
         │
         ▼
    [Étape 3 : Validation]
         │
         ├─→ Vérification champs requis
         ├─→ Validation formats
         ├─→ Normalisation données
         │
         └─→ Rapport d'erreurs/avertissements
         │
         ▼
    [Étape 4 : Import]
         │
         ├─→ Insertion clients dans DB
         ├─→ Création reminders (si échéance < 30j)
         │
         └─→ [Option] Envoi relances immédiat
```

**Fichiers clés** :
- `views/ImportData.tsx` : Interface utilisateur
- `hooks/useImportProcess.ts` : Logique métier
- `services/geminiService.ts` : Service IA pour le mapping
- `utils/excelParser.ts` : Parser Excel/CSV
- `utils/dataNormalizer.ts` : Normalisation des données

### 3.3 Workflow de communication WhatsApp

```
┌─────────────────────────────────────────────────────────────────┐
│              WORKFLOW DE COMMUNICATION WHATSAPP                   │
└─────────────────────────────────────────────────────────────────┘

    [Message entrant (Webhook)]
         │
         ▼
    ┌──────────────────┐
    │  Webhook Handler │  ← api/webhook.ts
    └────────┬─────────┘
             │
             ├─→ Création/Mise à jour conversation
             ├─→ Création message inbound
             ├─→ Mise à jour unread_count
             │
             └─→ Notification temps réel (Supabase Realtime)
             │
             ▼
    [Interface Inbox]
         │
         ├─→ Affichage conversation
         ├─→ Lecture messages
         │
         └─→ [Agent répond]
             │
             ▼
    ┌──────────────────┐
    │  sendTextMessage │  ← services/whatsapp.ts
    └────────┬─────────┘
             │
             ├─→ Envoi via Meta Cloud API
             ├─→ Création message outbound
             └─→ Mise à jour conversation
```

**Fichiers clés** :
- `api/webhook.ts` : Réception des messages entrants
- `services/whatsapp.ts` : Service d'envoi WhatsApp
- `views/Inbox.tsx` : Interface de messagerie

### 3.4 Workflow de changement de statut

```
┌─────────────────────────────────────────────────────────────────┐
│              WORKFLOW DE CHANGEMENT DE STATUT                    │
└─────────────────────────────────────────────────────────────────┘

    [Agent dans Inbox ou ClientDetails]
         │
         ▼
    ┌──────────────────────┐
    │  Sélection nouveau   │
    │      statut          │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │  Mise à jour DB      │  ← Supabase update
    └──────────┬───────────┘
               │
               ├─→ Update reminders.status
               ├─→ Update response_received_at (si Onhold)
               ├─→ Création note système
               │
               └─→ Notification temps réel
               │
               ▼
    [Dashboard mis à jour automatiquement]
```

**Transitions de statut autorisées** :
- `Onhold` → `Appointment_confirmed`, `To_be_contacted`, `Pending`, `Closed`
- `To_be_called` → `Appointment_confirmed`, `To_be_contacted`, `Closed`
- `To_be_contacted` → `Appointment_confirmed`, `Closed`
- `New` → `Onhold`, `Closed`
- `Pending` → `Onhold`, `Closed`
- `Reminder1_sent` / `Reminder2_sent` / `Reminder3_sent` → `Onhold`, `Appointment_confirmed`, `Closed`
- `Appointment_confirmed` → `Completed`, `To_be_contacted`

---

## 4. Architecture technique

### 4.1 Stack technologique

#### Frontend
- **React 19** : Framework UI
- **TypeScript** : Typage statique
- **Vite** : Build tool et dev server
- **React Router** : Navigation
- **Tailwind CSS** : Styling (via classes utilitaires)

#### Backend / Services
- **Supabase** : 
  - Base de données PostgreSQL
  - Authentification
  - Realtime (notifications temps réel)
  - Storage (si nécessaire)
- **Vercel** : 
  - Hosting frontend
  - Serverless functions (API routes)
  - Cron jobs

#### Services externes
- **Meta WhatsApp Business API** : Envoi de messages WhatsApp
- **Google Gemini AI** : Mapping intelligent des colonnes lors de l'import

### 4.2 Structure des dossiers

```
Nexus/
├── actions/              # Actions métier (envoi relances, etc.)
│   └── sendReminder.ts
├── api/                  # Routes API (Vercel serverless)
│   ├── cron/            # Cron jobs
│   │   └── send-reminders.ts
│   └── webhook.ts       # Webhook WhatsApp
├── contexts/            # Contextes React (Auth, etc.)
│   └── AuthContext.tsx
├── hooks/               # Hooks React personnalisés
│   ├── useDashboardData.ts
│   └── useImportProcess.ts
├── services/           # Services externes
│   ├── geminiService.ts    # Service IA
│   ├── supabaseClient.ts   # Client Supabase
│   └── whatsapp.ts         # Service WhatsApp
├── utils/              # Utilitaires
│   ├── centerMatcher.ts
│   ├── dataNormalizer.ts
│   └── excelParser.ts
├── views/              # Composants de pages
│   ├── Dashboard.tsx
│   ├── Inbox.tsx
│   ├── ImportData.tsx
│   ├── Clients.tsx
│   ├── ClientDetails.tsx
│   ├── Centers.tsx
│   ├── TodoList.tsx
│   ├── Settings.tsx
│   └── Login.tsx
├── App.tsx             # Composant racine
├── types.ts            # Types TypeScript
├── package.json        # Dépendances
└── vercel.json         # Configuration Vercel
```

### 4.3 Base de données (Supabase)

#### Tables principales

**clients**
- Informations des clients (nom, email, téléphone, véhicule, etc.)
- Relation avec `tech_centers` (center_id)

**reminders**
- Dossiers de relance pour chaque client
- Statut du workflow
- Dates importantes (due_date, reminder_date, etc.)
- Historique des relances (last_reminder_sent, last_reminder_at)

**conversations**
- Conversations WhatsApp avec les clients
- Métadonnées (dernier message, nombre de non-lus, statut)

**messages**
- Messages WhatsApp individuels
- Direction (inbound/outbound)
- Statut de livraison
- Type (text, template, etc.)

**tech_centers**
- Centres de contrôle technique
- Configuration (template WhatsApp, URL réservation, etc.)

**user_profiles**
- Profils utilisateurs (agents, admins)
- Rôles et permissions

**notifications**
- Notifications système pour les utilisateurs

**client_notes**
- Notes internes sur les clients

**reminder_logs**
- Historique des actions de relance

**message_templates**
- Templates de messages pré-configurés

#### Relations

```
clients (1) ──→ (N) reminders
clients (1) ──→ (N) conversations
conversations (1) ──→ (N) messages
clients (N) ──→ (1) tech_centers
clients (1) ──→ (N) client_notes
reminders (1) ──→ (N) reminder_logs
```

### 4.4 Authentification et permissions

**Fichier** : `contexts/AuthContext.tsx`

#### Rôles
- **superadmin** : Accès complet (settings, tous les centres)
- **admin** : Gestion des imports, centres, conversations
- **agent** : Accès limité (conversations, clients, dashboard)

#### Protection des routes
- Routes protégées par composant `ProtectedRoute` dans `App.tsx`
- Vérification des rôles avant affichage des sections

### 4.5 Intégration WhatsApp

**Fichier** : `services/whatsapp.ts`

#### Configuration
- **API** : Meta Cloud API (Graph API v17.0)
- **Templates** : Templates WhatsApp Business approuvés
- **Numéro** : Numéro WhatsApp Business configuré

#### Fonctionnalités
- Envoi de templates (relances automatiques)
- Envoi de messages texte (réponses agents)
- Support de templates par centre (configuration dans `tech_centers.template_name`)

#### Webhook
**Fichier** : `api/webhook.ts`
- Réception des messages entrants
- Création automatique des conversations
- Mise à jour temps réel

### 4.6 Intégration IA (Gemini)

**Fichier** : `services/geminiService.ts`

#### Utilisation
- Mapping intelligent des colonnes lors de l'import
- Analyse sémantique des noms de colonnes
- Suggestions de confiance (High, Low, None)

#### API
- Modèle : `gemini-3-flash-preview`
- Format de réponse : JSON structuré

### 4.7 Realtime (Supabase)

#### Abonnements
- **Messages** : Nouveaux messages en temps réel
- **Conversations** : Mises à jour des conversations
- **Notifications** : Nouvelles notifications

**Exemple dans Inbox.tsx** :
```typescript
const messagesChannel = supabase
  .channel('messages-changes')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'messages' },
    (payload) => {
      // Nouveau message reçu
    }
  )
  .subscribe();
```

---

## 5. Guide de navigation du code

### 5.1 Où trouver le code pour...

#### ... modifier le Dashboard
- **Fichier principal** : `views/Dashboard.tsx`
- **Logique métier** : `hooks/useDashboardData.ts`
- **Types** : `types.ts` (DashboardKPIs, UrgentActionItem, etc.)

#### ... modifier la messagerie WhatsApp
- **Interface** : `views/Inbox.tsx`
- **Envoi de messages** : `services/whatsapp.ts` (fonction `sendTextMessage`)
- **Réception de messages** : `api/webhook.ts`
- **Templates** : Table `message_templates` dans Supabase

#### ... modifier le workflow de relances
- **Cron job** : `api/cron/send-reminders.ts`
- **Action manuelle** : `actions/sendReminder.ts`
- **Templates WhatsApp** : `services/whatsapp.ts` (fonction `sendRappelVisiteTechnique`)

#### ... modifier l'import de données
- **Interface** : `views/ImportData.tsx`
- **Logique** : `hooks/useImportProcess.ts`
- **Parser Excel** : `utils/excelParser.ts`
- **Normalisation** : `utils/dataNormalizer.ts`
- **IA Mapping** : `services/geminiService.ts`

#### ... modifier l'authentification
- **Context** : `contexts/AuthContext.tsx`
- **Protection routes** : `App.tsx` (composant `ProtectedRoute`)
- **Table** : `user_profiles` dans Supabase

#### ... modifier les statuts de workflow
- **Types** : `types.ts` (type `ReminderStatus`)
- **Transitions** : `views/Inbox.tsx` (objet `STATUS_ACTIONS`)
- **Workflow automatique** : `api/cron/send-reminders.ts` (objet `WORKFLOW_STEPS`)

#### ... ajouter un nouveau champ client
1. **Base de données** : Ajouter la colonne dans la table `clients` (Supabase)
2. **Types** : Ajouter le champ dans `types.ts` (interface `Client`)
3. **Import** : Ajouter dans `hooks/useImportProcess.ts` (DB_FIELDS)
4. **Affichage** : Modifier `views/ClientDetails.tsx` et `views/Clients.tsx`

#### ... modifier les templates WhatsApp
- **Templates par centre** : Table `tech_centers.template_name`
- **Envoi template** : `services/whatsapp.ts` (fonction `sendRappelVisiteTechnique`)
- **Variables template** : Voir commentaire dans `services/whatsapp.ts` (lignes 54-68)

#### ... modifier les KPIs du Dashboard
- **Calcul** : `hooks/useDashboardData.ts` (fonction `kpis` useMemo)
- **Affichage** : `views/Dashboard.tsx` (composant `KPICard`)

#### ... ajouter une nouvelle vue/page
1. Créer le fichier dans `views/NouvelleVue.tsx`
2. Ajouter la route dans `App.tsx` :
   ```typescript
   <Route path="/nouvelle-vue" element={<ProtectedRoute><NouvelleVue /></ProtectedRoute>} />
   ```
3. Ajouter le lien dans la sidebar (`App.tsx`, composant `Sidebar`)

### 5.2 Points d'entrée principaux

#### Application React
- **Point d'entrée** : `index.tsx` → `App.tsx`
- **Routing** : `App.tsx` (HashRouter)
- **Authentification** : `App.tsx` (AuthProvider)

#### API Routes (Vercel)
- **Cron job** : `api/cron/send-reminders.ts`
- **Webhook** : `api/webhook.ts`

#### Services
- **Supabase** : `services/supabaseClient.ts`
- **WhatsApp** : `services/whatsapp.ts`
- **IA** : `services/geminiService.ts`

### 5.3 Configuration et variables d'environnement

#### Variables nécessaires

**Frontend** (`.env.local`) :
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_WHATSAPP_API_TOKEN=xxx
VITE_WHATSAPP_PHONE_ID=xxx
```

**Backend** (Vercel Environment Variables) :
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
VITE_WHATSAPP_API_TOKEN=xxx
VITE_WHATSAPP_PHONE_ID=xxx
API_KEY=xxx  # Pour Gemini AI
```

### 5.4 Scripts utiles

**Fichier** : `package.json`

```bash
npm run dev      # Démarrer le serveur de développement
npm run build    # Build de production
npm run preview  # Prévisualiser le build
```

**Scripts de maintenance** (dans `scripts/`) :
- `setup-database.mjs` : Configuration initiale de la base
- `create-superadmin.mjs` : Création d'un super-admin
- `check-whatsapp-status.mjs` : Vérification du statut WhatsApp
- `check-reminders-status.mjs` : Vérification des reminders

### 5.5 Débogage

#### Console logs
- Les logs sont préfixés avec des emojis pour faciliter le filtrage :
  - 📤 : Envoi de message
  - 📥 : Réception de message
  - ✅ : Succès
  - ❌ : Erreur
  - ⚠️ : Avertissement
  - 🔄 : Action en cours

#### Vérification des données
- **Supabase Dashboard** : Interface web pour voir les données
- **Console navigateur** : Logs React et requêtes API
- **Vercel Logs** : Logs des fonctions serverless (cron, webhook)

### 5.6 Tests et validation

#### Tester le workflow de relances
1. Créer un client avec `due_date` = aujourd'hui + 30 jours
2. Vérifier que le statut est `New`
3. Attendre le cron job (ou déclencher manuellement)
4. Vérifier que la relance J-30 est envoyée

#### Tester l'import
1. Préparer un fichier Excel avec des données de test
2. Importer via `views/ImportData.tsx`
3. Vérifier le mapping automatique
4. Valider et importer
5. Vérifier dans Supabase que les données sont créées

#### Tester la messagerie
1. Envoyer un message WhatsApp au numéro configuré
2. Vérifier que le webhook reçoit le message
3. Vérifier que la conversation apparaît dans `views/Inbox.tsx`
4. Répondre depuis l'interface
5. Vérifier que le message est envoyé

---

## 6. Diagrammes techniques supplémentaires

### 6.1 Architecture système

```
┌─────────────────────────────────────────────────────────────────┐
│                         ARCHITECTURE SYSTÈME                     │
└─────────────────────────────────────────────────────────────────┘

    [Utilisateur]
         │
         ▼
    ┌─────────────┐
    │   Browser   │  ← React App (Vite)
    └──────┬──────┘
           │
           ├─→ [Supabase] ──→ PostgreSQL DB
           │                 ├─ Realtime
           │                 └─ Auth
           │
           ├─→ [Vercel API] ──→ Serverless Functions
           │                     ├─ Cron Jobs
           │                     └─ Webhooks
           │
           └─→ [Services Externes]
                   ├─ Meta WhatsApp API
                   └─ Google Gemini AI
```

### 6.2 Flux de données Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUX DE DONNÉES DASHBOARD                     │
└─────────────────────────────────────────────────────────────────┘

    [useDashboardData Hook]
         │
         ├─→ Fetch reminders + clients (Supabase)
         │
         ├─→ Calcul KPIs (useMemo)
         │   ├─ overdueCount
         │   ├─ due7DaysCount
         │   ├─ due30DaysCount
         │   └─ actionsWaitingCount
         │
         ├─→ Calcul urgentActions (useMemo)
         │   ├─ Filtrage par statut
         │   ├─ Calcul urgence
         │   └─ Tri par priorité
         │
         └─→ Calcul pipeline30 (useMemo)
             ├─ Filtrage ≤30 jours
             └─ Tri par jours restants
         │
         ▼
    [Dashboard Component]
         │
         ├─→ Affichage KPIs (cartes cliquables)
         ├─→ Table Actions Urgentes
         └─→ Table Pipeline 30j
```

### 6.3 Flux d'envoi de relance

```
┌─────────────────────────────────────────────────────────────────┐
│                   FLUX D'ENVOI DE RELANCE                        │
└─────────────────────────────────────────────────────────────────┘

    [Cron Job / Action Manuelle]
         │
         ▼
    ┌──────────────────────┐
    │  sendReminderAction  │  ← actions/sendReminder.ts
    └──────────┬───────────┘
               │
               ├─→ Fetch reminder + client (Supabase)
               ├─→ Fetch tech_center (template_name)
               │
               ▼
    ┌──────────────────────┐
    │ sendRappelVisiteTech │  ← services/whatsapp.ts
    └──────────┬───────────┘
               │
               ├─→ Préparer variables template
               ├─→ Appel Meta Cloud API
               │
               ▼
    ┌──────────────────────┐
    │  Update Supabase     │
    └──────────┬───────────┘
               │
               ├─→ Update reminders.status
               ├─→ Create reminder_logs
               ├─→ Create/Update conversations
               └─→ Create messages (outbound)
```

---

## 7. Conseils pour les développeurs

### 7.1 Bonnes pratiques

1. **Types TypeScript** : Toujours utiliser les types définis dans `types.ts`
2. **Gestion d'erreurs** : Toujours gérer les erreurs avec try/catch et afficher des messages utilisateur
3. **Performance** : Utiliser `useMemo` et `useCallback` pour les calculs coûteux
4. **Realtime** : Nettoyer les abonnements Supabase dans les `useEffect` cleanup
5. **Logs** : Utiliser les préfixes emoji pour faciliter le débogage

### 7.2 Points d'attention

- ⚠️ **Rate limits WhatsApp** : Respecter les limites d'envoi (1 message/seconde max)
- ⚠️ **Cron job** : Ne pas traiter les reminders créés dans les 10 dernières minutes (éviter les doublons lors de l'import)
- ⚠️ **Templates WhatsApp** : Les templates doivent être approuvés par Meta avant utilisation
- ⚠️ **Variables d'environnement** : Ne jamais commiter les tokens dans le code

### 7.3 Extensions possibles

- 📧 **Notifications email** : Ajouter l'envoi d'emails en complément de WhatsApp
- 📊 **Rapports** : Génération de rapports PDF/Excel
- 🔔 **Alertes SMS** : Intégration d'un service SMS
- 📱 **App mobile** : Application React Native
- 🤖 **Chatbot** : Bot automatique pour répondre aux questions fréquentes

---

## Conclusion

Cette documentation couvre l'ensemble de la plateforme Nexus Connect CRM, de la présentation fonctionnelle aux détails techniques. Elle est conçue pour être accessible aux développeurs de tous niveaux.

Pour toute question ou clarification, référez-vous aux fichiers de code mentionnés dans chaque section.

**Dernière mise à jour** : Janvier 2026

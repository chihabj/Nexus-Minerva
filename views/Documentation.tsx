import React, { useState } from 'react';

type TabId = 'presentation' | 'fonctionnalites' | 'workflows' | 'architecture' | 'guide' | 'conseils';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { id: 'presentation', label: 'Présentation', icon: 'info' },
  { id: 'fonctionnalites', label: 'Fonctionnalités', icon: 'apps' },
  { id: 'workflows', label: 'Workflows', icon: 'account_tree' },
  { id: 'architecture', label: 'Architecture', icon: 'architecture' },
  { id: 'guide', label: 'Guide Code', icon: 'code' },
  { id: 'conseils', label: 'Conseils', icon: 'lightbulb' },
];

export default function Documentation() {
  const [activeTab, setActiveTab] = useState<TabId>('presentation');

  return (
    <div className="h-full flex flex-col bg-background-light dark:bg-background-dark">
      {/* Header */}
      <div className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            📘 Documentation Nexus Connect CRM
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Documentation complète de la plateforme - Guide technique et fonctionnel
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex gap-2 overflow-x-auto custom-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300'
                  }
                `}
              >
                <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {activeTab === 'presentation' && <PresentationContent />}
          {activeTab === 'fonctionnalites' && <FonctionnalitesContent />}
          {activeTab === 'workflows' && <WorkflowsContent />}
          {activeTab === 'architecture' && <ArchitectureContent />}
          {activeTab === 'guide' && <GuideContent />}
          {activeTab === 'conseils' && <ConseilsContent />}
        </div>
      </div>
    </div>
  );
}

function PresentationContent() {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h2>Présentation de l'outil</h2>
      
      <h3>Qu'est-ce que Nexus Connect CRM ?</h3>
      <p>
        <strong>Nexus Connect CRM</strong> est une plateforme opérationnelle interne conçue spécialement pour les <strong>centres de contrôle technique</strong>. 
        Elle permet de gérer efficacement la relation client, les relances automatiques, et le suivi des visites techniques.
      </p>

      <h3>Objectifs principaux</h3>
      <ul>
        <li>✅ <strong>Automatiser les relances</strong> : Envoi automatique de rappels WhatsApp aux clients avant l'échéance de leur contrôle technique</li>
        <li>✅ <strong>Centraliser la communication</strong> : Interface unique pour gérer toutes les conversations WhatsApp avec les clients</li>
        <li>✅ <strong>Suivre le pipeline</strong> : Tableau de bord opérationnel pour visualiser les cas urgents et le pipeline des relances</li>
        <li>✅ <strong>Importer des données</strong> : Import intelligent de fichiers Excel/CSV avec mapping automatique assisté par IA</li>
        <li>✅ <strong>Gérer les centres</strong> : Administration des centres techniques et de leurs configurations</li>
      </ul>

      <h3>Public cible</h3>
      <ul>
        <li><strong>Agents</strong> : Gestion des conversations, suivi des clients, mise à jour des statuts</li>
        <li><strong>Administrateurs</strong> : Import de données, gestion des centres, configuration</li>
        <li><strong>Super-administrateurs</strong> : Accès complet, paramètres système</li>
      </ul>
    </div>
  );
}

function FonctionnalitesContent() {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h2>Fonctionnalités principales</h2>

      <div className="space-y-8">
        <section>
          <h3>📊 Dashboard Opérationnel</h3>
          <p><strong>Fichier</strong> : <code>views/Dashboard.tsx</code></p>
          <p>Le dashboard est le cockpit opérationnel de la plateforme. Il affiche :</p>
          
          <h4>KPIs (Indicateurs clés)</h4>
          <ul>
            <li>🔴 <strong>Cas en retard</strong> : Clients dont l'échéance est dépassée</li>
            <li>🟠 <strong>Échéance ≤7j</strong> : Clients avec échéance dans les 7 prochains jours</li>
            <li>🟡 <strong>Pipeline ≤30j</strong> : Clients avec échéance dans les 30 prochains jours</li>
            <li>🟣 <strong>Actions requises</strong> : Cas nécessitant une intervention (en attente, à appeler, etc.)</li>
            <li>🟢 <strong>Confirmés aujourd'hui</strong> : RDV confirmés dans la journée</li>
          </ul>

          <h4>Tables de données</h4>
          <ul>
            <li><strong>Actions Urgentes</strong> : Liste triée par urgence des cas nécessitant une action immédiate</li>
            <li><strong>Pipeline 30 jours</strong> : Vue d'ensemble des clients avec échéance dans le mois</li>
          </ul>

          <p><strong>Fonctionnalités</strong> :</p>
          <ul>
            <li>Filtrage par centre technique</li>
            <li>Filtrage par KPI (cliquer sur une carte filtre la table)</li>
            <li>Actualisation manuelle</li>
            <li>Navigation rapide vers les détails client ou la messagerie</li>
          </ul>
        </section>

        <section>
          <h3>💬 Messagerie WhatsApp (Inbox)</h3>
          <p><strong>Fichier</strong> : <code>views/Inbox.tsx</code></p>
          <p>Interface de messagerie complète pour gérer les conversations WhatsApp avec les clients.</p>

          <h4>Fonctionnalités principales</h4>
          <ul>
            <li>📱 <strong>Liste des conversations</strong> : Toutes les conversations WhatsApp organisées par statut</li>
            <li>💬 <strong>Envoi de messages</strong> : Envoi de messages texte directement depuis l'interface</li>
            <li>📋 <strong>Templates de messages</strong> : Réponses rapides pré-configurées avec variables dynamiques</li>
            <li>🏷️ <strong>Gestion des statuts</strong> : Changement de statut du dossier directement depuis la conversation</li>
            <li>🔍 <strong>Recherche et filtres</strong> : Filtres par statut (À traiter, En cours, Résolus, etc.)</li>
            <li>📊 <strong>Informations client</strong> : Panneau latéral avec détails du client, véhicule, et statut du dossier</li>
          </ul>

          <h4>Filtres disponibles</h4>
          <ul>
            <li><strong>Tous</strong> : Toutes les conversations</li>
            <li><strong>À traiter</strong> : Conversations nécessitant une action (Onhold, To_be_called, To_be_contacted)</li>
            <li><strong>En cours</strong> : Conversations en cours de traitement</li>
            <li><strong>En attente</strong> : Conversations en attente de réponse</li>
            <li><strong>Résolus</strong> : Conversations terminées</li>
            <li><strong>Relances automatiques</strong> : Relances envoyées sans réponse du client</li>
          </ul>
        </section>

        <section>
          <h3>📥 Import de données</h3>
          <p><strong>Fichier</strong> : <code>views/ImportData.tsx</code></p>
          <p>Système d'import intelligent avec mapping automatique assisté par IA.</p>

          <h4>Processus en 4 étapes</h4>
          <ol>
            <li><strong>Upload</strong> : Téléchargement du fichier Excel/CSV</li>
            <li><strong>Mapping</strong> : Association des colonnes du fichier aux champs de la base de données
              <ul>
                <li><strong>Auto-Match IA</strong> : Utilise Gemini AI pour suggérer les mappings</li>
                <li><strong>Mapping manuel</strong> : Possibilité de corriger les suggestions</li>
                <li><strong>Aperçu des données</strong> : Visualisation des premières lignes du fichier</li>
              </ul>
            </li>
            <li><strong>Validation</strong> : Vérification des données avant import
              <ul>
                <li>Détection des erreurs (champs requis manquants, formats invalides)</li>
                <li>Détection des avertissements (données à normaliser)</li>
              </ul>
            </li>
            <li><strong>Import</strong> : Enregistrement dans la base de données
              <ul>
                <li>Création automatique des clients</li>
                <li>Création automatique des reminders (si échéance &lt; 30 jours)</li>
                <li>Option d'envoi immédiat des relances pour les cas urgents</li>
              </ul>
            </li>
          </ol>
        </section>

        <section>
          <h3>👥 Gestion des clients</h3>
          <p><strong>Fichiers</strong> : <code>views/Clients.tsx</code>, <code>views/ClientDetails.tsx</code></p>
          <ul>
            <li>Liste des clients avec recherche et filtrage</li>
            <li>Fiche client détaillée avec historique des conversations, notes internes, et actions rapides</li>
          </ul>
        </section>

        <section>
          <h3>🏢 Gestion des centres techniques</h3>
          <p><strong>Fichier</strong> : <code>views/Centers.tsx</code></p>
          <p>Gestion des centres de contrôle technique avec configuration par centre (nom, téléphone, URL réservation, template WhatsApp).</p>
        </section>
      </div>
    </div>
  );
}

function WorkflowsContent() {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h2>Workflows détaillés</h2>

      <section>
        <h3>Workflow de relance automatique</h3>
        <p>Le système de relances automatiques suit un workflow précis basé sur les jours avant l'échéance.</p>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 my-6 font-mono text-sm overflow-x-auto">
          <pre className="whitespace-pre-wrap">
{`┌─────────────────────────────────────────────────────────────────┐
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
             └─→ Closed`}
          </pre>
        </div>

        <h4>Exécution automatique</h4>
        <p><strong>Fichier</strong> : <code>api/cron/send-reminders.ts</code></p>
        <p>Le workflow est exécuté automatiquement chaque jour à <strong>10h30</strong> (heure de Paris) via un cron job Vercel.</p>

        <h4>Étapes du workflow</h4>
        <ol>
          <li><strong>J-30</strong> : Statut source <code>New</code> → Envoi WhatsApp → Nouveau statut <code>Reminder1_sent</code></li>
          <li><strong>J-15</strong> : Statut source <code>Reminder1_sent</code> ou <code>Pending</code> → Envoi WhatsApp → Nouveau statut <code>Reminder2_sent</code></li>
          <li><strong>J-7</strong> : Statut source <code>Reminder2_sent</code> ou <code>Pending</code> → Envoi WhatsApp → Nouveau statut <code>Reminder3_sent</code></li>
          <li><strong>J-3</strong> : Statut source <code>Reminder3_sent</code> ou <code>Pending</code> → Marquage pour appel → Nouveau statut <code>To_be_called</code></li>
        </ol>
      </section>

      <section>
        <h3>Workflow d'import de données</h3>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 my-6 font-mono text-sm overflow-x-auto">
          <pre className="whitespace-pre-wrap">
{`[Étape 1 : Upload]
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
     ├─→ [Mapping manuel] ──→ Correction des mappings
     └─→ [Aperçu données] ──→ Visualisation des premières lignes
     │
     ▼
[Étape 3 : Validation]
     │
     ├─→ Vérification champs requis
     ├─→ Validation formats
     └─→ Rapport d'erreurs/avertissements
     │
     ▼
[Étape 4 : Import]
     │
     ├─→ Insertion clients dans DB
     ├─→ Création reminders (si échéance < 30j)
     └─→ [Option] Envoi relances immédiat`}
          </pre>
        </div>
        <p><strong>Fichiers clés</strong> :</p>
        <ul>
          <li><code>views/ImportData.tsx</code> : Interface utilisateur</li>
          <li><code>hooks/useImportProcess.ts</code> : Logique métier</li>
          <li><code>services/geminiService.ts</code> : Service IA pour le mapping</li>
          <li><code>utils/excelParser.ts</code> : Parser Excel/CSV</li>
        </ul>
      </section>

      <section>
        <h3>Workflow de communication WhatsApp</h3>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 my-6 font-mono text-sm overflow-x-auto">
          <pre className="whitespace-pre-wrap">
{`[Message entrant (Webhook)]
     │
     ▼
┌──────────────────┐
│  Webhook Handler │  ← api/webhook.ts
└────────┬─────────┘
         │
         ├─→ Création/Mise à jour conversation
         ├─→ Création message inbound
         └─→ Notification temps réel (Supabase Realtime)
         │
         ▼
[Interface Inbox]
     │
     ├─→ Affichage conversation
     └─→ [Agent répond]
         │
         ▼
┌──────────────────┐
│  sendTextMessage │  ← services/whatsapp.ts
└────────┬─────────┘
         │
         ├─→ Envoi via Meta Cloud API
         └─→ Mise à jour conversation`}
          </pre>
        </div>
      </section>
    </div>
  );
}

function ArchitectureContent() {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h2>Architecture technique</h2>

      <section>
        <h3>Stack technologique</h3>
        
        <h4>Frontend</h4>
        <ul>
          <li><strong>React 19</strong> : Framework UI</li>
          <li><strong>TypeScript</strong> : Typage statique</li>
          <li><strong>Vite</strong> : Build tool et dev server</li>
          <li><strong>React Router</strong> : Navigation</li>
          <li><strong>Tailwind CSS</strong> : Styling (via classes utilitaires)</li>
        </ul>

        <h4>Backend / Services</h4>
        <ul>
          <li><strong>Supabase</strong> : 
            <ul>
              <li>Base de données PostgreSQL</li>
              <li>Authentification</li>
              <li>Realtime (notifications temps réel)</li>
            </ul>
          </li>
          <li><strong>Vercel</strong> : 
            <ul>
              <li>Hosting frontend</li>
              <li>Serverless functions (API routes)</li>
              <li>Cron jobs</li>
            </ul>
          </li>
        </ul>

        <h4>Services externes</h4>
        <ul>
          <li><strong>Meta WhatsApp Business API</strong> : Envoi de messages WhatsApp</li>
          <li><strong>Google Gemini AI</strong> : Mapping intelligent des colonnes lors de l'import</li>
        </ul>
      </section>

      <section>
        <h3>Structure des dossiers</h3>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 my-6 font-mono text-sm overflow-x-auto">
          <pre className="whitespace-pre-wrap">
{`Nexus/
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
│   └── ...
├── App.tsx             # Composant racine
├── types.ts            # Types TypeScript
└── package.json        # Dépendances`}
          </pre>
        </div>
      </section>

      <section>
        <h3>Base de données (Supabase)</h3>
        
        <h4>Tables principales</h4>
        <ul>
          <li><strong>clients</strong> : Informations des clients (nom, email, téléphone, véhicule, etc.)</li>
          <li><strong>reminders</strong> : Dossiers de relance pour chaque client avec statut du workflow</li>
          <li><strong>conversations</strong> : Conversations WhatsApp avec les clients</li>
          <li><strong>messages</strong> : Messages WhatsApp individuels</li>
          <li><strong>tech_centers</strong> : Centres de contrôle technique</li>
          <li><strong>user_profiles</strong> : Profils utilisateurs (agents, admins)</li>
          <li><strong>notifications</strong> : Notifications système</li>
          <li><strong>client_notes</strong> : Notes internes sur les clients</li>
          <li><strong>reminder_logs</strong> : Historique des actions de relance</li>
          <li><strong>message_templates</strong> : Templates de messages pré-configurés</li>
        </ul>

        <h4>Relations</h4>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 my-6 font-mono text-sm">
          <pre>
{`clients (1) ──→ (N) reminders
clients (1) ──→ (N) conversations
conversations (1) ──→ (N) messages
clients (N) ──→ (1) tech_centers
clients (1) ──→ (N) client_notes
reminders (1) ──→ (N) reminder_logs`}
          </pre>
        </div>
      </section>

      <section>
        <h3>Authentification et permissions</h3>
        <p><strong>Fichier</strong> : <code>contexts/AuthContext.tsx</code></p>
        
        <h4>Rôles</h4>
        <ul>
          <li><strong>superadmin</strong> : Accès complet (settings, tous les centres)</li>
          <li><strong>admin</strong> : Gestion des imports, centres, conversations</li>
          <li><strong>agent</strong> : Accès limité (conversations, clients, dashboard)</li>
        </ul>
      </section>

      <section>
        <h3>Intégration WhatsApp</h3>
        <p><strong>Fichier</strong> : <code>services/whatsapp.ts</code></p>
        <ul>
          <li><strong>API</strong> : Meta Cloud API (Graph API v17.0)</li>
          <li><strong>Templates</strong> : Templates WhatsApp Business approuvés</li>
          <li><strong>Webhook</strong> : <code>api/webhook.ts</code> pour réception des messages</li>
        </ul>
      </section>

      <section>
        <h3>Intégration IA (Gemini)</h3>
        <p><strong>Fichier</strong> : <code>services/geminiService.ts</code></p>
        <ul>
          <li>Mapping intelligent des colonnes lors de l'import</li>
          <li>Modèle : <code>gemini-3-flash-preview</code></li>
          <li>Suggestions de confiance (High, Low, None)</li>
        </ul>
      </section>
    </div>
  );
}

function GuideContent() {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h2>Guide de navigation du code</h2>

      <section>
        <h3>Où trouver le code pour...</h3>

        <div className="space-y-6">
          <div>
            <h4>... modifier le Dashboard</h4>
            <ul>
              <li><strong>Fichier principal</strong> : <code>views/Dashboard.tsx</code></li>
              <li><strong>Logique métier</strong> : <code>hooks/useDashboardData.ts</code></li>
              <li><strong>Types</strong> : <code>types.ts</code> (DashboardKPIs, UrgentActionItem, etc.)</li>
            </ul>
          </div>

          <div>
            <h4>... modifier la messagerie WhatsApp</h4>
            <ul>
              <li><strong>Interface</strong> : <code>views/Inbox.tsx</code></li>
              <li><strong>Envoi de messages</strong> : <code>services/whatsapp.ts</code> (fonction <code>sendTextMessage</code>)</li>
              <li><strong>Réception de messages</strong> : <code>api/webhook.ts</code></li>
              <li><strong>Templates</strong> : Table <code>message_templates</code> dans Supabase</li>
            </ul>
          </div>

          <div>
            <h4>... modifier le workflow de relances</h4>
            <ul>
              <li><strong>Cron job</strong> : <code>api/cron/send-reminders.ts</code></li>
              <li><strong>Action manuelle</strong> : <code>actions/sendReminder.ts</code></li>
              <li><strong>Templates WhatsApp</strong> : <code>services/whatsapp.ts</code> (fonction <code>sendRappelVisiteTechnique</code>)</li>
            </ul>
          </div>

          <div>
            <h4>... modifier l'import de données</h4>
            <ul>
              <li><strong>Interface</strong> : <code>views/ImportData.tsx</code></li>
              <li><strong>Logique</strong> : <code>hooks/useImportProcess.ts</code></li>
              <li><strong>Parser Excel</strong> : <code>utils/excelParser.ts</code></li>
              <li><strong>Normalisation</strong> : <code>utils/dataNormalizer.ts</code></li>
              <li><strong>IA Mapping</strong> : <code>services/geminiService.ts</code></li>
            </ul>
          </div>

          <div>
            <h4>... modifier l'authentification</h4>
            <ul>
              <li><strong>Context</strong> : <code>contexts/AuthContext.tsx</code></li>
              <li><strong>Protection routes</strong> : <code>App.tsx</code> (composant <code>ProtectedRoute</code>)</li>
              <li><strong>Table</strong> : <code>user_profiles</code> dans Supabase</li>
            </ul>
          </div>

          <div>
            <h4>... modifier les statuts de workflow</h4>
            <ul>
              <li><strong>Types</strong> : <code>types.ts</code> (type <code>ReminderStatus</code>)</li>
              <li><strong>Transitions</strong> : <code>views/Inbox.tsx</code> (objet <code>STATUS_ACTIONS</code>)</li>
              <li><strong>Workflow automatique</strong> : <code>api/cron/send-reminders.ts</code> (objet <code>WORKFLOW_STEPS</code>)</li>
            </ul>
          </div>

          <div>
            <h4>... ajouter un nouveau champ client</h4>
            <ol>
              <li><strong>Base de données</strong> : Ajouter la colonne dans la table <code>clients</code> (Supabase)</li>
              <li><strong>Types</strong> : Ajouter le champ dans <code>types.ts</code> (interface <code>Client</code>)</li>
              <li><strong>Import</strong> : Ajouter dans <code>hooks/useImportProcess.ts</code> (DB_FIELDS)</li>
              <li><strong>Affichage</strong> : Modifier <code>views/ClientDetails.tsx</code> et <code>views/Clients.tsx</code></li>
            </ol>
          </div>

          <div>
            <h4>... modifier les templates WhatsApp</h4>
            <ul>
              <li><strong>Templates par centre</strong> : Table <code>tech_centers.template_name</code></li>
              <li><strong>Envoi template</strong> : <code>services/whatsapp.ts</code> (fonction <code>sendRappelVisiteTechnique</code>)</li>
              <li><strong>Variables template</strong> : Voir commentaire dans <code>services/whatsapp.ts</code> (lignes 54-68)</li>
            </ul>
          </div>

          <div>
            <h4>... modifier les KPIs du Dashboard</h4>
            <ul>
              <li><strong>Calcul</strong> : <code>hooks/useDashboardData.ts</code> (fonction <code>kpis</code> useMemo)</li>
              <li><strong>Affichage</strong> : <code>views/Dashboard.tsx</code> (composant <code>KPICard</code>)</li>
            </ul>
          </div>

          <div>
            <h4>... ajouter une nouvelle vue/page</h4>
            <ol>
              <li>Créer le fichier dans <code>views/NouvelleVue.tsx</code></li>
              <li>Ajouter la route dans <code>App.tsx</code> :
                <pre className="bg-slate-100 dark:bg-slate-800 p-2 rounded"><code>{`<Route path="/nouvelle-vue" element={<ProtectedRoute><NouvelleVue /></ProtectedRoute>} />`}</code></pre>
              </li>
              <li>Ajouter le lien dans la sidebar (<code>App.tsx</code>, composant <code>Sidebar</code>)</li>
            </ol>
          </div>
        </div>
      </section>

      <section>
        <h3>Points d'entrée principaux</h3>
        <ul>
          <li><strong>Application React</strong> : <code>index.tsx</code> → <code>App.tsx</code></li>
          <li><strong>Routing</strong> : <code>App.tsx</code> (HashRouter)</li>
          <li><strong>Authentification</strong> : <code>App.tsx</code> (AuthProvider)</li>
          <li><strong>API Routes</strong> : <code>api/cron/send-reminders.ts</code>, <code>api/webhook.ts</code></li>
          <li><strong>Services</strong> : <code>services/supabaseClient.ts</code>, <code>services/whatsapp.ts</code>, <code>services/geminiService.ts</code></li>
        </ul>
      </section>

      <section>
        <h3>Configuration et variables d'environnement</h3>
        
        <h4>Variables nécessaires</h4>
        <p><strong>Frontend</strong> (<code>.env.local</code>) :</p>
        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded font-mono text-sm">
          <pre>
{`VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_WHATSAPP_API_TOKEN=xxx
VITE_WHATSAPP_PHONE_ID=xxx`}
          </pre>
        </div>

        <p><strong>Backend</strong> (Vercel Environment Variables) :</p>
        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded font-mono text-sm">
          <pre>
{`SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
VITE_WHATSAPP_API_TOKEN=xxx
VITE_WHATSAPP_PHONE_ID=xxx
API_KEY=xxx  # Pour Gemini AI`}
          </pre>
        </div>
      </section>

      <section>
        <h3>Scripts utiles</h3>
        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded font-mono text-sm">
          <pre>
{`npm run dev      # Démarrer le serveur de développement
npm run build    # Build de production
npm run preview  # Prévisualiser le build`}
          </pre>
        </div>
        <p><strong>Scripts de maintenance</strong> (dans <code>scripts/</code>) :</p>
        <ul>
          <li><code>setup-database.mjs</code> : Configuration initiale de la base</li>
          <li><code>create-superadmin.mjs</code> : Création d'un super-admin</li>
          <li><code>check-whatsapp-status.mjs</code> : Vérification du statut WhatsApp</li>
          <li><code>check-reminders-status.mjs</code> : Vérification des reminders</li>
        </ul>
      </section>

      <section>
        <h3>Débogage</h3>
        <h4>Console logs</h4>
        <p>Les logs sont préfixés avec des emojis pour faciliter le filtrage :</p>
        <ul>
          <li>📤 : Envoi de message</li>
          <li>📥 : Réception de message</li>
          <li>✅ : Succès</li>
          <li>❌ : Erreur</li>
          <li>⚠️ : Avertissement</li>
          <li>🔄 : Action en cours</li>
        </ul>
      </section>
    </div>
  );
}

function ConseilsContent() {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h2>Conseils pour les développeurs</h2>

      <section>
        <h3>Bonnes pratiques</h3>
        <ol>
          <li><strong>Types TypeScript</strong> : Toujours utiliser les types définis dans <code>types.ts</code></li>
          <li><strong>Gestion d'erreurs</strong> : Toujours gérer les erreurs avec try/catch et afficher des messages utilisateur</li>
          <li><strong>Performance</strong> : Utiliser <code>useMemo</code> et <code>useCallback</code> pour les calculs coûteux</li>
          <li><strong>Realtime</strong> : Nettoyer les abonnements Supabase dans les <code>useEffect</code> cleanup</li>
          <li><strong>Logs</strong> : Utiliser les préfixes emoji pour faciliter le débogage</li>
        </ol>
      </section>

      <section>
        <h3>Points d'attention</h3>
        <ul>
          <li>⚠️ <strong>Rate limits WhatsApp</strong> : Respecter les limites d'envoi (1 message/seconde max)</li>
          <li>⚠️ <strong>Cron job</strong> : Ne pas traiter les reminders créés dans les 10 dernières minutes (éviter les doublons lors de l'import)</li>
          <li>⚠️ <strong>Templates WhatsApp</strong> : Les templates doivent être approuvés par Meta avant utilisation</li>
          <li>⚠️ <strong>Variables d'environnement</strong> : Ne jamais commiter les tokens dans le code</li>
        </ul>
      </section>

      <section>
        <h3>Extensions possibles</h3>
        <ul>
          <li>📧 <strong>Notifications email</strong> : Ajouter l'envoi d'emails en complément de WhatsApp</li>
          <li>📊 <strong>Rapports</strong> : Génération de rapports PDF/Excel</li>
          <li>🔔 <strong>Alertes SMS</strong> : Intégration d'un service SMS</li>
          <li>📱 <strong>App mobile</strong> : Application React Native</li>
          <li>🤖 <strong>Chatbot</strong> : Bot automatique pour répondre aux questions fréquentes</li>
        </ul>
      </section>

      <section>
        <h3>Tests et validation</h3>
        
        <h4>Tester le workflow de relances</h4>
        <ol>
          <li>Créer un client avec <code>due_date</code> = aujourd'hui + 30 jours</li>
          <li>Vérifier que le statut est <code>New</code></li>
          <li>Attendre le cron job (ou déclencher manuellement)</li>
          <li>Vérifier que la relance J-30 est envoyée</li>
        </ol>

        <h4>Tester l'import</h4>
        <ol>
          <li>Préparer un fichier Excel avec des données de test</li>
          <li>Importer via <code>views/ImportData.tsx</code></li>
          <li>Vérifier le mapping automatique</li>
          <li>Valider et importer</li>
          <li>Vérifier dans Supabase que les données sont créées</li>
        </ol>

        <h4>Tester la messagerie</h4>
        <ol>
          <li>Envoyer un message WhatsApp au numéro configuré</li>
          <li>Vérifier que le webhook reçoit le message</li>
          <li>Vérifier que la conversation apparaît dans <code>views/Inbox.tsx</code></li>
          <li>Répondre depuis l'interface</li>
          <li>Vérifier que le message est envoyé</li>
        </ol>
      </section>
    </div>
  );
}

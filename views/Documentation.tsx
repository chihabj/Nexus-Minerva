import React, { useState } from 'react';

type TabId = 'demarrage' | 'dashboard' | 'messages' | 'todolist' | 'import' | 'workflow' | 'clients' | 'faq';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { id: 'demarrage', label: 'Prise en main', icon: 'rocket_launch' },
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'todolist', label: 'Todo List', icon: 'checklist' },
  { id: 'messages', label: 'Messages', icon: 'chat' },
  { id: 'import', label: 'Import', icon: 'cloud_upload' },
  { id: 'clients', label: 'Clients & Centres', icon: 'contacts' },
  { id: 'workflow', label: 'Workflow', icon: 'account_tree' },
  { id: 'faq', label: 'FAQ', icon: 'help' },
];

export default function Documentation() {
  const [activeTab, setActiveTab] = useState<TabId>('demarrage');

  return (
    <div className="h-full flex flex-col bg-background-light dark:bg-background-dark">
      {/* Header */}
      <div className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-3xl">menu_book</span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Documentation
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Guide d'utilisation de la plateforme Minerva CT - Nexus Connect CRM
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-8">
          <div className="flex gap-1 overflow-x-auto custom-scrollbar py-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all whitespace-nowrap text-sm
                  ${activeTab === tab.id
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300'
                  }
                `}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto px-8 py-8">
          {activeTab === 'demarrage' && <DemarrageContent />}
          {activeTab === 'dashboard' && <DashboardContent />}
          {activeTab === 'todolist' && <TodoListContent />}
          {activeTab === 'messages' && <MessagesContent />}
          {activeTab === 'import' && <ImportContent />}
          {activeTab === 'clients' && <ClientsContent />}
          {activeTab === 'workflow' && <WorkflowContent />}
          {activeTab === 'faq' && <FAQContent />}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── COMPOSANTS UTILITAIRES ─────────────────── */

function Card({ title, icon, children, accent = 'blue' }: { title: string; icon: string; children: React.ReactNode; accent?: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20',
    green: 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20',
    amber: 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20',
    purple: 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20',
    red: 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20',
    slate: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50',
  };
  const iconColors: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    amber: 'text-amber-600 dark:text-amber-400',
    purple: 'text-purple-600 dark:text-purple-400',
    red: 'text-red-600 dark:text-red-400',
    slate: 'text-slate-600 dark:text-slate-400',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[accent]}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`material-symbols-outlined text-xl ${iconColors[accent]}`}>{icon}</span>
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
      </div>
      <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2">{children}</div>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
        {number}
      </div>
      <div className="flex-1 pb-6">
        <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{title}</h4>
        <div className="text-sm text-slate-600 dark:text-slate-400">{children}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status, label, color }: { status: string; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>{status}</span>
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
    </div>
  );
}

/* ─────────────────── ONGLET 1 : PRISE EN MAIN ─────────────────── */

function DemarrageContent() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Bienvenue sur Minerva CT</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Minerva CT (Nexus Connect CRM) est votre plateforme de gestion des relances de contrôle technique.
          Elle vous permet de suivre vos clients, envoyer des rappels WhatsApp automatiquement et gérer les prises de rendez-vous.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Connexion" icon="login" accent="blue">
          <p>Connectez-vous avec l'adresse email et le mot de passe fournis par votre administrateur.</p>
        </Card>
        <Card title="Votre espace" icon="space_dashboard" accent="green">
          <p>Le menu de gauche vous donne accès à toutes les sections de la plateforme selon votre rôle.</p>
        </Card>
        <Card title="Notifications" icon="notifications" accent="amber">
          <p>La cloche en haut à droite vous alerte en temps réel des nouvelles réponses clients. Cliquez pour accéder directement à la conversation.</p>
        </Card>
      </div>

      <Card title="Rôles et permissions" icon="shield_person" accent="purple">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700">Agent</span>
            <p>Accès au Dashboard, Todo List, Messages, Clients. Gère les conversations et met à jour les statuts des dossiers.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-200 text-blue-700">Admin</span>
            <p>Tout ce que fait l'agent + Import de données, gestion des centres techniques.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-purple-200 text-purple-700">Super Admin</span>
            <p>Accès complet incluant les Paramètres (workflow, configuration WhatsApp, gestion des utilisateurs).</p>
          </div>
        </div>
      </Card>

      <Card title="Navigation rapide" icon="map" accent="slate">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-slate-500">dashboard</span>
            <span><strong>Dashboard</strong> - Vue d'ensemble et KPIs</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-slate-500">checklist</span>
            <span><strong>Todo List</strong> - Actions à traiter</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-slate-500">inbox</span>
            <span><strong>Messages</strong> - Conversations WhatsApp</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-slate-500">cloud_upload</span>
            <span><strong>Import</strong> - Importer des fichiers clients</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-slate-500">contacts</span>
            <span><strong>Clients</strong> - Liste et fiches clients</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-slate-500">storefront</span>
            <span><strong>Centres</strong> - Gestion des centres</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────── ONGLET 2 : DASHBOARD ─────────────────── */

function DashboardContent() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Dashboard</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Le Dashboard est votre cockpit opérationnel. Il affiche en un coup d'oeil les indicateurs clés et les actions prioritaires.
        </p>
      </div>

      <Card title="Indicateurs clés (KPIs)" icon="analytics" accent="blue">
        <p className="mb-3">Les cartes en haut du Dashboard vous donnent un aperçu instantané :</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <strong>En retard</strong> - Clients dont l'échéance du contrôle technique est dépassée
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            <strong>Échéance 7j</strong> - Contrôle technique à effectuer dans les 7 prochains jours
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <strong>Pipeline 30j</strong> - Tous les clients avec échéance dans le mois
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
            <strong>Actions requises</strong> - Cas nécessitant votre intervention (en attente, à appeler...)
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <strong>Confirmés</strong> - Rendez-vous confirmés aujourd'hui
          </div>
        </div>
      </Card>

      <Card title="Filtrer les données" icon="filter_list" accent="green">
        <div className="space-y-2">
          <p><strong>Par KPI :</strong> Cliquez sur une carte KPI pour filtrer les tables en dessous (ex: cliquer sur "En retard" affiche uniquement ces cas).</p>
          <p><strong>Par centre :</strong> Utilisez le filtre de centre en haut pour voir les données d'un centre technique spécifique.</p>
          <p><strong>Actualiser :</strong> Cliquez sur le bouton de rafraîchissement pour recharger les données.</p>
        </div>
      </Card>

      <Card title="Tables de données" icon="table_chart" accent="slate">
        <div className="space-y-3">
          <div>
            <p className="font-medium text-slate-900 dark:text-white">Actions urgentes</p>
            <p>Liste des cas nécessitant une action immédiate, triés par urgence. Vous pouvez accéder directement à la fiche client ou à la conversation.</p>
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">Pipeline 30 jours</p>
            <p>Vue d'ensemble de tous les clients avec une échéance dans le mois à venir. Permet d'anticiper la charge de travail.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────── ONGLET 3 : TODO LIST ─────────────────── */

function TodoListContent() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Todo List</h2>
        <p className="text-slate-600 dark:text-slate-400">
          La Todo List centralise toutes les actions que vous devez traiter. C'est votre file d'attente de travail quotidien.
        </p>
      </div>

      <Card title="Types de tâches" icon="task" accent="blue">
        <div className="space-y-3">
          <div>
            <StatusBadge status="En attente" label="Le client a répondu ou le dossier nécessite une action de votre part" color="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" />
          </div>
          <div>
            <StatusBadge status="À appeler" label="Le client doit être contacté par téléphone (passage automatique à J-3 de l'échéance)" color="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" />
          </div>
          <div>
            <StatusBadge status="Pending" label="En attente d'envoi de relance WhatsApp ou d'une réponse client" color="bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300" />
          </div>
          <div>
            <StatusBadge status="À contacter" label="Le client a demandé à être rappelé" color="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" />
          </div>
        </div>
      </Card>

      <Card title="Actions disponibles" icon="touch_app" accent="green">
        <div className="space-y-2">
          <p><strong>Ouvrir la conversation</strong> - Cliquez sur le bouton Messages pour accéder à l'historique WhatsApp du client.</p>
          <p><strong>Voir la fiche client</strong> - Accédez aux détails du client (véhicule, dates, notes...).</p>
          <p><strong>Envoyer une relance WhatsApp</strong> - Pour les tâches "Pending", envoyez directement la relance depuis la liste.</p>
          <p><strong>Envoi groupé</strong> - Le bouton "Envoyer WhatsApp" en haut permet d'envoyer toutes les relances en attente en un clic.</p>
        </div>
      </Card>

      <Card title="Comment résoudre une tâche" icon="done_all" accent="purple">
        <div className="space-y-2">
          <p>Pour changer le statut d'un dossier, allez dans la conversation du client (onglet Messages) et utilisez le sélecteur de statut. Les options sont :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>RDV confirmé</strong> - Le client a confirmé son rendez-vous</li>
            <li><strong>À contacter</strong> - Le client souhaite être rappelé plus tard</li>
            <li><strong>Clôturé</strong> - Le dossier est terminé (client n'a plus le véhicule, a pris RDV seul, etc.)</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────── ONGLET 4 : MESSAGES ─────────────────── */

function MessagesContent() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Messages (Inbox WhatsApp)</h2>
        <p className="text-slate-600 dark:text-slate-400">
          L'onglet Messages est votre interface de communication WhatsApp. Toutes les conversations avec les clients y sont centralisées.
        </p>
      </div>

      <Card title="Organisation des conversations" icon="forum" accent="blue">
        <p className="mb-3">Les conversations sont organisées par filtres :</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">inbox</span>
            <strong>Tous</strong> - Toutes les conversations
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-orange-500">priority_high</span>
            <strong>À traiter</strong> - Conversations nécessitant votre action (Onhold, À appeler, À contacter)
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-blue-500">pending</span>
            <strong>En attente</strong> - En attente de réponse du client
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-green-500">check_circle</span>
            <strong>Résolus</strong> - Dossiers terminés
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-slate-500">schedule_send</span>
            <strong>Relances auto</strong> - Relances envoyées sans réponse du client
          </div>
        </div>
      </Card>

      <Card title="Envoyer un message" icon="send" accent="green">
        <div className="space-y-2">
          <p><strong>Message libre :</strong> Tapez votre message dans la zone de texte en bas de la conversation et appuyez sur Entrée ou cliquez sur Envoyer.</p>
          <p><strong>Messages pré-enregistrés :</strong> Cliquez sur l'icône de template pour choisir parmi les réponses rapides configurées par l'administrateur.</p>
        </div>
      </Card>

      <Card title="Statut des messages" icon="mark_email_read" accent="amber">
        <p className="mb-3">Chaque message envoyé affiche son statut de livraison :</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-slate-400">check</span>
            <span><strong>Envoyé</strong> - Le message a quitté notre serveur</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-slate-500">done_all</span>
            <span><strong>Livré</strong> - Le message est arrivé sur le téléphone du client</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-blue-500">done_all</span>
            <span><strong>Lu</strong> - Le client a ouvert et lu le message</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-red-500">error</span>
            <span><strong>Échoué</strong> - Le message n'a pas pu être envoyé (numéro invalide, pas de WhatsApp...)</span>
          </div>
        </div>
      </Card>

      <Card title="Changer le statut d'un dossier" icon="swap_horiz" accent="purple">
        <p>
          En haut de la fenêtre de conversation, un badge affiche le statut actuel du dossier.
          Cliquez dessus pour le modifier. Les changements de statut sont enregistrés immédiatement et impactent
          le Dashboard et la Todo List.
        </p>
      </Card>

      <Card title="Panneau client" icon="person" accent="slate">
        <p>
          À droite de la conversation, un panneau affiche les informations du client : nom, téléphone, véhicule, centre de rattachement,
          dates de visite et statut du dossier. Vous pouvez accéder à la fiche complète du client depuis ce panneau.
        </p>
      </Card>
    </div>
  );
}

/* ─────────────────── ONGLET 5 : IMPORT ─────────────────── */

function ImportContent() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Import de données</h2>
        <p className="text-slate-600 dark:text-slate-400">
          L'import vous permet d'ajouter de nouveaux clients depuis un fichier Excel ou CSV. Le processus se fait en 4 étapes simples.
        </p>
      </div>

      <Card title="Formats acceptés" icon="description" accent="blue">
        <div className="space-y-2">
          <p>Formats supportés : <strong>.xlsx</strong> (Excel), <strong>.xls</strong> (Excel ancien), <strong>.csv</strong> (texte séparé par des virgules/points-virgules)</p>
          <p className="font-medium mt-2">Colonnes attendues :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Nom</strong> (obligatoire) - Nom du client</li>
            <li><strong>Prénom</strong> - Prénom du client</li>
            <li><strong>Téléphone</strong> (obligatoire) - Numéro de téléphone</li>
            <li><strong>Email</strong> - Adresse email</li>
            <li><strong>Date dernière visite</strong> (obligatoire) - Date du dernier contrôle technique</li>
            <li><strong>Immatriculation</strong> - Plaque d'immatriculation du véhicule</li>
            <li><strong>Marque</strong> - Marque du véhicule</li>
            <li><strong>Modèle</strong> - Modèle du véhicule</li>
            <li><strong>Centre</strong> - Nom du centre de contrôle technique</li>
          </ul>
        </div>
      </Card>

      <div className="space-y-1">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Processus d'import</h3>
        <Step number={1} title="Téléchargement du fichier">
          <p>Glissez-déposez votre fichier ou cliquez pour le sélectionner. Le système analyse automatiquement les colonnes.</p>
        </Step>
        <Step number={2} title="Mapping des colonnes">
          <p>
            L'IA suggère automatiquement l'association entre vos colonnes et les champs de la base de données.
            Vérifiez et corrigez les suggestions si nécessaire. Un aperçu des données vous permet de valider visuellement.
          </p>
        </Step>
        <Step number={3} title="Validation">
          <p>
            Le système vérifie les données : champs obligatoires manquants, formats incorrects, doublons...
            Les erreurs sont affichées en rouge, les avertissements en orange. Corrigez votre fichier si nécessaire.
          </p>
        </Step>
        <Step number={4} title="Import et relances">
          <p>Les clients sont créés dans la base de données avec le statut "New". Si des clients ont une échéance dans les 30 prochains jours :</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li><strong>Envoyer maintenant</strong> : envoie immédiatement les relances WhatsApp avec suivi de progression</li>
            <li><strong>Ne pas envoyer</strong> : les relances sont placées dans la Todo List pour traitement ultérieur</li>
          </ul>
        </Step>
      </div>

      <Card title="Bon à savoir" icon="lightbulb" accent="amber">
        <ul className="list-disc list-inside space-y-1">
          <li>La date de prochaine visite est calculée automatiquement : <strong>date dernière visite + 2 ans</strong></li>
          <li>Le centre est reconnu automatiquement grâce au nom dans le fichier</li>
          <li>Les numéros de téléphone sont normalisés automatiquement (format international)</li>
          <li>En cas d'import volumineux, les messages WhatsApp sont envoyés par lots pour respecter les limites de l'API</li>
        </ul>
      </Card>
    </div>
  );
}

/* ─────────────────── ONGLET 6 : CLIENTS & CENTRES ─────────────────── */

function ClientsContent() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Clients & Centres</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Gérez votre base de clients et vos centres de contrôle technique.
        </p>
      </div>

      <Card title="Liste des clients" icon="contacts" accent="blue">
        <div className="space-y-2">
          <p>La liste affiche tous les clients enregistrés avec leur nom, téléphone, centre, véhicule et statut du dossier.</p>
          <p><strong>Recherche :</strong> Utilisez la barre de recherche pour trouver un client par nom, téléphone ou immatriculation.</p>
          <p><strong>Filtres :</strong> Filtrez par centre technique pour voir uniquement les clients d'un centre spécifique.</p>
        </div>
      </Card>

      <Card title="Fiche client" icon="person" accent="green">
        <p className="mb-2">Cliquez sur un client pour accéder à sa fiche détaillée :</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Informations personnelles</strong> - Nom, prénom, téléphone, email</li>
          <li><strong>Véhicule</strong> - Immatriculation, marque, modèle</li>
          <li><strong>Dates</strong> - Dernière visite, prochaine visite, statut du dossier</li>
          <li><strong>Historique des conversations</strong> - Tous les échanges WhatsApp avec le client</li>
          <li><strong>Notes internes</strong> - Ajoutez des notes visibles uniquement par l'équipe</li>
          <li><strong>Actions rapides</strong> - Envoyer un message, appeler, changer le statut</li>
        </ul>
      </Card>

      <Card title="Centres techniques" icon="storefront" accent="purple">
        <p className="mb-2">Chaque centre a sa propre configuration :</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Nom et adresse</strong> du centre</li>
          <li><strong>Téléphone</strong> du centre (utilisé dans les boutons WhatsApp)</li>
          <li><strong>URL de réservation</strong> (lien vers la page de prise de RDV en ligne)</li>
          <li><strong>Template WhatsApp</strong> associé (un template par centre avec boutons CTA personnalisés)</li>
        </ul>
      </Card>

      <Card title="Création automatique de clients" icon="person_add" accent="amber">
        <p>
          Lorsqu'un numéro inconnu envoie un message WhatsApp, le système crée automatiquement un client et une tâche
          dans la Todo List pour que vous puissiez le traiter.
        </p>
      </Card>
    </div>
  );
}

/* ─────────────────── ONGLET 7 : WORKFLOW ─────────────────── */

function WorkflowContent() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Workflow de relance</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Le système de relance automatique suit un processus précis pour rappeler aux clients que leur contrôle technique arrive à échéance.
        </p>
      </div>

      <Card title="Relances automatiques" icon="schedule_send" accent="blue">
        <p className="mb-3">Les relances sont envoyées automatiquement chaque jour à <strong>10h30</strong> (heure de Paris), du lundi au vendredi :</p>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-blue-100/50 dark:bg-blue-900/20 rounded-lg">
            <span className="font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">J-30</span>
            <div>
              <p className="font-medium">1ère relance WhatsApp</p>
              <p className="text-xs text-slate-500">Envoyée 30 jours avant l'échéance. Statut passe de "New" à "Reminder1_sent"</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg">
            <span className="font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">J-15</span>
            <div>
              <p className="font-medium">2ème relance WhatsApp</p>
              <p className="text-xs text-slate-500">Envoyée 15 jours avant l'échéance si pas de réponse. Statut passe à "Reminder2_sent"</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-orange-100/50 dark:bg-orange-900/20 rounded-lg">
            <span className="font-bold text-orange-600 dark:text-orange-400 whitespace-nowrap">J-7</span>
            <div>
              <p className="font-medium">3ème relance WhatsApp</p>
              <p className="text-xs text-slate-500">Envoyée 7 jours avant l'échéance si toujours pas de réponse. Statut passe à "Reminder3_sent"</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-red-100/50 dark:bg-red-900/20 rounded-lg">
            <span className="font-bold text-red-600 dark:text-red-400 whitespace-nowrap">J-3</span>
            <div>
              <p className="font-medium">Passage en "À appeler"</p>
              <p className="text-xs text-slate-500">3 jours avant l'échéance, si le client n'a pas répondu, un appel téléphonique est requis</p>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Follow-up automatique" icon="reply" accent="green">
        <p className="mb-2">
          En complément de la relance initiale, un message de suivi est envoyé automatiquement si :
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>La première relance a été <strong>lue</strong> par le client (statut "Read")</li>
          <li>Au moins <strong>2 heures</strong> se sont écoulées depuis l'envoi</li>
          <li>Le client n'a pas répondu</li>
          <li>Il est entre <strong>9h et 17h</strong> (lundi au vendredi)</li>
        </ul>
        <p className="mt-2">
          Ce message propose au client de l'assister par téléphone avec deux boutons : <strong>"Oui, appelez-moi"</strong> et <strong>"Non merci"</strong>.
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Les messages lus pendant le weekend sont automatiquement traités le lundi matin.
        </p>
      </Card>

      <Card title="Statuts des dossiers" icon="label" accent="purple">
        <div className="space-y-2">
          <StatusBadge status="New" label="Nouveau client importé, en attente de la première relance" color="bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200" />
          <StatusBadge status="Reminder1_sent" label="1ère relance envoyée" color="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" />
          <StatusBadge status="Reminder2_sent" label="2ème relance envoyée" color="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" />
          <StatusBadge status="Reminder3_sent" label="3ème relance envoyée" color="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" />
          <StatusBadge status="Onhold" label="Le client a répondu, action requise de votre part" color="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" />
          <StatusBadge status="Pending" label="En attente (agent attend une réponse du client)" color="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300" />
          <StatusBadge status="To_be_called" label="Le client doit être appelé par téléphone" color="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" />
          <StatusBadge status="To_be_contacted" label="Le client a demandé à être rappelé" color="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" />
          <StatusBadge status="Appointment_confirmed" label="Le rendez-vous est confirmé" color="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" />
          <StatusBadge status="Closed" label="Dossier clôturé" color="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300" />
        </div>
      </Card>

      <Card title="Quand un client répond" icon="question_answer" accent="amber">
        <p className="mb-2">
          Dès qu'un client répond à un message WhatsApp, son dossier passe automatiquement en <strong>"Onhold"</strong> (en attente d'action agent).
          L'agent doit ensuite déterminer la suite :
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>RDV confirmé</strong> : Le client confirme son rendez-vous</li>
          <li><strong>À contacter</strong> : Le client demande à être rappelé</li>
          <li><strong>Clôturé</strong> : Le client ne souhaite pas prendre de RDV (véhicule vendu, RDV pris seul, etc.)</li>
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Les relances automatiques sont suspendues dès que le statut passe en "Onhold".
        </p>
      </Card>
    </div>
  );
}

/* ─────────────────── ONGLET 8 : FAQ ─────────────────── */

function FAQContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Questions fréquentes</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Retrouvez ici les réponses aux questions les plus courantes.
        </p>
      </div>

      <FAQItem
        question="Un client dit ne pas avoir reçu le message WhatsApp. Que faire ?"
        answer="Vérifiez d'abord le statut du message dans la conversation (Envoyé / Livré / Lu / Échoué). Si le message a échoué, le numéro n'a peut-être pas WhatsApp. Le dossier passe alors automatiquement en 'À appeler' pour un contact téléphonique."
      />

      <FAQItem
        question="Comment renvoyer un message de relance ?"
        answer="Allez dans la Todo List, trouvez le dossier en 'Pending' et cliquez sur 'Envoyer WhatsApp'. Vous pouvez aussi envoyer un message libre directement depuis la conversation dans l'onglet Messages."
      />

      <FAQItem
        question="À quelle heure sont envoyées les relances automatiques ?"
        answer="Les relances principales sont envoyées tous les jours à 10h30 (heure de Paris). Les messages de suivi (follow-up) sont envoyés entre 9h et 17h du lundi au vendredi, toutes les heures."
      />

      <FAQItem
        question="Que se passe-t-il le weekend ?"
        answer="Aucune relance n'est envoyée le weekend. Les messages lus par les clients pendant le weekend seront traités automatiquement le lundi matin."
      />

      <FAQItem
        question="Comment est calculée la date de prochaine visite ?"
        answer="La date de prochaine visite technique est calculée en ajoutant 2 ans à la date de la dernière visite."
      />

      <FAQItem
        question="Un numéro inconnu a envoyé un message. Que faire ?"
        answer="Le système crée automatiquement un client et une tâche dans la Todo List. Consultez la conversation pour comprendre la demande et mettez à jour les informations du client si nécessaire."
      />

      <FAQItem
        question="Comment ajouter un nouveau centre technique ?"
        answer="Allez dans l'onglet Centres (accès Admin/SuperAdmin), cliquez sur 'Ajouter un centre' et remplissez les informations. N'oubliez pas de créer le template WhatsApp correspondant sur Meta Business et de le renseigner dans la fiche du centre."
      />

      <FAQItem
        question="Le client a cliqué sur 'Oui, appelez-moi' dans le follow-up. Que se passe-t-il ?"
        answer="Le dossier passe automatiquement en statut 'À appeler' et une notification urgente est créée. L'agent doit contacter le client par téléphone dans les meilleurs délais."
      />

      <FAQItem
        question="Comment modifier les paramètres du workflow ?"
        answer="Seul le Super Administrateur peut accéder aux Paramètres. L'onglet 'Workflow' permet de configurer les délais de relance (J-30, J-15, J-7, J-3) et les templates utilisés."
      />

      <FAQItem
        question="Je ne vois pas certains menus. Pourquoi ?"
        answer="Les menus affichés dépendent de votre rôle. Les agents ont un accès limité. Contactez votre administrateur si vous pensez avoir besoin d'accès supplémentaires."
      />
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <span className="font-medium text-sm text-slate-900 dark:text-white pr-4">{question}</span>
        <span className={`material-symbols-outlined text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
          {answer}
        </div>
      )}
    </div>
  );
}

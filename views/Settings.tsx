import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import type { UserProfile, ReminderStep, UserRole, MessageTemplate, MessageTemplateCategory } from '../types';

// Category configuration for message templates
const TEMPLATE_CATEGORIES: Record<MessageTemplateCategory, { label: string; color: string; bgColor: string }> = {
  greeting: { label: 'Salutation', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  confirmation: { label: 'Confirmation', color: 'text-green-700', bgColor: 'bg-green-100' },
  reminder: { label: 'Rappel', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  closing: { label: 'Clôture', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  general: { label: 'Général', color: 'text-slate-700', bgColor: 'bg-slate-100' },
};

export default function Settings() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'workflow' | 'messages' | 'general'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [steps, setSteps] = useState<ReminderStep[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New user form
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'agent' as UserRole });
  const [userError, setUserError] = useState('');

  // New/Edit template form
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    title: '',
    content: '',
    category: 'general' as MessageTemplateCategory,
    shortcut: '',
  });
  const [templateError, setTemplateError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch users
    const { data: usersData } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (usersData) setUsers(usersData);

    // Fetch workflow steps
    const { data: stepsData } = await supabase
      .from('reminder_steps')
      .select('*')
      .order('step_order', { ascending: true });
    
    if (stepsData) setSteps(stepsData);

    // Fetch message templates
    const { data: templatesData } = await supabase
      .from('message_templates')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (templatesData) setTemplates(templatesData);

    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setSaving(true);

    try {
      // Create user via Supabase Auth
      const { error } = await supabase.auth.admin.createUser({
        email: newUser.email,
        password: newUser.password,
        email_confirm: true,
        user_metadata: {
          full_name: newUser.full_name,
          role: newUser.role,
        },
      });

      if (error) {
        // Fallback: use signUp if admin API not available
        const { error: signUpError } = await supabase.auth.signUp({
          email: newUser.email,
          password: newUser.password,
          options: {
            data: {
              full_name: newUser.full_name,
              role: newUser.role,
            },
            emailRedirectTo: window.location.origin,
          },
        });

        if (signUpError) throw signUpError;
      }

      setShowNewUser(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'agent' });
      fetchData();
    } catch (err: any) {
      setUserError(err.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    await supabase
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', userId);
    
    fetchData();
  };

  const handleToggleUserActive = async (userId: string, isActive: boolean) => {
    await supabase
      .from('user_profiles')
      .update({ is_active: !isActive })
      .eq('id', userId);
    
    fetchData();
  };

  const handleUpdateStep = async (stepId: string, field: string, value: any) => {
    await supabase
      .from('reminder_steps')
      .update({ [field]: value })
      .eq('id', stepId);
    
    fetchData();
  };

  // Template CRUD operations
  const handleOpenTemplateForm = (template?: MessageTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        title: template.title,
        content: template.content,
        category: template.category,
        shortcut: template.shortcut || '',
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm({
        title: '',
        content: '',
        category: 'general',
        shortcut: '',
      });
    }
    setTemplateError('');
    setShowTemplateForm(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setTemplateError('');
    setSaving(true);

    try {
      const templateData = {
        title: templateForm.title.trim(),
        content: templateForm.content.trim(),
        category: templateForm.category,
        shortcut: templateForm.shortcut.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingTemplate) {
        // Update existing
        const { error } = await (supabase
          .from('message_templates') as any)
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await (supabase
          .from('message_templates') as any)
          .insert({
            ...templateData,
            sort_order: templates.length + 1,
            is_active: true,
          });

        if (error) throw error;
      }

      setShowTemplateForm(false);
      setEditingTemplate(null);
      fetchData();
    } catch (err: any) {
      setTemplateError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Supprimer ce message pré-enregistré ?')) return;

    await (supabase
      .from('message_templates') as any)
      .delete()
      .eq('id', templateId);
    
    fetchData();
  };

  const handleToggleTemplate = async (templateId: string, isActive: boolean) => {
    await (supabase
      .from('message_templates') as any)
      .update({ is_active: !isActive })
      .eq('id', templateId);
    
    fetchData();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'superadmin':
        return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">Super Admin</span>;
      case 'admin':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Admin</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">Agent</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-50 dark:bg-background-dark">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Paramètres</h1>
          <p className="text-slate-500 mt-1">Gérez les utilisateurs, le workflow et les configurations.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-surface-dark p-1.5 rounded-xl shadow-sm w-fit">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'users' 
                ? 'bg-primary text-white shadow-sm' 
                : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">group</span>
              Utilisateurs
            </span>
          </button>
          <button
            onClick={() => setActiveTab('workflow')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'workflow' 
                ? 'bg-primary text-white shadow-sm' 
                : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">account_tree</span>
              Workflow
            </span>
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'messages' 
                ? 'bg-primary text-white shadow-sm' 
                : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">quick_phrases</span>
              Messages
            </span>
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'general' 
                ? 'bg-primary text-white shadow-sm' 
                : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">tune</span>
              Général
            </span>
          </button>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Gestion des utilisateurs</h2>
                <p className="text-sm text-slate-500">{users.length} utilisateurs enregistrés</p>
              </div>
              <button
                onClick={() => setShowNewUser(true)}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Nouvel utilisateur
              </button>
            </div>

            {/* New User Form */}
            {showNewUser && (
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-semibold mb-4">Créer un nouvel utilisateur</h3>
                {userError && (
                  <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{userError}</div>
                )}
                <form onSubmit={handleCreateUser} className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nom complet</label>
                    <input
                      type="text"
                      value={newUser.full_name}
                      onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Mot de passe</label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Rôle</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </div>
                  <div className="col-span-2 flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                    >
                      {saving ? 'Création...' : 'Créer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewUser(false)}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Users List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((user) => (
                <div key={user.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="size-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold">
                    {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{user.full_name || user.email}</p>
                      {getRoleBadge(user.role)}
                      {!user.is_active && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-medium">Inactif</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={user.role}
                      onChange={(e) => handleUpdateUserRole(user.id, e.target.value as UserRole)}
                      className="px-2 py-1 border border-slate-300 rounded text-xs"
                      disabled={user.id === profile?.id}
                    >
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                    <button
                      onClick={() => handleToggleUserActive(user.id, user.is_active)}
                      disabled={user.id === profile?.id}
                      className={`p-1.5 rounded-lg transition-all ${
                        user.is_active 
                          ? 'text-green-600 hover:bg-green-50' 
                          : 'text-red-600 hover:bg-red-50'
                      } disabled:opacity-50`}
                      title={user.is_active ? 'Désactiver' : 'Activer'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {user.is_active ? 'toggle_on' : 'toggle_off'}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workflow Tab */}
        {activeTab === 'workflow' && (
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold">Workflow des rappels</h2>
              <p className="text-sm text-slate-500">Configurez les étapes automatiques de relance.</p>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div 
                    key={step.id} 
                    className={`p-4 rounded-xl border-2 ${
                      step.is_active 
                        ? 'border-primary/30 bg-primary/5' 
                        : 'border-slate-200 bg-slate-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`size-10 rounded-full flex items-center justify-center font-bold ${
                        step.action_type === 'call' 
                          ? 'bg-orange-100 text-orange-600' 
                          : 'bg-green-100 text-green-600'
                      }`}>
                        <span className="material-symbols-outlined">
                          {step.action_type === 'call' ? 'call' : 'chat'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">Étape {step.step_order}</span>
                          <span className="text-sm text-slate-500">• J-{step.days_before_due}</span>
                        </div>
                        <p className="text-sm text-slate-600">{step.description}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={step.action_type}
                          onChange={(e) => handleUpdateStep(step.id, 'action_type', e.target.value)}
                          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                        >
                          <option value="whatsapp">WhatsApp</option>
                          <option value="call">Appel</option>
                          <option value="email">Email</option>
                        </select>
                        <input
                          type="number"
                          value={step.days_before_due}
                          onChange={(e) => handleUpdateStep(step.id, 'days_before_due', parseInt(e.target.value))}
                          className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-center"
                          min={1}
                          max={60}
                        />
                        <span className="text-sm text-slate-500">jours avant</span>
                        <button
                          onClick={() => handleUpdateStep(step.id, 'is_active', !step.is_active)}
                          className={`p-1.5 rounded-lg transition-all ${
                            step.is_active 
                              ? 'text-green-600 hover:bg-green-50' 
                              : 'text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {step.is_active ? 'toggle_on' : 'toggle_off'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-blue-500">info</span>
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">Comment ça fonctionne</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Les rappels sont envoyés automatiquement selon ce calendrier. Si un client répond "RDV pris" ou similaire, 
                      le système arrête automatiquement les rappels pour ce client.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Messages pré-enregistrés</h2>
                <p className="text-sm text-slate-500">Réponses rapides pour les agents ({templates.length} messages)</p>
              </div>
              <button
                onClick={() => handleOpenTemplateForm()}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Nouveau message
              </button>
            </div>

            {/* Template Form */}
            {showTemplateForm && (
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-semibold mb-4">
                  {editingTemplate ? 'Modifier le message' : 'Nouveau message pré-enregistré'}
                </h3>
                {templateError && (
                  <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{templateError}</div>
                )}
                <form onSubmit={handleSaveTemplate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Titre</label>
                      <input
                        type="text"
                        value={templateForm.title}
                        onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                        placeholder="Ex: Confirmation RDV"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        required
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Catégorie</label>
                        <select
                          value={templateForm.category}
                          onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value as MessageTemplateCategory })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                          {Object.entries(TEMPLATE_CATEGORIES).map(([key, config]) => (
                            <option key={key} value={key}>{config.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Raccourci</label>
                        <input
                          type="text"
                          value={templateForm.shortcut}
                          onChange={(e) => setTemplateForm({ ...templateForm, shortcut: e.target.value })}
                          placeholder="/rdv"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Contenu du message</label>
                    <textarea
                      value={templateForm.content}
                      onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                      placeholder="Bonjour {{client_name}}, votre RDV est confirmé..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm h-24 resize-none"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Variables disponibles : <code className="bg-slate-100 px-1 rounded">{'{{client_name}}'}</code>, 
                      <code className="bg-slate-100 px-1 rounded ml-1">{'{{vehicle}}'}</code>, 
                      <code className="bg-slate-100 px-1 rounded ml-1">{'{{due_date}}'}</code>, 
                      <code className="bg-slate-100 px-1 rounded ml-1">{'{{center_name}}'}</code>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
                    >
                      {saving ? 'Enregistrement...' : editingTemplate ? 'Mettre à jour' : 'Créer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTemplateForm(false);
                        setEditingTemplate(null);
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Templates List */}
            {templates.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-4">quick_phrases</span>
                <p className="text-lg font-medium">Aucun message pré-enregistré</p>
                <p className="text-sm mt-2">Créez des réponses rapides pour vos agents.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {templates.map((template) => (
                  <div 
                    key={template.id} 
                    className={`p-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all ${
                      !template.is_active ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm">{template.title}</span>
                        {template.shortcut && (
                          <code className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">
                            {template.shortcut}
                          </code>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          TEMPLATE_CATEGORIES[template.category]?.bgColor || 'bg-slate-100'
                        } ${TEMPLATE_CATEGORIES[template.category]?.color || 'text-slate-700'}`}>
                          {TEMPLATE_CATEGORIES[template.category]?.label || template.category}
                        </span>
                        {!template.is_active && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-medium">
                            Inactif
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{template.content}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenTemplateForm(template)}
                        className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                        title="Modifier"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleToggleTemplate(template.id, template.is_active)}
                        className={`p-2 rounded-lg transition-all ${
                          template.is_active 
                            ? 'text-green-600 hover:bg-green-50' 
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                        title={template.is_active ? 'Désactiver' : 'Activer'}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {template.is_active ? 'toggle_on' : 'toggle_off'}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Supprimer"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Help box */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-blue-500">lightbulb</span>
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">Astuce</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Les agents peuvent utiliser les raccourcis (ex: /rdv) dans la zone de saisie pour insérer rapidement un message. 
                    Les variables comme {'{{client_name}}'} seront automatiquement remplacées.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold mb-6">Paramètres généraux</h2>
            
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <h3 className="font-semibold mb-2">Configuration WhatsApp</h3>
                <p className="text-sm text-slate-500 mb-4">Numéro connecté : +33 7 67 66 83 96</p>
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-amber-500"></span>
                  <span className="text-sm text-amber-600 font-medium">En attente d'approbation Meta</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <h3 className="font-semibold mb-2">Base de données</h3>
                <p className="text-sm text-slate-500">Supabase Cloud - aefzpamcvbzzcgwkuita</p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <h3 className="font-semibold mb-2">Version</h3>
                <p className="text-sm text-slate-500">Nexus Connect v1.0.0</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

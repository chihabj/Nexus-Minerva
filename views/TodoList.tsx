/**
 * Todo List - Agent Tasks Dashboard
 * 
 * Shows reminders that require agent action:
 * - Onhold: Client responded, needs agent decision
 * - To_be_called: J-3 reached, call required
 * - To_be_contacted: Client requested callback
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { sendRappelVisiteTechnique } from '../services/whatsapp';
import type { Reminder, Client, ReminderStatus } from '../types';

interface ReminderWithClient extends Reminder {
  client: Client;
}

// Status configuration for display
const STATUS_CONFIG: Record<string, { 
  label: string; 
  color: string; 
  bgColor: string;
  icon: string;
  description: string;
  actions: { label: string; status: ReminderStatus; color: string }[];
}> = {
  Pending: {
    label: 'En attente',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50 border-yellow-200',
    icon: '⏳',
    description: 'En attente de réponse du client.',
    actions: [
      { label: '✅ RDV Confirmé', status: 'Appointment_confirmed', color: 'bg-green-600 hover:bg-green-700' },
      { label: '⏸️ À traiter', status: 'Onhold', color: 'bg-orange-500 hover:bg-orange-600' },
      { label: '📞 À recontacter', status: 'To_be_contacted', color: 'bg-blue-600 hover:bg-blue-700' },
      { label: '❌ Fermé', status: 'Closed', color: 'bg-gray-600 hover:bg-gray-700' },
    ],
  },
  Onhold: {
    label: 'À traiter',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 border-orange-200',
    icon: '⏸️',
    description: 'Le client a répondu. Décidez de la suite à donner.',
    actions: [
      { label: '✅ RDV Confirmé', status: 'Appointment_confirmed', color: 'bg-green-600 hover:bg-green-700' },
      { label: '📞 À recontacter', status: 'To_be_contacted', color: 'bg-blue-600 hover:bg-blue-700' },
      { label: '⏳ En attente', status: 'Pending', color: 'bg-yellow-500 hover:bg-yellow-600' },
      { label: '❌ Fermé', status: 'Closed', color: 'bg-gray-600 hover:bg-gray-700' },
    ],
  },
  To_be_called: {
    label: 'À appeler',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
    icon: '📞',
    description: 'J-3 atteint sans réponse. Appel téléphonique requis.',
    actions: [
      { label: '✅ RDV Confirmé', status: 'Appointment_confirmed', color: 'bg-green-600 hover:bg-green-700' },
      { label: '📞 À recontacter', status: 'To_be_contacted', color: 'bg-blue-600 hover:bg-blue-700' },
      { label: '❌ Fermé', status: 'Closed', color: 'bg-gray-600 hover:bg-gray-700' },
    ],
  },
  To_be_contacted: {
    label: 'À recontacter',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: '🔔',
    description: 'Le client a demandé à être rappelé.',
    actions: [
      { label: '✅ RDV Confirmé', status: 'Appointment_confirmed', color: 'bg-green-600 hover:bg-green-700' },
      { label: '❌ Fermé', status: 'Closed', color: 'bg-gray-600 hover:bg-gray-700' },
    ],
  },
};

// Format date for display
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Calculate days until due date
function getDaysUntilDue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Batch sending configuration
const BATCH_CONFIG = {
  DELAY_BETWEEN_MESSAGES: 1500, // 1.5s between messages
  BATCH_SIZE: 25,
};

export default function TodoList() {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<ReminderWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [batchSending, setBatchSending] = useState<{
    active: boolean;
    current: number;
    total: number;
    success: number;
    failed: number;
  } | null>(null);

  // Fetch reminders that need action
  const fetchReminders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('reminders')
        .select('*, client:clients(*)')
        .in('status', ['Pending', 'Onhold', 'To_be_called', 'To_be_contacted'])
        .order('due_date', { ascending: true });

      if (fetchError) throw fetchError;

      // Type assertion to handle the joined data
      const typedData = (data || []).map(item => ({
        ...item,
        client: item.client as Client,
      })) as ReminderWithClient[];

      setReminders(typedData);
    } catch (err) {
      console.error('Error fetching todo reminders:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // Format date for WhatsApp message
  const formatDateForMessage = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr || 'N/A';
    }
  };

  // Send WhatsApp reminder for a single client
  const sendWhatsAppReminder = async (reminder: ReminderWithClient) => {
    if (!reminder.client?.phone) {
      setToast({ type: 'error', message: 'Numéro de téléphone manquant' });
      return false;
    }

    setSendingId(reminder.id);

    try {
      // Get tech center info
      let techCenter: { name: string; phone: string | null; short_url: string | null; network: string | null; template_name: string | null } | null = null;
      
      if (reminder.client.center_name || reminder.client.center_id) {
        const centerQuery = reminder.client.center_id 
          ? supabase.from('tech_centers').select('name, phone, short_url, network, template_name').eq('id', reminder.client.center_id).single()
          : supabase.from('tech_centers').select('name, phone, short_url, network, template_name').eq('name', reminder.client.center_name!).single();
        
        const { data: centerData } = await centerQuery;
        if (centerData) techCenter = centerData;
      }

      const nomCentre = techCenter?.name || reminder.client.center_name || 'Notre centre';
      const typeCentre = techCenter?.network || 'AUTOSUR';
      const centreComplet = typeCentre ? `${nomCentre} - ${typeCentre}` : nomCentre;
      const dateProchVis = formatDateForMessage(reminder.due_date);

      console.log(`📤 Envoi WhatsApp à ${reminder.client.phone}...`);
      
      const result = await sendRappelVisiteTechnique({
        to: reminder.client.phone,
        templateName: techCenter?.template_name || undefined,
        nomCentre: centreComplet,
        dateProchVis,
        shortUrlRendezVous: techCenter?.short_url || '',
        numeroAppelCentre: techCenter?.phone || '',
      });

      if (result.success) {
        // Update reminder status
        await supabase
          .from('reminders')
          .update({
            status: 'Reminder1_sent',
            sent_at: new Date().toISOString(),
            current_step: 1,
          })
          .eq('id', reminder.id);

        // Create or update conversation
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('client_id', reminder.client_id)
          .single();

        let conversationId: string;
        const sentAt = new Date().toISOString();

        if (existingConv) {
          conversationId = existingConv.id;
          await supabase
            .from('conversations')
            .update({
              last_message: `[Relance envoyée] Template: ${techCenter?.template_name || 'rappel_visite_technique_vf'}`,
              last_message_at: sentAt,
              status: 'open',
            })
            .eq('id', conversationId);
        } else {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({
              client_id: reminder.client_id,
              client_phone: reminder.client.phone,
              client_name: reminder.client.name,
              last_message: `[Relance envoyée] Template: ${techCenter?.template_name || 'rappel_visite_technique_vf'}`,
              last_message_at: sentAt,
              unread_count: 0,
              status: 'open',
            })
            .select('id')
            .single();
          
          if (newConv) conversationId = newConv.id;
        }

        // Create message record
        if (conversationId!) {
          const messageContent = `Madame, Monsieur,\n\nNous avons eu le plaisir de contrôler votre véhicule dans notre centre ${centreComplet}.\n\nLa validité de ce contrôle technique arrivant bientôt à échéance, le prochain devra s'effectuer avant le : ${dateProchVis}.\n\nNous vous invitons à prendre rendez-vous en ligne ou par téléphone.`;
          
          await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              wa_message_id: result.messageId || null,
              from_phone: '33767668396',
              to_phone: reminder.client.phone,
              direction: 'outbound',
              message_type: 'template',
              content: messageContent,
              template_name: techCenter?.template_name || 'rappel_visite_technique_vf',
              status: 'sent',
            });
        }

        // Remove from TodoList
        setReminders(prev => prev.filter(r => r.id !== reminder.id));
        setToast({ type: 'success', message: `WhatsApp envoyé à ${reminder.client.name || reminder.client.phone}` });
        return true;
      } else {
        setToast({ type: 'error', message: `Échec: ${result.error}` });
        return false;
      }
    } catch (err) {
      console.error('Error sending WhatsApp:', err);
      setToast({ type: 'error', message: 'Erreur lors de l\'envoi' });
      return false;
    } finally {
      setSendingId(null);
    }
  };

  // Batch send WhatsApp to all Pending reminders
  const batchSendPendingReminders = async () => {
    const pendingReminders = reminders.filter(r => r.status === 'Pending' && r.client?.phone);
    
    if (pendingReminders.length === 0) {
      setToast({ type: 'error', message: 'Aucun reminder en attente avec numéro valide' });
      return;
    }

    setBatchSending({
      active: true,
      current: 0,
      total: pendingReminders.length,
      success: 0,
      failed: 0,
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingReminders.length; i++) {
      const reminder = pendingReminders[i];
      
      // Update progress
      setBatchSending(prev => prev ? { ...prev, current: i + 1 } : null);

      // Add delay between messages (except first)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, BATCH_CONFIG.DELAY_BETWEEN_MESSAGES));
      }

      const success = await sendWhatsAppReminder(reminder);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      setBatchSending(prev => prev ? { ...prev, success: successCount, failed: failCount } : null);
    }

    setBatchSending(null);
    setToast({ 
      type: successCount > 0 ? 'success' : 'error', 
      message: `Envoi terminé: ${successCount} réussis, ${failCount} échoués` 
    });
  };

  // Update reminder status
  const updateStatus = async (reminderId: string, newStatus: ReminderStatus, notes?: string) => {
    try {
      setUpdatingId(reminderId);

      const updateData: Record<string, any> = {
        status: newStatus,
      };

      if (notes) {
        updateData.agent_notes = notes;
      }

      const { error: updateError } = await supabase
        .from('reminders')
        .update(updateData)
        .eq('id', reminderId);

      if (updateError) throw updateError;

      // Remove from list (since it's no longer in the action-required statuses)
      if (!['Pending', 'Onhold', 'To_be_called', 'To_be_contacted'].includes(newStatus)) {
        setReminders(prev => prev.filter(r => r.id !== reminderId));
      } else {
        // Update the status in place
        setReminders(prev => prev.map(r => 
          r.id === reminderId ? { ...r, status: newStatus } : r
        ));
      }

      setToast({ type: 'success', message: `Statut mis à jour: ${newStatus.replace(/_/g, ' ')}` });
    } catch (err) {
      console.error('Error updating status:', err);
      setToast({ type: 'error', message: 'Erreur lors de la mise à jour' });
    } finally {
      setUpdatingId(null);
    }
  };

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Filter reminders by tab
  const filteredReminders = activeTab === 'all' 
    ? reminders 
    : reminders.filter(r => r.status === activeTab);

  // Count by status
  const counts = {
    all: reminders.length,
    Pending: reminders.filter(r => r.status === 'Pending').length,
    Onhold: reminders.filter(r => r.status === 'Onhold').length,
    To_be_called: reminders.filter(r => r.status === 'To_be_called').length,
    To_be_contacted: reminders.filter(r => r.status === 'To_be_contacted').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {toast.message}
        </div>
      )}

      {/* Header - Fixed */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Todo List</h1>
            <p className="text-gray-500 mt-1">Tâches nécessitant votre intervention</p>
          </div>
          <div className="flex items-center gap-3">
            {counts.Pending > 0 && (
              <button
                onClick={batchSendPendingReminders}
                disabled={batchSending?.active}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-lg text-white font-medium transition-colors"
              >
                {batchSending?.active ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                    {batchSending.current}/{batchSending.total}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Envoyer WhatsApp ({counts.Pending})
                  </>
                )}
              </button>
            )}
            <button
              onClick={fetchReminders}
              disabled={batchSending?.active}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 rounded-lg text-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualiser
            </button>
          </div>
        </div>

        {/* Batch Sending Progress */}
        {batchSending && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-blue-700">Envoi en cours...</span>
              <span className="text-sm text-blue-600">
                {batchSending.success} réussis, {batchSending.failed} échoués
              </span>
            </div>
            <div className="w-full h-2 bg-blue-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(batchSending.current / batchSending.total) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-blue-500 mt-1">
              {batchSending.current} / {batchSending.total} messages
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            onClick={() => setActiveTab('all')}
            className={`p-3 rounded-xl border-2 transition-all ${
              activeTab === 'all' 
                ? 'border-indigo-500 bg-indigo-50' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-gray-900">{counts.all}</div>
            <div className="text-xs text-gray-500">Total des tâches</div>
          </button>
          
          <button
            onClick={() => setActiveTab('Pending')}
            className={`p-3 rounded-xl border-2 transition-all ${
              activeTab === 'Pending' 
                ? 'border-yellow-500 bg-yellow-50' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-yellow-600">{counts.Pending}</div>
            <div className="text-xs text-gray-500">⏳ En attente</div>
          </button>
          
          <button
            onClick={() => setActiveTab('Onhold')}
            className={`p-3 rounded-xl border-2 transition-all ${
              activeTab === 'Onhold' 
                ? 'border-orange-500 bg-orange-50' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-orange-600">{counts.Onhold}</div>
            <div className="text-xs text-gray-500">⏸️ À traiter</div>
          </button>
          
          <button
            onClick={() => setActiveTab('To_be_called')}
            className={`p-3 rounded-xl border-2 transition-all ${
              activeTab === 'To_be_called' 
                ? 'border-red-500 bg-red-50' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-red-600">{counts.To_be_called}</div>
            <div className="text-xs text-gray-500">📞 À appeler</div>
          </button>
          
          <button
            onClick={() => setActiveTab('To_be_contacted')}
            className={`p-3 rounded-xl border-2 transition-all ${
              activeTab === 'To_be_contacted' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-blue-600">{counts.To_be_contacted}</div>
            <div className="text-xs text-gray-500">🔔 À recontacter</div>
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
            {error}
          </div>
        )}

        {/* Empty State */}
        {filteredReminders.length === 0 && !error && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-lg font-medium text-gray-900">Aucune tâche en attente</h3>
            <p className="text-gray-500 mt-1">
              {activeTab === 'all' 
                ? 'Toutes les tâches ont été traitées !' 
                : `Aucune tâche dans la catégorie "${STATUS_CONFIG[activeTab]?.label || activeTab}"`}
            </p>
          </div>
        )}

        {/* Tasks List */}
        <div className="space-y-4">
          {filteredReminders.map(reminder => {
          const config = STATUS_CONFIG[reminder.status];
          const daysUntil = getDaysUntilDue(reminder.due_date);
          const isUrgent = daysUntil <= 3;
          const isOverdue = daysUntil < 0;

          return (
            <div
              key={reminder.id}
              className={`bg-white rounded-xl border-2 ${config?.bgColor || 'border-gray-200'} overflow-hidden`}
            >
              {/* Card Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-2xl flex-shrink-0">{config?.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {reminder.client?.name || reminder.client?.phone || 'Client'}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${config?.color} ${config?.bgColor}`}>
                          {config?.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-1">{config?.description}</p>
                    </div>
                  </div>
                  
                  {/* Due Date Badge */}
                  <div className={`flex-shrink-0 text-right ${isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-gray-600'}`}>
                    <div className="text-xs font-medium">
                      {isOverdue ? 'EN RETARD' : isUrgent ? 'URGENT' : 'Échéance'}
                    </div>
                    <div className="text-lg font-bold">
                      {isOverdue ? `${Math.abs(daysUntil)}j de retard` : `J-${daysUntil}`}
                    </div>
                    <div className="text-xs text-gray-400">{formatDate(reminder.due_date)}</div>
                  </div>
                </div>
              </div>

              {/* WhatsApp Unavailable Warning */}
              {reminder.client?.whatsapp_available === false && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2">
                  <span className="text-red-500 flex-shrink-0">⚠️</span>
                  <span className="text-sm font-medium text-red-700">WhatsApp indisponible pour ce numéro - Appel requis</span>
                </div>
              )}

              {/* Client Info - More compact and responsive */}
              <div className="p-3 bg-gray-50 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div className="min-w-0">
                  <div className="text-gray-500 text-xs">Téléphone</div>
                  <div className="font-medium truncate">{reminder.client?.phone || '-'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-gray-500 text-xs">Matricule</div>
                  <div className="font-medium truncate font-mono">
                    {reminder.client?.immatriculation || '-'}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-gray-500 text-xs">Centre</div>
                  <div className="font-medium truncate">{reminder.client?.center_name || '-'}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-gray-500 text-xs">Dernière visite</div>
                  <div className="font-medium">{formatDate(reminder.client?.last_visit || null)}</div>
                </div>
              </div>

              {/* Response Info (if any) */}
              {reminder.response_received_at && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-100">
                  <div className="text-sm text-amber-700">
                    <span className="font-medium">Réponse reçue:</span>{' '}
                    {formatDate(reminder.response_received_at)}
                  </div>
                </div>
              )}

              {/* Actions - Responsive layout */}
              <div className="p-3 border-t border-gray-100">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {config?.actions.map(action => (
                    <button
                      key={action.status}
                      onClick={() => updateStatus(reminder.id, action.status)}
                      disabled={updatingId === reminder.id}
                      className={`px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors ${action.color} disabled:opacity-50`}
                    >
                      {updatingId === reminder.id ? '...' : action.label}
                    </button>
                  ))}
                </div>
                
                {/* Quick Actions - Aligned right */}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {/* Send WhatsApp button for Pending reminders */}
                  {reminder.status === 'Pending' && reminder.client?.phone && reminder.client?.whatsapp_available !== false && (
                    <button
                      onClick={() => sendWhatsAppReminder(reminder)}
                      disabled={sendingId === reminder.id || batchSending?.active}
                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:bg-green-400 transition-colors flex items-center gap-1"
                    >
                      {sendingId === reminder.id ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                          Envoi...
                        </>
                      ) : (
                        <>📤 Envoyer WhatsApp</>
                      )}
                    </button>
                  )}
                  {reminder.client?.whatsapp_available !== false && reminder.client?.phone ? (
                    <button
                      onClick={() => navigate(`/inbox?phone=${encodeURIComponent(reminder.client?.phone || '')}`)}
                      className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 transition-colors"
                    >
                      💬 Conversation
                    </button>
                  ) : null}
                  <a
                    href={`tel:${reminder.client?.phone}`}
                    className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200 transition-colors"
                  >
                    📞 Appeler
                  </a>
                  <Link
                    to={`/clients/${reminder.client_id}`}
                    className="px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-medium hover:bg-indigo-200 transition-colors"
                  >
                    Voir détails →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

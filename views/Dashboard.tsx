import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Reminder, Client } from '../types';

interface ReminderWithClient extends Reminder {
  clients: Client | null;
}

export default function Dashboard() {
  const [reminders, setReminders] = useState<ReminderWithClient[]>([]);
  const [stats, setStats] = useState({
    totalClients: 0,
    totalReminders: 0,
    readyReminders: 0,
    pendingReminders: 0,
    sentToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Fetch reminders and stats from Supabase
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch ALL reminders, sorted by due_date ASC
      const { data: reminderData, error: reminderError } = await supabase
        .from('reminders')
        .select(`
          *,
          clients (*)
        `)
        .order('due_date', { ascending: true });

      if (reminderError) throw reminderError;
      setReminders(reminderData || []);

      // Fetch stats
      const { count: totalClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });

      const { count: totalReminders } = await supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true });

      const { count: readyCount } = await supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Ready');

      const { count: pendingCount } = await supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending');

      const { count: sentCount } = await supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Sent')
        .gte('updated_at', today);

      setStats({
        totalClients: totalClients || 0,
        totalReminders: totalReminders || 0,
        readyReminders: readyCount || 0,
        pendingReminders: pendingCount || 0,
        sentToday: sentCount || 0,
      });
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Format date for display (French locale)
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Calculate next visit date (last_visit + 2 years)
  const getNextVisitDate = (lastVisit: string | null): string => {
    if (!lastVisit) return '-';
    try {
      const date = new Date(lastVisit);
      date.setFullYear(date.getFullYear() + 2);
      return formatDate(date.toISOString());
    } catch {
      return '-';
    }
  };

  // Check if overdue (more than 2 years since last visit)
  const isOverdue = (lastVisit: string | null): boolean => {
    if (!lastVisit) return false;
    const date = new Date(lastVisit);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    return date < twoYearsAgo;
  };

  // Send WhatsApp message and update status to SENT
  const handleSendWhatsApp = async (reminder: ReminderWithClient) => {
    const phone = reminder.clients?.phone;
    if (!phone) return;

    setSendingId(reminder.id);

    try {
      // Clean phone number for WhatsApp
      const cleanPhone = phone.replace(/\s/g, '').replace(/^00/, '+').replace('+', '');
      
      // Construct WhatsApp message
      const clientName = reminder.clients?.name || 'Client';
      const dueDate = formatDate(reminder.due_date);
      const message = encodeURIComponent(
        `Bonjour ${clientName},\n\nVotre contrôle technique est prévu pour le ${dueDate}.\n\nMerci de prendre rendez-vous dès que possible.\n\nCordialement`
      );
      
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
      
      // Open WhatsApp in new tab
      window.open(whatsappUrl, '_blank');

      // Update status to 'Sent' in database
      const { error: updateError } = await supabase
        .from('reminders')
        .update({ 
          status: 'Sent',
          updated_at: new Date().toISOString()
        })
        .eq('id', reminder.id);

      if (updateError) {
        console.error('Failed to update reminder status:', updateError);
      } else {
        // Update local state
        setReminders(prev => 
          prev.map(r => 
            r.id === reminder.id 
              ? { ...r, status: 'Sent' as const }
              : r
          )
        );
        // Update stats
        setStats(prev => ({
          ...prev,
          readyReminders: Math.max(0, prev.readyReminders - 1),
          sentToday: prev.sentToday + 1,
        }));
      }
    } catch (err) {
      console.error('Error sending WhatsApp:', err);
    } finally {
      setSendingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ready': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'Pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'Sent': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Failed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Tableau de Bord</h2>
          <p className="text-slate-500 dark:text-slate-400">Vue d'ensemble des relances et du parc clients.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">group</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Clients</p>
            <h3 className="text-3xl font-bold mt-1">{stats.totalClients}</h3>
          </div>
          
          <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="material-symbols-outlined text-green-500 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">notification_important</span>
              {stats.readyReminders > 0 && (
                <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full animate-pulse">
                  À traiter
                </span>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Relances Prêtes</p>
            <h3 className="text-3xl font-bold mt-1">{stats.readyReminders}</h3>
          </div>
          
          <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="material-symbols-outlined text-blue-500 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">send</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Envoyées Aujourd'hui</p>
            <h3 className="text-3xl font-bold mt-1">{stats.sentToday}</h3>
          </div>
          
          <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="material-symbols-outlined text-amber-500 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">schedule</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">En Attente</p>
            <h3 className="text-3xl font-bold mt-1">{stats.pendingReminders}</h3>
          </div>
        </div>

        {/* Reminders Table */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-lg">Toutes les Relances</h4>
              <p className="text-sm text-slate-500 mt-0.5">
                {stats.totalReminders} relance{stats.totalReminders > 1 ? 's' : ''} • Triées par date d'échéance
              </p>
            </div>
            <button 
              onClick={fetchData}
              className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-all"
              title="Rafraîchir"
            >
              <span className="material-symbols-outlined">refresh</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center p-12 text-red-500">
                <span className="material-symbols-outlined mr-2">error</span>
                {error}
              </div>
            ) : reminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-4">event_available</span>
                <p className="text-lg font-medium">Aucune relance urgente</p>
                <p className="text-sm mt-2">Vérifiez l'onglet <strong>Clients</strong> pour voir votre base de données</p>
                <a 
                  href="#/clients" 
                  className="mt-4 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  Voir les Clients →
                </a>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Client</th>
                    <th className="px-6 py-4">Véhicule</th>
                    <th className="px-6 py-4">Dernière Visite</th>
                    <th className="px-6 py-4">Prochaine Visite</th>
                    <th className="px-6 py-4">Statut</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reminders.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`size-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                            isOverdue(r.clients?.last_visit || null) 
                              ? 'bg-red-500' 
                              : 'bg-gradient-to-br from-primary to-primary-dark'
                          }`}>
                            {r.clients?.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{r.clients?.name || 'Sans nom'}</div>
                            <div className="text-xs text-slate-400 font-mono">
                              {r.clients?.phone || 'Pas de téléphone'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {r.clients?.vehicle || '-'} 
                        {r.clients?.vehicle_year ? (
                          <span className="text-xs text-slate-400 ml-1">({r.clients.vehicle_year})</span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {formatDate(r.clients?.last_visit || null)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${
                            isOverdue(r.clients?.last_visit || null) 
                              ? 'text-red-600' 
                              : 'text-slate-600 dark:text-slate-400'
                          }`}>
                            {getNextVisitDate(r.clients?.last_visit || null)}
                          </span>
                          {isOverdue(r.clients?.last_visit || null) && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
                              RETARD
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${getStatusColor(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {r.status !== 'Sent' && r.clients?.phone ? (
                          <button 
                            onClick={() => handleSendWhatsApp(r)}
                            disabled={sendingId === r.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-600 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            title="Envoyer via WhatsApp"
                          >
                            {sendingId === r.id ? (
                              <div className="size-4 border-2 border-green-600 border-t-transparent animate-spin rounded-full"></div>
                            ) : (
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            )}
                            WhatsApp
                          </button>
                        ) : r.status === 'Sent' ? (
                          <span className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            Envoyé
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Pas de tél.</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

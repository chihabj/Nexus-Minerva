import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import type { Client, Reminder, ClientNote, ReminderStatus, NoteType } from '../types';

interface TimelineItem {
  id: string;
  type: 'reminder' | 'note' | 'visit';
  date: string;
  title: string;
  description: string;
  status?: ReminderStatus;
  noteType?: NoteType;
}

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [client, setClient] = useState<Client | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Note form state
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('note');
  const [savingNote, setSavingNote] = useState(false);
  
  // Status update state
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Fetch all client data
  const fetchClientData = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);

      // Fetch client info
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      // Fetch reminders
      const { data: reminderData, error: reminderError } = await supabase
        .from('reminders')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });

      if (reminderError) throw reminderError;
      setReminders(reminderData || []);

      // Fetch notes
      const { data: noteData, error: noteError } = await supabase
        .from('client_notes')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });

      if (noteError) throw noteError;
      setNotes(noteData || []);
    } catch (err) {
      console.error('Error fetching client:', err);
      setError(err instanceof Error ? err.message : 'Failed to load client');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  // Format date for display
  const formatDate = (dateStr: string | null, includeTime = false): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (includeTime) {
        return date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Calculate next visit (last_visit + 2 years)
  const getNextVisitDate = (lastVisit: string | null): string => {
    if (!lastVisit) return '-';
    const date = new Date(lastVisit);
    date.setFullYear(date.getFullYear() + 2);
    return formatDate(date.toISOString());
  };

  // Add new note
  const handleAddNote = async () => {
    if (!id || !newNote.trim()) return;
    
    setSavingNote(true);
    try {
      const { data, error } = await supabase
        .from('client_notes')
        .insert({
          client_id: id,
          content: newNote.trim(),
          author: 'Agent',
          note_type: noteType,
        })
        .select()
        .single();

      if (error) throw error;
      
      setNotes(prev => [data, ...prev]);
      setNewNote('');
      setNoteType('note');
    } catch (err) {
      console.error('Error adding note:', err);
      alert('Erreur lors de l\'ajout de la note');
    } finally {
      setSavingNote(false);
    }
  };

  // Update reminder status
  const handleUpdateReminderStatus = async (reminderId: string, newStatus: ReminderStatus) => {
    setUpdatingStatus(reminderId);
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ status: newStatus })
        .eq('id', reminderId);

      if (error) throw error;
      
      setReminders(prev => 
        prev.map(r => r.id === reminderId ? { ...r, status: newStatus } : r)
      );

      // Add a system note for the status change
      await supabase
        .from('client_notes')
        .insert({
          client_id: id,
          content: `Statut relance changé en "${newStatus}"`,
          author: 'Système',
          note_type: 'system',
        });
      
      fetchClientData();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Erreur lors de la mise à jour du statut');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Open WhatsApp conversation in Messages
  const openWhatsApp = () => {
    if (!client?.phone) return;
    navigate(`/inbox?phone=${encodeURIComponent(client.phone)}`);
  };

  // Build timeline from reminders and notes
  const buildTimeline = (): TimelineItem[] => {
    const items: TimelineItem[] = [];

    // Add reminders to timeline
    reminders.forEach(r => {
      items.push({
        id: `reminder-${r.id}`,
        type: 'reminder',
        date: r.created_at,
        title: `Relance - ${r.status}`,
        description: `Échéance: ${formatDate(r.due_date)}`,
        status: r.status,
      });
    });

    // Add notes to timeline
    notes.forEach(n => {
      items.push({
        id: `note-${n.id}`,
        type: 'note',
        date: n.created_at,
        title: n.author,
        description: n.content,
        noteType: n.note_type,
      });
    });

    // Add last visit as timeline item
    if (client?.last_visit) {
      items.push({
        id: 'visit-last',
        type: 'visit',
        date: client.last_visit,
        title: 'Dernière visite technique',
        description: client.center_name || 'Centre non spécifié',
      });
    }

    // Sort by date (newest first)
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getStatusColor = (status: ReminderStatus) => {
    switch (status) {
      case 'Ready': return 'bg-green-100 text-green-700 border-green-200';
      case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Sent': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Resolved': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Failed': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getNoteTypeIcon = (type: NoteType) => {
    switch (type) {
      case 'call': return 'call';
      case 'appointment': return 'event';
      case 'system': return 'settings';
      default: return 'note';
    }
  };

  const getTimelineIcon = (item: TimelineItem) => {
    if (item.type === 'reminder') return 'notifications';
    if (item.type === 'visit') return 'directions_car';
    return getNoteTypeIcon(item.noteType || 'note');
  };

  const getTimelineColor = (item: TimelineItem) => {
    if (item.type === 'reminder') return 'bg-primary text-white';
    if (item.type === 'visit') return 'bg-green-500 text-white';
    if (item.noteType === 'system') return 'bg-slate-400 text-white';
    if (item.noteType === 'call') return 'bg-blue-500 text-white';
    if (item.noteType === 'appointment') return 'bg-purple-500 text-white';
    return 'bg-amber-500 text-white';
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="size-12 border-4 border-primary border-t-transparent animate-spin rounded-full mx-auto"></div>
          <p className="mt-4 text-slate-500">Chargement du client...</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-red-500">
          <span className="material-symbols-outlined text-5xl mb-4">error</span>
          <p className="font-medium">{error || 'Client non trouvé'}</p>
          <button
            onClick={() => navigate('/clients')}
            className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-colors"
          >
            ← Retour aux clients
          </button>
        </div>
      </div>
    );
  }

  const timeline = buildTimeline();
  const latestReminder = reminders[0];

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-background-light dark:bg-background-dark">
      {/* Header */}
      <div className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => navigate('/clients')}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-4 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Retour aux clients
          </button>
          
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-primary/20">
                {client.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {client.name || 'Sans nom'}
                </h1>
                <p className="text-slate-500 font-mono text-lg">{client.phone || '-'}</p>
                {client.email && (
                  <p className="text-slate-400 text-sm">{client.email}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {client.phone && client.whatsapp_available !== false && (
                <button
                  onClick={openWhatsApp}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </button>
              )}
              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">call</span>
                  Appeler
                </a>
              )}
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <span className="material-symbols-outlined">more_vert</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Info Cards */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Client Info Card */}
            <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person</span>
                Informations
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Centre</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                    {client.center_name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Région</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300">{client.region || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Créé le</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300">{formatDate(client.created_at)}</p>
                </div>
              </div>
            </div>

            {/* Vehicle Card */}
            <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">directions_car</span>
                Véhicule
              </h3>
              {client.vehicle ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Modèle</p>
                    <p className="font-medium text-slate-700 dark:text-slate-300">{client.vehicle}</p>
                  </div>
                  {client.vehicle_year && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Année</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300">{client.vehicle_year}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">Aucun véhicule enregistré</p>
              )}
            </div>

            {/* Visit Dates Card */}
            <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">event</span>
                Contrôle Technique
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Dernière visite</p>
                  <p className="font-medium text-slate-700 dark:text-slate-300">{formatDate(client.last_visit)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Prochaine échéance</p>
                  <p className="font-semibold text-primary">{getNextVisitDate(client.last_visit)}</p>
                </div>
              </div>
            </div>

            {/* Latest Reminder Status */}
            {latestReminder && (
              <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">notifications_active</span>
                  Statut Relance
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Statut actuel</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(latestReminder.status)}`}>
                      {latestReminder.status}
                    </span>
                  </div>
                  
                  <div className="border-t pt-4">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Changer le statut</p>
                    <div className="flex flex-wrap gap-2">
                      {(['Ready', 'Pending', 'Sent', 'Resolved', 'Failed'] as ReminderStatus[]).map(status => (
                        <button
                          key={status}
                          onClick={() => handleUpdateReminderStatus(latestReminder.id, status)}
                          disabled={updatingStatus === latestReminder.id || latestReminder.status === status}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            latestReminder.status === status
                              ? getStatusColor(status) + ' cursor-default'
                              : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                          } disabled:opacity-50`}
                        >
                          {updatingStatus === latestReminder.id ? '...' : status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Timeline & Notes */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Add Note Form */}
            <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">edit_note</span>
                Ajouter une Note
              </h3>
              <div className="space-y-4">
                <div className="flex gap-2">
                  {(['note', 'call', 'appointment'] as NoteType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setNoteType(type)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        noteType === type
                          ? 'bg-primary text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{getNoteTypeIcon(type)}</span>
                      {type === 'note' ? 'Note' : type === 'call' ? 'Appel' : 'RDV'}
                    </button>
                  ))}
                </div>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Ex: A répondu, veut passer semaine prochaine..."
                  className="w-full p-4 border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  rows={3}
                />
                <button
                  onClick={handleAddNote}
                  disabled={savingNote || !newNote.trim()}
                  className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingNote ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="size-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                      Enregistrement...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[20px]">add</span>
                      Ajouter la note
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">timeline</span>
                Historique
                <span className="text-sm font-normal text-slate-400 ml-auto">
                  {timeline.length} événement{timeline.length > 1 ? 's' : ''}
                </span>
              </h3>
              
              {timeline.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2">history</span>
                  <p>Aucun historique</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
                  
                  <div className="space-y-6">
                    {timeline.map((item, index) => (
                      <div key={item.id} className="relative flex gap-4">
                        {/* Icon */}
                        <div className={`relative z-10 size-10 rounded-full flex items-center justify-center ${getTimelineColor(item)} shadow-md`}>
                          <span className="material-symbols-outlined text-[18px]">{getTimelineIcon(item)}</span>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 -mt-1">
                          <div className="flex items-start justify-between mb-1">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{item.title}</span>
                            <span className="text-xs text-slate-400">{formatDate(item.date, true)}</span>
                          </div>
                          <p className="text-sm text-slate-500">{item.description}</p>
                          {item.status && (
                            <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

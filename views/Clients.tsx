import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { formatPhoneDisplay } from '../utils/dataNormalizer';
import type { Client } from '../types';

export default function Clients() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk delete state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });
  const canDelete = hasPermission(['superadmin', 'admin']);

  // Fetch clients from Supabase - OPTIMIZED
  useEffect(() => {
    async function fetchClients() {
      const startTime = performance.now();
      console.log('[Clients] Fetching...');
      
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('clients')
          .select('id, name, email, phone, vehicle, vehicle_year, immatriculation, last_visit, status, region, center_id, center_name, created_at, updated_at')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        console.log('[Clients] Loaded', data?.length, 'clients in', Math.round(performance.now() - startTime), 'ms');
        // Debug: log first client to check vehicle field
        if (data && data.length > 0) {
          console.log('[Clients] Sample client data:', {
            id: data[0].id,
            name: data[0].name,
            vehicle: data[0].vehicle,
            vehicle_year: data[0].vehicle_year,
            allFields: Object.keys(data[0])
          });
        }
        setClients(data || []);
      } catch (err) {
        console.error('[Clients] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load clients');
      } finally {
        setLoading(false);
      }
    }

    fetchClients();
  }, []);

  // Filter clients based on search query (local filtering for < 500 items)
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) {
      return clients;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return clients.filter(client => {
      // Search by name
      if (client.name?.toLowerCase().includes(query)) return true;
      
      // Search by phone (both formatted and raw)
      if (client.phone?.toLowerCase().includes(query)) return true;
      if (client.phone && formatPhoneDisplay(client.phone).includes(query)) return true;
      
      // Search by matricule (license plate)
      if (client.immatriculation?.toLowerCase().includes(query)) return true;
      
      // Search by email
      if (client.email?.toLowerCase().includes(query)) return true;
      
      // Search by center
      if (client.center_name?.toLowerCase().includes(query)) return true;
      
      return false;
    });
  }, [clients, searchQuery]);

  // Format date for display
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Format phone for display
  const displayPhone = (phone: string | null): string => {
    if (!phone) return '-';
    return formatPhoneDisplay(phone, 'FR') || phone;
  };

  // Selection helpers
  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === filteredClients.length
        ? new Set()
        : new Set(filteredClients.map(c => c.id))
    );
  }, [filteredClients]);

  // Bulk delete handler — cascade deletes all related data
  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeleting(true);
    setDeleteProgress({ current: 0, total: ids.length });

    try {
      // Process in batches of 50 to stay within Supabase query limits
      const batchSize = 50;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        setDeleteProgress({ current: i, total: ids.length });

        // 1. Get conversation IDs for this batch
        const { data: convs } = await supabase
          .from('conversations')
          .select('id')
          .in('client_id', batch);
        const convIds = convs?.map(c => c.id) || [];

        if (convIds.length > 0) {
          // 1a. Get message IDs
          const { data: msgs } = await supabase
            .from('messages')
            .select('id')
            .in('conversation_id', convIds);
          const msgIds = msgs?.map(m => m.id) || [];

          // 1b. Delete whatsapp_status_log
          if (msgIds.length > 0) {
            await supabase.from('whatsapp_status_log').delete().in('message_id', msgIds);
          }

          // 2. Delete messages
          await supabase.from('messages').delete().in('conversation_id', convIds);
        }

        // 3. Get reminder IDs
        const { data: rems } = await supabase
          .from('reminders')
          .select('id')
          .in('client_id', batch);
        const remIds = rems?.map(r => r.id) || [];

        if (remIds.length > 0) {
          await supabase.from('reminder_logs').delete().in('reminder_id', remIds);
        }

        // 4. Delete client_notes
        await supabase.from('client_notes').delete().in('client_id', batch);

        // 5. Delete conversations
        await supabase.from('conversations').delete().in('client_id', batch);

        // 6. Delete reminders
        await supabase.from('reminders').delete().in('client_id', batch);

        // 7. Delete clients
        await supabase.from('clients').delete().in('id', batch);
      }

      // Update local state
      setClients(prev => prev.filter(c => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Bulk delete error:', err);
      alert('Erreur lors de la suppression. Certains clients n\'ont peut-être pas été supprimés.');
    } finally {
      setDeleting(false);
      setDeleteProgress({ current: 0, total: 0 });
    }
  }, [selectedIds]);

  return (
    <div className="h-full flex flex-col bg-background-light dark:bg-background-dark">
      {/* Header */}
      <div className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Annuaire Clients</h2>
              <p className="text-slate-500 text-sm mt-1">
                {loading ? 'Chargement...' : `${filteredClients.length} client${filteredClients.length > 1 ? 's' : ''} ${searchQuery ? 'trouvé(s)' : 'au total'}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {canDelete && selectedIds.size > 0 && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                  Supprimer ({selectedIds.size})
                </button>
              )}
              {canDelete && selectedIds.size > 0 && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium transition-colors"
                >
                  Désélectionner
                </button>
              )}
              <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                {clients.length} enregistrements
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
              search
            </span>
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone ou matricule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-base focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-8">
        <div className="max-w-7xl mx-auto h-full">
          <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col overflow-hidden">
            
            {/* Loading State */}
            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="size-12 border-4 border-primary border-t-transparent animate-spin rounded-full mx-auto"></div>
                  <p className="mt-4 text-slate-500">Chargement des clients...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-red-500">
                  <span className="material-symbols-outlined text-5xl mb-4">error</span>
                  <p className="font-medium">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    Réessayer
                  </button>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && filteredClients.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <span className="material-symbols-outlined text-6xl mb-4">person_search</span>
                  <p className="text-lg font-medium">
                    {searchQuery ? 'Aucun client trouvé' : 'Aucun client dans la base'}
                  </p>
                  <p className="text-sm mt-2">
                    {searchQuery 
                      ? `Aucun résultat pour "${searchQuery}"` 
                      : 'Importez des clients pour commencer'}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-colors"
                    >
                      Effacer la recherche
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Data Table */}
            {!loading && !error && filteredClients.length > 0 && (
              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80 backdrop-blur-sm z-10">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {canDelete && (
                        <th className="pl-6 pr-2 py-4 w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === filteredClients.length && filteredClients.length > 0}
                            onChange={toggleSelectAll}
                            className="size-4 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"
                          />
                        </th>
                      )}
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Client
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Matricule
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Centre
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Dernière visite
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredClients.map((client) => (
                      <tr 
                        key={client.id} 
                        onClick={() => navigate(`/clients/${client.id}`)}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${selectedIds.has(client.id) ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                      >
                        {canDelete && (
                          <td className="pl-6 pr-2 py-4 w-10">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(client.id)}
                              onChange={() => {}}
                              onClick={(e) => toggleSelect(client.id, e)}
                              className="size-4 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"
                            />
                          </td>
                        )}
                        {/* Client Info */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-sm">
                              {client.name ? client.name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {client.name || 'Sans nom'}
                              </p>
                              <p className="text-sm text-slate-500 font-mono">
                                {displayPhone(client.phone)}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Matricule */}
                        <td className="px-6 py-4">
                          {client.immatriculation ? (
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                              {client.immatriculation}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Center */}
                        <td className="px-6 py-4">
                          {client.center_name ? (
                            <span className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                              <span className="material-symbols-outlined text-[16px]">location_on</span>
                              {client.center_name}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Last Visit */}
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {formatDate(client.last_visit)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/clients/${client.id}`);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-semibold transition-colors"
                              title="Voir la fiche client"
                            >
                              <span className="material-symbols-outlined text-[16px]">person</span>
                              Fiche
                            </button>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Plus d'options"
                            >
                              <span className="material-symbols-outlined text-[18px]">more_vert</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer with count */}
            {!loading && !error && filteredClients.length > 0 && (
              <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                Affichage de {filteredClients.length} sur {clients.length} clients
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-12 rounded-full bg-red-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-600 text-2xl">warning</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Supprimer {selectedIds.size} client{selectedIds.size > 1 ? 's' : ''} ?</h3>
                <p className="text-sm text-slate-500">Cette action est irréversible</p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-2">
              Les clients sélectionnés et toutes leurs données associées seront définitivement supprimés :
            </p>
            <ul className="text-sm text-slate-500 mb-6 space-y-1 ml-4 list-disc">
              <li>Relances et historique de workflow</li>
              <li>Conversations et messages WhatsApp</li>
              <li>Notes internes</li>
            </ul>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="size-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                    Suppression... {deleteProgress.current}/{deleteProgress.total}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">delete_forever</span>
                    Confirmer la suppression
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

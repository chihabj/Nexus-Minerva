import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { formatPhoneDisplay } from '../utils/dataNormalizer';
import type { Client } from '../types';

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch clients from Supabase
  useEffect(() => {
    async function fetchClients() {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setClients(data || []);
      } catch (err) {
        console.error('Error fetching clients:', err);
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
      
      // Search by vehicle (plate, model, etc.)
      if (client.vehicle?.toLowerCase().includes(query)) return true;
      
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

  // Open WhatsApp with phone number
  const openWhatsApp = (phone: string | null) => {
    if (!phone) return;
    
    // Clean phone number for WhatsApp (remove spaces, keep +)
    const cleanPhone = phone.replace(/\s/g, '').replace(/^00/, '+');
    const whatsappUrl = `https://wa.me/${cleanPhone.replace('+', '')}`;
    window.open(whatsappUrl, '_blank');
  };

  // Format phone for display
  const displayPhone = (phone: string | null): string => {
    if (!phone) return '-';
    return formatPhoneDisplay(phone, 'FR') || phone;
  };

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
              placeholder="Rechercher par nom, téléphone, plaque ou véhicule..."
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
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Client
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Véhicule
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
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                      >
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

                        {/* Vehicle Info */}
                        <td className="px-6 py-4">
                          {client.vehicle ? (
                            <div>
                              <p className="font-medium text-slate-700 dark:text-slate-300">
                                {client.vehicle}
                              </p>
                              {client.vehicle_year && (
                                <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded mt-1 inline-block">
                                  {client.vehicle_year}
                                </span>
                              )}
                            </div>
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
                            {client.phone && (
                              <button
                                onClick={() => openWhatsApp(client.phone)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-600 rounded-lg text-xs font-semibold transition-colors"
                                title="Envoyer un message WhatsApp"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                Message
                              </button>
                            )}
                            <button
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
    </div>
  );
}

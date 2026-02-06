import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { TechCenter } from '../types';

// Color palette for centers based on their name/index
const colorPalette = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 
  'bg-blue-500', 'bg-violet-500', 'bg-cyan-500', 'bg-orange-500',
  'bg-teal-500', 'bg-pink-500', 'bg-lime-500', 'bg-sky-500'
];

const getColorForCenter = (index: number) => colorPalette[index % colorPalette.length];

export default function Centers() {
  const [centers, setCenters] = useState<TechCenter[]>([]);
  const [filteredCenters, setFilteredCenters] = useState<TechCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Get unique regions from centers
  const regions = [...new Set(centers.map(c => c.region))].sort();

  useEffect(() => {
    fetchCenters();
  }, []);

  useEffect(() => {
    filterCenters();
  }, [centers, searchTerm, regionFilter, statusFilter]);

  const fetchCenters = async () => {
    setLoading(true);
    console.log('[Centers] Fetching centers...');
    
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const { data, error } = await supabase
        .from('tech_centers')
        .select('*')
        .order('name', { ascending: true })
        .abortSignal(controller.signal);
      
      clearTimeout(timeoutId);

      if (error) {
        console.error('[Centers] Error fetching centers:', error);
      } else {
        console.log('[Centers] Loaded', data?.length, 'centers');
        setCenters(data || []);
      }
    } catch (err) {
      console.error('[Centers] Fetch exception:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterCenters = () => {
    let result = [...centers];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(term) ||
        c.address?.toLowerCase().includes(term) ||
        c.region.toLowerCase().includes(term)
      );
    }

    // Region filter
    if (regionFilter !== 'all') {
      result = result.filter(c => c.region === regionFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }

    setFilteredCenters(result);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Connecté
          </span>
        );
      case 'Disconnected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800">
            <span className="size-1.5 rounded-full bg-rose-500"></span>
            Déconnecté
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
            <span className="size-1.5 rounded-full bg-amber-500"></span>
            En attente
          </span>
        );
    }
  };

  // Stats
  const connectedCount = centers.filter(c => c.status === 'Connected').length;
  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Centres Minerva CT</h2>
            <p className="text-slate-500 dark:text-slate-400">Gérez vos centres de contrôle technique partenaires.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchCenters}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">refresh</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-surface-dark rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <span className="material-symbols-outlined text-primary">storefront</span>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Centres</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{centers.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-surface-dark rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <span className="material-symbols-outlined text-emerald-600">check_circle</span>
              </div>
              <div>
                <p className="text-xs text-slate-500">Connectés</p>
                <p className="text-2xl font-bold text-emerald-600">{connectedCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-surface-dark rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <span className="material-symbols-outlined text-blue-600">map</span>
              </div>
              <div>
                <p className="text-xs text-slate-500">Régions</p>
                <p className="text-2xl font-bold text-blue-600">{regions.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="lg:col-span-2 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input 
              type="text" 
              placeholder="Rechercher par nom, adresse ou région..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2.5 text-sm focus:ring-2 focus:ring-primary/20" 
            />
          </div>
          <div className="relative">
            <button 
              onClick={() => { setShowRegionDropdown(!showRegionDropdown); setShowStatusDropdown(false); }}
              className="w-full flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-xl text-sm font-medium"
            >
              <span>{regionFilter === 'all' ? 'Toutes les régions' : regionFilter}</span>
              <span className="material-symbols-outlined text-slate-400">expand_more</span>
            </button>
            {showRegionDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-10 overflow-hidden">
                <button 
                  onClick={() => { setRegionFilter('all'); setShowRegionDropdown(false); }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${regionFilter === 'all' ? 'bg-primary/10 text-primary' : ''}`}
                >
                  Toutes les régions
                </button>
                {regions.map(region => (
                  <button 
                    key={region}
                    onClick={() => { setRegionFilter(region); setShowRegionDropdown(false); }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${regionFilter === region ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button 
              onClick={() => { setShowStatusDropdown(!showStatusDropdown); setShowRegionDropdown(false); }}
              className="w-full flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-xl text-sm font-medium"
            >
              <span>{statusFilter === 'all' ? 'Tous les statuts' : statusFilter}</span>
              <span className="material-symbols-outlined text-slate-400">expand_more</span>
            </button>
            {showStatusDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-10 overflow-hidden">
                <button 
                  onClick={() => { setStatusFilter('all'); setShowStatusDropdown(false); }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${statusFilter === 'all' ? 'bg-primary/10 text-primary' : ''}`}
                >
                  Tous les statuts
                </button>
                {['Connected', 'Pending', 'Disconnected'].map(status => (
                  <button 
                    key={status}
                    onClick={() => { setStatusFilter(status); setShowStatusDropdown(false); }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${statusFilter === status ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    {status === 'Connected' ? 'Connecté' : status === 'Disconnected' ? 'Déconnecté' : 'En attente'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Centers Table */}
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 text-sm">Chargement des centres...</p>
              </div>
            </div>
          ) : filteredCenters.length === 0 ? (
            <div className="p-12 flex items-center justify-center">
              <div className="text-center">
                <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">store_mall_directory</span>
                <p className="text-slate-500">Aucun centre trouvé</p>
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="mt-2 text-primary text-sm hover:underline"
                  >
                    Effacer la recherche
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4">Centre</th>
                    <th className="px-6 py-4">Adresse</th>
                    <th className="px-6 py-4">Région</th>
                    <th className="px-6 py-4">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCenters.map((center, index) => (
                    <tr key={center.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`size-10 rounded-xl flex items-center justify-center text-white font-bold shadow-inner ${getColorForCenter(index)}`}>
                            {center.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-slate-900 dark:text-white truncate max-w-[200px]">{center.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600 dark:text-slate-400 max-w-[250px] truncate" title={center.address || ''}>
                          {center.address || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          {center.region}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(center.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 flex justify-between items-center text-xs font-medium text-slate-500 border-t border-slate-100 dark:border-slate-800">
                <span>
                  {filteredCenters.length === centers.length 
                    ? `${centers.length} centres au total`
                    : `${filteredCenters.length} sur ${centers.length} centres`
                  }
                </span>
                <div className="flex gap-2">
                  {regions.map(region => {
                    const count = centers.filter(c => c.region === region).length;
                    return (
                      <span key={region} className="px-2 py-1 bg-white dark:bg-slate-800 rounded-lg">
                        {region}: {count}
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

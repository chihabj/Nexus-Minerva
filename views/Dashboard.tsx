/**
 * Dashboard - Operational Cockpit
 * 
 * KPIs:
 * - Overdue cases (red)
 * - Due in 7 days (orange)
 * - Due in 30 days (yellow)
 * - Actions waiting (warning)
 * - Confirmed today (green)
 * 
 * Tables:
 * - Urgent Actions (sorted by urgency)
 * - Pipeline ≤30 days (with filters)
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDashboardData } from '../hooks/useDashboardData';
import type { KPIFilter, UrgentActionItem, ReminderStatus } from '../types';

// Status display configuration
const STATUS_DISPLAY: Record<string, { label: string; color: string; bgColor: string }> = {
  New: { label: 'Nouveau', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  Pending: { label: 'En attente', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  Reminder1_sent: { label: 'J-30', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  Reminder2_sent: { label: 'J-15', color: 'text-blue-700', bgColor: 'bg-blue-200' },
  Reminder3_sent: { label: 'J-7', color: 'text-blue-700', bgColor: 'bg-blue-300' },
  Onhold: { label: 'En attente', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  To_be_called: { label: 'À appeler', color: 'text-red-700', bgColor: 'bg-red-100' },
  To_be_contacted: { label: 'À recontacter', color: 'text-pink-700', bgColor: 'bg-pink-100' },
  Appointment_confirmed: { label: 'RDV Confirmé', color: 'text-green-700', bgColor: 'bg-green-100' },
  Closed: { label: 'Fermé', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  Completed: { label: 'Terminé', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
};

// KPI Card Component
interface KPICardProps {
  title: string;
  value: number;
  icon: string;
  color: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray';
  isActive: boolean;
  onClick: () => void;
  subtitle?: string;
}

function KPICard({ title, value, icon, color, isActive, onClick, subtitle }: KPICardProps) {
  const colorClasses = {
    red: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      activeBorder: 'border-red-500',
      icon: 'text-red-500 bg-red-100 dark:bg-red-900/30',
      value: 'text-red-600',
    },
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-800',
      activeBorder: 'border-orange-500',
      icon: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30',
      value: 'text-orange-600',
    },
    yellow: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      activeBorder: 'border-yellow-500',
      icon: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
      value: 'text-yellow-600',
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      activeBorder: 'border-green-500',
      icon: 'text-green-500 bg-green-100 dark:bg-green-900/30',
      value: 'text-green-600',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      activeBorder: 'border-blue-500',
      icon: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
      value: 'text-blue-600',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      border: 'border-purple-200 dark:border-purple-800',
      activeBorder: 'border-purple-500',
      icon: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
      value: 'text-purple-600',
    },
    gray: {
      bg: 'bg-gray-50 dark:bg-gray-900/20',
      border: 'border-gray-200 dark:border-gray-800',
      activeBorder: 'border-gray-500',
      icon: 'text-gray-500 bg-gray-100 dark:bg-gray-900/30',
      value: 'text-gray-600',
    },
  };

  const c = colorClasses[color];

  return (
    <button
      onClick={onClick}
      className={`
        p-4 rounded-xl border-2 transition-all text-left w-full
        ${c.bg} 
        ${isActive ? c.activeBorder : c.border}
        ${isActive ? 'ring-2 ring-offset-2 ring-' + color + '-300' : ''}
        hover:shadow-md
      `}
    >
      <div className="flex items-start justify-between">
        <span className={`material-symbols-outlined ${c.icon} p-2 rounded-lg text-xl`}>
          {icon}
        </span>
        {value > 0 && color === 'red' && (
          <span className="text-[10px] font-bold text-red-600 bg-red-200 px-2 py-0.5 rounded-full animate-pulse">
            URGENT
          </span>
        )}
      </div>
      <div className={`text-3xl font-bold mt-3 ${c.value}`}>{value}</div>
      <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">{title}</div>
      {subtitle && (
        <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>
      )}
    </button>
  );
}

// Urgency badge component
function UrgencyBadge({ level, daysUntilDue }: { level: number; daysUntilDue: number }) {
  if (level === 1) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
        {Math.abs(daysUntilDue)}j RETARD
      </span>
    );
  }
  if (level === 2) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">
        J-{daysUntilDue} URGENT
      </span>
    );
  }
  if (level === 3) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500 text-white">
        J-{daysUntilDue}
      </span>
    );
  }
  if (level === 4) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-400 text-white">
        STAGNANT
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
      J-{daysUntilDue}
    </span>
  );
}

// Format date for display
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    kpis,
    urgentActions,
    pipeline30,
    centers,
    loading,
    error,
    selectedCenterId,
    activeFilter,
    setSelectedCenterId,
    setActiveFilter,
    refresh,
  } = useDashboardData();

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle KPI card click
  const handleKPIClick = (filter: KPIFilter) => {
    setActiveFilter(activeFilter === filter ? 'all' : filter);
  };

  return (
    <div className="p-6 h-full overflow-y-auto custom-scrollbar">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined">
              {toast.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span className="font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="hover:opacity-70">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Tableau de Bord
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Vue opérationnelle des relances et du pipeline
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Center Filter */}
            <select
              value={selectedCenterId || ''}
              onChange={(e) => setSelectedCenterId(e.target.value || null)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Tous les centres</option>
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
            
            {/* Refresh Button */}
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
              Actualiser
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center gap-3">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard
            title="Cas en Retard"
            value={kpis.overdueCount}
            icon="warning"
            color="red"
            isActive={activeFilter === 'overdue'}
            onClick={() => handleKPIClick('overdue')}
          />
          <KPICard
            title="Échéance ≤7j"
            value={kpis.due7DaysCount}
            icon="schedule"
            color="orange"
            isActive={activeFilter === 'due_7_days'}
            onClick={() => handleKPIClick('due_7_days')}
          />
          <KPICard
            title="Pipeline ≤30j"
            value={kpis.due30DaysCount}
            icon="date_range"
            color="yellow"
            isActive={activeFilter === 'due_30_days'}
            onClick={() => handleKPIClick('due_30_days')}
          />
          <KPICard
            title="Actions Requises"
            value={kpis.actionsWaitingCount}
            icon="notifications_active"
            color="purple"
            isActive={activeFilter === 'actions_waiting'}
            onClick={() => handleKPIClick('actions_waiting')}
            subtitle="À traiter"
          />
          <KPICard
            title="Confirmés Auj."
            value={kpis.confirmedTodayCount}
            icon="check_circle"
            color="green"
            isActive={activeFilter === 'confirmed_today'}
            onClick={() => handleKPIClick('confirmed_today')}
          />
        </div>

        {/* Secondary Stats Row */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <span className="text-slate-500">Cas actifs:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{kpis.totalActive}</span>
          </div>
          <button
            onClick={() => handleKPIClick('stagnant')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
              activeFilter === 'stagnant' 
                ? 'bg-gray-300 dark:bg-gray-700' 
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200'
            }`}
          >
            <span className="text-slate-500">Stagnants &gt;7j:</span>
            <span className={`font-bold ${kpis.stagnant7DaysCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {kpis.stagnant7DaysCount}
            </span>
          </button>
          {activeFilter !== 'all' && (
            <button
              onClick={() => setActiveFilter('all')}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              Effacer le filtre
            </button>
          )}
        </div>

        {/* Urgent Actions Table */}
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500">priority_high</span>
                Actions Urgentes
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {urgentActions.length} cas • Triés par urgence
                {activeFilter !== 'all' && (
                  <span className="ml-2 text-primary font-medium">
                    (Filtre: {activeFilter.replace('_', ' ')})
                  </span>
                )}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : urgentActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-4">check_circle</span>
              <p className="text-lg font-medium">Aucune action urgente</p>
              <p className="text-sm mt-1">
                {activeFilter !== 'all' 
                  ? 'Aucun cas ne correspond à ce filtre' 
                  : 'Tous les dossiers sont à jour'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Centre</th>
                    <th className="px-4 py-3">Échéance</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {urgentActions.slice(0, 20).map((item) => {
                    const statusConfig = STATUS_DISPLAY[item.status] || { 
                      label: item.status, 
                      color: 'text-slate-700', 
                      bgColor: 'bg-slate-100' 
                    };
                    
                    return (
                      <tr 
                        key={item.reminderId} 
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                          item.urgencyLevel === 1 ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`size-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                              item.urgencyLevel === 1 
                                ? 'bg-red-500' 
                                : item.urgencyLevel === 2
                                ? 'bg-orange-500'
                                : 'bg-gradient-to-br from-primary to-primary-dark'
                            }`}>
                              {item.clientName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className="font-semibold text-sm">{item.clientName || 'Sans nom'}</div>
                              <div className="text-xs text-slate-400 font-mono flex items-center gap-1">
                                {item.phone || 'Pas de tél.'}
                                {!item.whatsappAvailable && (
                                  <span className="text-red-500" title="WhatsApp indisponible">⚠️</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {item.centerName || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <UrgencyBadge level={item.urgencyLevel} daysUntilDue={item.daysUntilDue} />
                            <span className="text-xs text-slate-400">{formatDate(item.dueDate)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusConfig.color} ${statusConfig.bgColor}`}>
                              {statusConfig.label}
                            </span>
                            {item.isNoReply && (
                              <span className="text-[10px] text-amber-600 font-medium">Sans réponse</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {item.whatsappAvailable && item.phone && (
                              <button
                                onClick={() => navigate(`/inbox?phone=${encodeURIComponent(item.phone || '')}`)}
                                className="p-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                                title="Ouvrir conversation WhatsApp"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                              </button>
                            )}
                            {item.phone && (
                              <a
                                href={`tel:${item.phone}`}
                                className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                                title="Appeler"
                              >
                                <span className="material-symbols-outlined text-[18px]">call</span>
                              </a>
                            )}
                            <Link
                              to={`/clients/${item.clientId}`}
                              className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
                              title="Voir le client"
                            >
                              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {urgentActions.length > 20 && (
                <div className="p-4 text-center border-t border-slate-100 dark:border-slate-800">
                  <Link 
                    to="/todo" 
                    className="text-primary hover:underline text-sm font-medium"
                  >
                    Voir tous les {urgentActions.length} cas →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pipeline 30 Days Table */}
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-yellow-500">calendar_month</span>
                Pipeline ≤30 Jours
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {pipeline30.length} clients avec échéance dans les 30 prochains jours
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : pipeline30.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-4">event_available</span>
              <p className="text-lg font-medium">Pipeline vide</p>
              <p className="text-sm mt-1">Aucun client avec échéance dans les 30 prochains jours</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Véhicule</th>
                    <th className="px-4 py-3">Centre</th>
                    <th className="px-4 py-3">Jours</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Dernière Relance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pipeline30.slice(0, 15).map((item) => {
                    const statusConfig = STATUS_DISPLAY[item.status] || { 
                      label: item.status, 
                      color: 'text-slate-700', 
                      bgColor: 'bg-slate-100' 
                    };
                    
                    return (
                      <tr 
                        key={item.reminderId} 
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-sm">{item.clientName || 'Sans nom'}</div>
                          <div className="text-xs text-slate-400 font-mono">{item.phone || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          <div>{item.marque} {item.modele}</div>
                          <div className="text-xs text-slate-400">{item.immatriculation || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {item.centerName || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${
                            item.daysRemaining <= 3 
                              ? 'text-red-600' 
                              : item.daysRemaining <= 7 
                              ? 'text-orange-600' 
                              : 'text-slate-600'
                          }`}>
                            J-{item.daysRemaining}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusConfig.color} ${statusConfig.bgColor}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {item.lastReminderSent || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pipeline30.length > 15 && (
                <div className="p-4 text-center border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 text-sm">
                    +{pipeline30.length - 15} autres clients dans le pipeline
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

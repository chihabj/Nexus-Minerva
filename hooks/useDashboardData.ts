/**
 * useDashboardData Hook
 * 
 * Fetches and computes all dashboard KPIs and data tables.
 * Supports filtering by center.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import type { 
  DashboardKPIs, 
  UrgentActionItem, 
  PipelineItem, 
  KPIFilter,
  UrgencyLevel,
  ReminderStatus,
  TechCenter,
} from '../types';
import { FINAL_STATUSES, ACTION_STATUSES, REMINDER_SENT_STATUSES } from '../types';

// Helper to get today's date in ISO format
const getToday = () => new Date().toISOString().split('T')[0];

// Helper to calculate days between dates
const daysBetween = (date1: string, date2: string): number => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.ceil((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
};

// Calculate urgency level
const getUrgencyLevel = (daysUntilDue: number, daysSinceStatusChange: number): UrgencyLevel => {
  if (daysUntilDue < 0) return 1;           // RETARD
  if (daysUntilDue <= 3) return 2;          // TRÈS URGENT
  if (daysUntilDue <= 7) return 3;          // URGENT
  if (daysSinceStatusChange > 7) return 4;  // STAGNANT
  return 5;                                  // NORMAL
};

interface UseDashboardDataReturn {
  // Data
  kpis: DashboardKPIs;
  urgentActions: UrgentActionItem[];
  pipeline30: PipelineItem[];
  centers: TechCenter[];
  
  // State
  loading: boolean;
  error: string | null;
  selectedCenterId: string | null;
  activeFilter: KPIFilter;
  
  // Actions
  setSelectedCenterId: (centerId: string | null) => void;
  setActiveFilter: (filter: KPIFilter) => void;
  refresh: () => Promise<void>;
}

export function useDashboardData(): UseDashboardDataReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<KPIFilter>('all');
  
  // Raw data from database
  const [rawReminders, setRawReminders] = useState<any[]>([]);
  const [centers, setCenters] = useState<TechCenter[]>([]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    console.log('[Dashboard] Fetching data...');
    const startTime = performance.now();
    
    try {
      setLoading(true);
      setError(null);

      // Fetch reminders with client data and centers in parallel
      const [remindersResult, centersResult] = await Promise.all([
        supabase
          .from('reminders')
          .select(`
            id,
            client_id,
            due_date,
            status,
            status_changed_at,
            last_reminder_sent,
            last_reminder_at,
            response_received_at,
            created_at,
            clients (
              id,
              name,
              phone,
              center_id,
              center_name,
              whatsapp_available,
              marque,
              modele,
              immatriculation
            )
          `)
          .order('due_date', { ascending: true }),
        
        supabase
          .from('tech_centers')
          .select('*')
          .order('name', { ascending: true }),
      ]);

      if (remindersResult.error) throw remindersResult.error;
      if (centersResult.error) throw centersResult.error;

      console.log('[Dashboard] Loaded', remindersResult.data?.length, 'reminders in', Math.round(performance.now() - startTime), 'ms');

      setRawReminders(remindersResult.data || []);
      setCenters(centersResult.data || []);
    } catch (err) {
      console.error('[Dashboard] Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute KPIs from raw data
  const kpis = useMemo<DashboardKPIs>(() => {
    const today = getToday();
    const todayDate = new Date(today);
    
    // Filter by center if selected
    const filteredReminders = selectedCenterId
      ? rawReminders.filter(r => r.clients?.center_id === selectedCenterId)
      : rawReminders;

    let overdueCount = 0;
    let due7DaysCount = 0;
    let due30DaysCount = 0;
    let confirmedTodayCount = 0;
    let actionsWaitingCount = 0;
    let stagnant7DaysCount = 0;
    let stagnant14DaysCount = 0;
    let totalActive = 0;

    for (const r of filteredReminders) {
      const status = r.status as ReminderStatus;
      const dueDate = r.due_date;
      const statusChangedAt = r.status_changed_at;
      const whatsappAvailable = r.clients?.whatsapp_available ?? true;

      // Skip final statuses for most KPIs
      const isFinal = FINAL_STATUSES.includes(status);
      
      if (!isFinal) {
        totalActive++;
        
        const daysUntilDue = daysBetween(dueDate, today);
        const daysSinceStatusChange = statusChangedAt 
          ? daysBetween(today, statusChangedAt.split('T')[0])
          : 0;

        // Overdue
        if (daysUntilDue < 0) {
          overdueCount++;
        }
        
        // Due in 7 days (includes today)
        if (daysUntilDue >= 0 && daysUntilDue <= 7) {
          due7DaysCount++;
        }
        
        // Due in 30 days (includes today)
        if (daysUntilDue >= 0 && daysUntilDue <= 30) {
          due30DaysCount++;
        }
        
        // Actions waiting
        if (ACTION_STATUSES.includes(status) || 
            (REMINDER_SENT_STATUSES.includes(status) && !whatsappAvailable)) {
          actionsWaitingCount++;
        }
        
        // Stagnant cases
        if (daysSinceStatusChange > 7) {
          stagnant7DaysCount++;
        }
        if (daysSinceStatusChange > 14) {
          stagnant14DaysCount++;
        }
      }
      
      // Confirmed today (check even if it's a final status)
      if (status === 'Appointment_confirmed' && statusChangedAt) {
        const changedDate = statusChangedAt.split('T')[0];
        if (changedDate === today) {
          confirmedTodayCount++;
        }
      }
    }

    return {
      overdueCount,
      due7DaysCount,
      due30DaysCount,
      confirmedTodayCount,
      actionsWaitingCount,
      stagnant7DaysCount,
      stagnant14DaysCount,
      totalActive,
    };
  }, [rawReminders, selectedCenterId]);

  // Compute urgent actions table
  const urgentActions = useMemo<UrgentActionItem[]>(() => {
    const today = getToday();
    
    // Filter by center if selected
    let filteredReminders = selectedCenterId
      ? rawReminders.filter(r => r.clients?.center_id === selectedCenterId)
      : rawReminders;

    // Filter out final statuses
    filteredReminders = filteredReminders.filter(
      r => !FINAL_STATUSES.includes(r.status as ReminderStatus)
    );

    // Apply active filter
    if (activeFilter !== 'all') {
      filteredReminders = filteredReminders.filter(r => {
        const status = r.status as ReminderStatus;
        const daysUntilDue = daysBetween(r.due_date, today);
        const daysSinceStatusChange = r.status_changed_at 
          ? daysBetween(today, r.status_changed_at.split('T')[0])
          : 0;
        const whatsappAvailable = r.clients?.whatsapp_available ?? true;

        switch (activeFilter) {
          case 'overdue':
            return daysUntilDue < 0;
          case 'due_7_days':
            return daysUntilDue >= 0 && daysUntilDue <= 7;
          case 'due_30_days':
            return daysUntilDue >= 0 && daysUntilDue <= 30;
          case 'actions_waiting':
            return ACTION_STATUSES.includes(status) || 
                   (REMINDER_SENT_STATUSES.includes(status) && !whatsappAvailable);
          case 'stagnant':
            return daysSinceStatusChange > 7;
          case 'confirmed_today':
            return false; // Confirmed cases are final, don't show in urgent actions
          default:
            return true;
        }
      });
    }

    // Transform to UrgentActionItem
    const items: UrgentActionItem[] = filteredReminders.map(r => {
      const daysUntilDue = daysBetween(r.due_date, today);
      const daysSinceStatusChange = r.status_changed_at 
        ? daysBetween(today, r.status_changed_at.split('T')[0])
        : 0;
      
      // Detect "No Reply" dynamically
      const isNoReply = REMINDER_SENT_STATUSES.includes(r.status) &&
        !r.response_received_at &&
        r.last_reminder_at &&
        daysBetween(today, r.last_reminder_at.split('T')[0]) > 3;

      return {
        reminderId: r.id,
        clientId: r.client_id,
        clientName: r.clients?.name || null,
        phone: r.clients?.phone || null,
        centerId: r.clients?.center_id || null,
        centerName: r.clients?.center_name || null,
        whatsappAvailable: r.clients?.whatsapp_available ?? true,
        dueDate: r.due_date,
        daysUntilDue,
        status: r.status,
        statusChangedAt: r.status_changed_at,
        lastActionAt: r.last_reminder_at || r.status_changed_at || null,
        lastReminderSent: r.last_reminder_sent,
        urgencyLevel: getUrgencyLevel(daysUntilDue, daysSinceStatusChange),
        isNoReply,
      };
    });

    // Sort by urgency
    return items.sort((a, b) => {
      // First by urgency level
      if (a.urgencyLevel !== b.urgencyLevel) {
        return a.urgencyLevel - b.urgencyLevel;
      }
      // Then by due date
      return a.daysUntilDue - b.daysUntilDue;
    });
  }, [rawReminders, selectedCenterId, activeFilter]);

  // Compute pipeline 30 days table
  const pipeline30 = useMemo<PipelineItem[]>(() => {
    const today = getToday();
    
    // Filter by center if selected
    let filteredReminders = selectedCenterId
      ? rawReminders.filter(r => r.clients?.center_id === selectedCenterId)
      : rawReminders;

    // Filter: due within 30 days, not final status
    filteredReminders = filteredReminders.filter(r => {
      const daysUntilDue = daysBetween(r.due_date, today);
      const isFinal = FINAL_STATUSES.includes(r.status as ReminderStatus);
      return daysUntilDue >= 0 && daysUntilDue <= 30 && !isFinal;
    });

    // Transform to PipelineItem
    const items: PipelineItem[] = filteredReminders.map(r => ({
      reminderId: r.id,
      clientId: r.client_id,
      clientName: r.clients?.name || null,
      phone: r.clients?.phone || null,
      centerName: r.clients?.center_name || null,
      marque: r.clients?.marque || null,
      modele: r.clients?.modele || null,
      immatriculation: r.clients?.immatriculation || null,
      whatsappAvailable: r.clients?.whatsapp_available ?? true,
      dueDate: r.due_date,
      daysRemaining: daysBetween(r.due_date, today),
      status: r.status,
      lastReminderSent: r.last_reminder_sent,
    }));

    // Sort by days remaining
    return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [rawReminders, selectedCenterId]);

  return {
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
    refresh: fetchData,
  };
}

export default useDashboardData;

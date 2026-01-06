import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '../services/supabaseClient';
import type { Reminder, Client } from '../types';

const chartData = [
  { name: 'Mon', value: 40 },
  { name: 'Tue', value: 30 },
  { name: 'Wed', value: 65 },
  { name: 'Thu', value: 45 },
  { name: 'Fri', value: 90 },
  { name: 'Sat', value: 55 },
  { name: 'Sun', value: 20 },
];

interface ReminderWithClient extends Reminder {
  clients: Client | null;
}

export default function Dashboard() {
  const [reminders, setReminders] = useState<ReminderWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReminders() {
      try {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
          .from('reminders')
          .select(`
            *,
            clients (*)
          `)
          .gte('reminder_date', today)
          .order('reminder_date', { ascending: true })
          .limit(10);

        if (error) throw error;
        setReminders(data || []);
      } catch (err) {
        console.error('Error fetching reminders:', err);
        setError(err instanceof Error ? err.message : 'Failed to load reminders');
      } finally {
        setLoading(false);
      }
    }

    fetchReminders();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ready': return 'bg-green-100 text-green-700';
      case 'Pending': return 'bg-amber-100 text-amber-700';
      case 'Sent': return 'bg-slate-100 text-slate-700';
      case 'Failed': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Good Morning, Alex</h2>
          <p className="text-slate-500 dark:text-slate-400">Here is what's happening in your technical centers today.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">event_available</span>
              <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">+12%</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Daily Appointments</p>
            <h3 className="text-3xl font-bold mt-1">42</h3>
          </div>
          <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="material-symbols-outlined text-orange-500 bg-orange-50 p-2 rounded-lg">mark_chat_unread</span>
              <span className="text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">+5</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Unread Messages</p>
            <h3 className="text-3xl font-bold mt-1">15</h3>
          </div>
          <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="material-symbols-outlined text-green-500 bg-green-50 p-2 rounded-lg">trending_up</span>
              <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">+2%</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Service Rate</p>
            <h3 className="text-3xl font-bold mt-1">94%</h3>
          </div>
          <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="material-symbols-outlined text-purple-500 bg-purple-50 p-2 rounded-lg">inventory_2</span>
              <span className="text-xs font-medium text-slate-500 bg-slate-50 dark:bg-slate-900/20 px-2 py-0.5 rounded-full">Static</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Parts Inventory</p>
            <h3 className="text-3xl font-bold mt-1">1.2k</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Reminders Table */}
          <div className="lg:col-span-2 bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h4 className="font-bold text-lg">Today's Reminders</h4>
              <button className="text-primary text-sm font-medium hover:underline">View All</button>
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
                <div className="flex items-center justify-center p-12 text-slate-400">
                  <span className="material-symbols-outlined mr-2">event_busy</span>
                  No reminders for today
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Client</th>
                      <th className="px-6 py-4">Vehicle</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {reminders.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-sm">{r.clients?.name || 'Unknown'}</div>
                          <div className="text-xs text-slate-400">ID #{r.client_id.slice(0, 4)}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                          {r.clients?.vehicle || 'N/A'} {r.clients?.vehicle_year ? `(${r.clients.vehicle_year})` : ''}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${getStatusColor(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-all">
                            <span className="material-symbols-outlined text-[18px]">send</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col">
            <h4 className="font-bold text-lg mb-6">Service Volume</h4>
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.value > 60 ? '#135bec' : '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

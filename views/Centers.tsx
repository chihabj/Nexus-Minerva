
import React from 'react';

const centers = [
  { id: 'CN-8492', name: 'Downtown Tech Hub', staff: 12, status: 'Connected', region: 'North America', color: 'bg-indigo-500' },
  { id: 'CN-1023', name: 'Northside Repair', staff: 8, status: 'Disconnected', region: 'Europe', color: 'bg-orange-500' },
  { id: 'CN-5511', name: 'West End Service', staff: 15, status: 'Pending', region: 'Asia Pacific', color: 'bg-blue-500' },
  { id: 'CN-3329', name: 'Eastside Logistics', staff: 6, status: 'Connected', region: 'North America', color: 'bg-teal-500' },
  { id: 'CN-4421', name: 'Central Hub', staff: 22, status: 'Connected', region: 'Europe', color: 'bg-purple-500' },
];

export default function Centers() {
  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Center Management</h2>
            <p className="text-slate-500 dark:text-slate-400">Configure and monitor your technical centers globally.</p>
          </div>
          <button className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-primary/30">
            <span className="material-symbols-outlined">add</span>
            <span>Add New Center</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="lg:col-span-2 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input type="text" placeholder="Search by name or ID..." className="w-full pl-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2.5 text-sm" />
          </div>
          <div className="flex gap-2">
            <button className="flex-1 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-xl text-sm font-bold">Region</button>
            <button className="flex-1 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-xl text-sm font-bold">Status</button>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-8 py-4">Center Name</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Staff</th>
                <th className="px-8 py-4">Region</th>
                <th className="px-8 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {centers.map((c) => (
                <tr key={c.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className={`size-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-inner ${c.color}`}>
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{c.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">ID: {c.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${
                      c.status === 'Connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      c.status === 'Disconnected' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                      'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      <span className={`size-1.5 rounded-full ${c.status === 'Connected' ? 'bg-emerald-500 animate-pulse' : c.status === 'Disconnected' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex -space-x-3">
                      {[1, 2, 3].map(i => (
                        <img key={i} src={`https://picsum.photos/seed/staff${c.id}${i}/100/100`} className="size-8 rounded-full border-2 border-white dark:border-surface-dark object-cover" alt="Avatar" />
                      ))}
                      <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-surface-dark flex items-center justify-center text-[10px] font-bold">+{c.staff - 3}</div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm text-slate-500 font-medium">{c.region}</td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-all">Configure</button>
                      <button className="p-2 text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 transition-all"><span className="material-symbols-outlined">more_vert</span></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-6 bg-slate-50 dark:bg-slate-800/30 flex justify-between items-center text-xs font-medium text-slate-500">
            <span>Showing 5 of 48 centers</span>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:shadow-md transition-all">Previous</button>
              <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:shadow-md transition-all">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


import React, { useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './views/Dashboard';
import Inbox from './views/Inbox';
import ImportData from './views/ImportData';
import Centers from './views/Centers';

const Sidebar = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="w-64 flex-none bg-surface-light dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 flex flex-col h-full z-20">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-primary aspect-square rounded-xl size-10 flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-white text-2xl">hub</span>
        </div>
        <div className="flex flex-col">
          <h1 className="text-slate-900 dark:text-white text-base font-bold leading-tight">Nexus Connect</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Admin Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
        <Link to="/" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/') ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-sm">Dashboard</span>
        </Link>
        <Link to="/inbox" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/inbox') ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
          <span className="material-symbols-outlined">inbox</span>
          <span className="text-sm">Messages</span>
          <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">15</span>
        </Link>
        <Link to="/import" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/import') ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
          <span className="material-symbols-outlined">cloud_upload</span>
          <span className="text-sm">Import Data</span>
        </Link>
        <Link to="/centers" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/centers') ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
          <span className="material-symbols-outlined">storefront</span>
          <span className="text-sm">Centers</span>
        </Link>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
          <span className="material-symbols-outlined">settings</span>
          <span className="text-sm">Settings</span>
        </button>
      </nav>

      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
          <img src="https://picsum.photos/seed/alex/100/100" className="size-9 rounded-full object-cover" alt="User" />
          <div className="flex flex-col min-w-0">
            <p className="text-sm font-semibold truncate text-slate-900 dark:text-white">Alex Morgan</p>
            <p className="text-xs text-slate-500 truncate">Regional Manager</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

const TopBar = () => {
  const [dark, setDark] = useState(false);
  const toggleDark = () => {
    setDark(!dark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <header className="h-16 flex-none bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-10 shadow-sm">
      <div className="relative w-96 group">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] group-focus-within:text-primary">search</span>
        <input type="text" placeholder="Search anything..." className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-500" />
      </div>
      
      <div className="flex items-center gap-4">
        <button onClick={toggleDark} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all">
          <span className="material-symbols-outlined">{dark ? 'light_mode' : 'dark_mode'}</span>
        </button>
        <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg relative transition-all">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>
        </button>
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>
        <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-all shadow-sm shadow-primary/30">
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>New Ticket</span>
        </button>
      </div>
    </header>
  );
};

export default function App() {
  return (
    <HashRouter>
      <div className="flex h-screen w-full bg-background-light dark:bg-background-dark">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/import" element={<ImportData />} />
              <Route path="/centers" element={<Centers />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}

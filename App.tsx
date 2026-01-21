import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Dashboard from './views/Dashboard';
import Inbox from './views/Inbox';
import ImportData from './views/ImportData';
import Centers from './views/Centers';
import Clients from './views/Clients';
import ClientDetails from './views/ClientDetails';
import TodoList from './views/TodoList';
import Login from './views/Login';
import Settings from './views/Settings';
import { supabase } from './services/supabaseClient';
import type { Notification } from './types';

// Protected Route component
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role) && profile.role !== 'superadmin') {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4">block</span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Accès refusé</h2>
          <p className="text-slate-500">Vous n'avez pas les permissions nécessaires.</p>
          <Link to="/" className="mt-4 inline-block text-primary hover:underline">
            Retour au dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const Sidebar = () => {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'superadmin':
        return <span className="text-[9px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full">Super</span>;
      case 'admin':
        return <span className="text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full">Admin</span>;
      default:
        return <span className="text-[9px] bg-slate-500 text-white px-1.5 py-0.5 rounded-full">Agent</span>;
    }
  };

  return (
    <aside className="w-64 flex-none bg-surface-light dark:bg-surface-dark border-r border-slate-200 dark:border-slate-800 flex flex-col h-full z-20">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-primary aspect-square rounded-xl size-10 flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-white text-2xl">hub</span>
        </div>
        <div className="flex flex-col">
          <h1 className="text-slate-900 dark:text-white text-base font-bold leading-tight">Nexus Connect</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">CRM Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
        <Link to="/" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/') && location.pathname === '/' ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-sm">Dashboard</span>
        </Link>
        <Link to="/inbox" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/inbox') ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
          <span className="material-symbols-outlined">inbox</span>
          <span className="text-sm">Messages</span>
        </Link>
        <Link to="/todo" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/todo') ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
          <span className="material-symbols-outlined">checklist</span>
          <span className="text-sm">Todo List</span>
        </Link>
        
        {/* Admin only sections */}
        {profile && ['superadmin', 'admin'].includes(profile.role) && (
          <Link to="/import" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/import') ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <span className="material-symbols-outlined">cloud_upload</span>
            <span className="text-sm">Import Data</span>
          </Link>
        )}
        
        <Link to="/clients" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/clients') ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
          <span className="material-symbols-outlined">contacts</span>
          <span className="text-sm">Clients</span>
        </Link>
        
        {profile && ['superadmin', 'admin'].includes(profile.role) && (
          <Link to="/centers" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/centers') ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <span className="material-symbols-outlined">storefront</span>
            <span className="text-sm">Centers</span>
          </Link>
        )}
        
        {profile?.role === 'superadmin' && (
          <Link to="/settings" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive('/settings') ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <span className="material-symbols-outlined">settings</span>
            <span className="text-sm">Settings</span>
          </Link>
        )}
      </nav>

      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800">
          <div className="size-9 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold">
            {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate text-slate-900 dark:text-white">
                {profile?.full_name || profile?.email?.split('@')[0] || 'Utilisateur'}
              </p>
              {profile && getRoleBadge(profile.role)}
            </div>
            <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            title="Déconnexion"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

const TopBar = () => {
  const [dark, setDark] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const { user } = useAuth();

  const toggleDark = () => {
    setDark(!dark);
    document.documentElement.classList.toggle('dark');
  };

  // Fetch notifications
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (data) setNotifications(data);
    };

    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <header className="h-16 flex-none bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 z-10 shadow-sm">
      <div className="relative w-96 group">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] group-focus-within:text-primary">search</span>
        <input type="text" placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-500" />
      </div>
      
      <div className="flex items-center gap-4">
        <button onClick={toggleDark} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all">
          <span className="material-symbols-outlined">{dark ? 'light_mode' : 'dark_mode'}</span>
        </button>
        
        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg relative transition-all"
          >
            <span className="material-symbols-outlined">notifications</span>
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 size-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                {notifications.length}
              </span>
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-surface-dark rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
              <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-bold text-sm">Notifications</h3>
                {notifications.length > 0 && (
                  <span className="text-xs text-slate-500">{notifications.length} non lues</span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    <span className="material-symbols-outlined text-3xl mb-2">notifications_off</span>
                    <p className="text-sm">Aucune notification</p>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-50 dark:border-slate-800 cursor-pointer"
                      onClick={() => markAsRead(notif.id)}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`material-symbols-outlined text-lg ${
                          notif.type === 'error' ? 'text-red-500' :
                          notif.type === 'warning' ? 'text-amber-500' :
                          notif.type === 'success' ? 'text-green-500' :
                          notif.type === 'action_required' ? 'text-orange-500' :
                          'text-blue-500'
                        }`}>
                          {notif.type === 'error' ? 'error' :
                           notif.type === 'warning' ? 'warning' :
                           notif.type === 'success' ? 'check_circle' :
                           notif.type === 'action_required' ? 'priority_high' :
                           'info'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{notif.title}</p>
                          <p className="text-xs text-slate-500 line-clamp-2">{notif.message}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background-light dark:bg-background-dark">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
            <Route path="/todo" element={<ProtectedRoute><TodoList /></ProtectedRoute>} />
            <Route path="/import" element={<ProtectedRoute allowedRoles={['admin']}><ImportData /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="/clients/:id" element={<ProtectedRoute><ClientDetails /></ProtectedRoute>} />
            <Route path="/centers" element={<ProtectedRoute allowedRoles={['admin']}><Centers /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={['superadmin']}><Settings /></ProtectedRoute>} />
            <Route path="/login" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HashRouter>
  );
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import type { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role?: UserRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from user_profiles table
  const fetchProfile = async (userId: string, userEmail?: string, userMetadata?: any): Promise<UserProfile | null> => {
    try {
      console.log('[Auth] Fetching profile for user:', userId);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
        .abortSignal(controller.signal);
      
      clearTimeout(timeoutId);
      
      console.log('[Auth] Query result:', { data, error });

      if (error) {
        console.warn('[Auth] Profile fetch error:', error.message, error.code);
        
        // If profile doesn't exist or query failed, try to create one from user metadata
        if ((error.code === 'PGRST116' || error.code === '20') && userEmail) {
          console.log('[Auth] Creating profile from metadata...');
          const newProfile: UserProfile = {
            id: userId,
            email: userEmail,
            full_name: userMetadata?.full_name || userEmail.split('@')[0],
            role: userMetadata?.role || 'agent',
            avatar_url: null,
            center_id: null,
            is_active: true,
            last_login: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          const { error: insertError } = await supabase
            .from('user_profiles')
            .insert(newProfile);
          
          if (insertError) {
            console.error('[Auth] Failed to create profile:', insertError);
          } else {
            console.log('[Auth] Profile created successfully');
            return newProfile;
          }
        }
        
        // Fallback: return a minimal profile from metadata so the app still works
        if (userEmail && userMetadata) {
          console.log('[Auth] Using fallback profile from metadata');
          return {
            id: userId,
            email: userEmail,
            full_name: userMetadata.full_name || userEmail.split('@')[0],
            role: userMetadata.role || 'agent',
            avatar_url: null,
            center_id: null,
            is_active: true,
            last_login: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
        
        return null;
      }

      // If no profile found (maybeSingle returns null), create from metadata
      if (!data && userEmail) {
        console.log('[Auth] No profile found, using metadata fallback');
        return {
          id: userId,
          email: userEmail,
          full_name: userMetadata?.full_name || userEmail.split('@')[0],
          role: userMetadata?.role || 'agent',
          avatar_url: null,
          center_id: null,
          is_active: true,
          last_login: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      
      console.log('[Auth] Profile loaded:', data?.email, 'role:', data?.role);
      return data as UserProfile;
    } catch (err) {
      console.error('[Auth] Error fetching profile:', err);
      return null;
    }
  };

  // Helper to create profile from user metadata (instant, no DB call)
  const createProfileFromMetadata = (user: User): UserProfile => ({
    id: user.id,
    email: user.email || '',
    full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilisateur',
    role: user.user_metadata?.role || 'agent',
    avatar_url: null,
    center_id: null,
    is_active: true,
    last_login: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Initialize auth state - OPTIMIZED for speed
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const startTime = performance.now();
      console.log('[Auth] Initializing...');
      
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Set profile IMMEDIATELY from metadata (no waiting for DB)
          const metadataProfile = createProfileFromMetadata(session.user);
          console.log('[Auth] Profile from metadata:', metadataProfile.full_name, metadataProfile.role);
          setProfile(metadataProfile);
          
          // Fetch DB profile in background (non-blocking)
          fetchProfile(session.user.id, session.user.email, session.user.user_metadata)
            .then(dbProfile => {
              if (mounted && dbProfile) {
                setProfile(dbProfile);
              }
            })
            .catch(() => {}); // Silent fail, we have metadata profile
        }
        
        console.log('[Auth] Init complete in', Math.round(performance.now() - startTime), 'ms');
      } catch (error) {
        console.error('[Auth] Initialization error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Start immediately
    initAuth();

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] Auth state changed:', event);
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Set profile immediately from metadata
          setProfile(createProfileFromMetadata(session.user));
          
          // Fetch full profile in background
          fetchProfile(session.user.id, session.user.email, session.user.user_metadata)
            .then(dbProfile => {
              if (mounted && dbProfile) setProfile(dbProfile);
            })
            .catch(() => {});
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  };

  // Sign up with email, password, and optional role
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole = 'agent'
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        },
        emailRedirectTo: window.location.origin, // Redirect to current domain (works for dev & prod)
      },
    });

    return { error: error as Error | null };
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  // Check if user has required role
  const hasPermission = (requiredRoles: UserRole[]): boolean => {
    if (!profile) return false;
    
    // Superadmin has access to everything
    if (profile.role === 'superadmin') return true;
    
    return requiredRoles.includes(profile.role);
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

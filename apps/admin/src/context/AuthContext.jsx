/**
 * apps/admin/src/context/AuthContext.jsx
 *
 * Purpose: Authentication state provider for the Admin Panel.
 * Validates sessions via the /api/auth/me endpoint on mount,
 * enforces role-based access, and syncs admin identity with localStorage.
 */
import React, { useState, useEffect } from 'react';
import { AuthContext } from './AuthContextObject';

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        let API_URL = (import.meta.env.VITE_API_URL || "").trim().replace(/^https?:\/\/[^/]+/, '').replace(/\/+/g, '/').replace(/\/$/, '');
        if (API_URL === '/api' || API_URL === 'api') API_URL = '';
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${JSON.parse(localStorage.getItem('adminUser') || '{}').token || ''}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user) {
            // Priority: Check if the user has an admin-level role
            const role = data.user.role;
            const isAdmin = role === 'admin' || role === 'superadmin' || role === 'organizer' || role === 'owner';
            
            if (isAdmin) {
              setAdmin(data.user);
              // Sync to localStorage while PRESERVING the existing token
              const existing = JSON.parse(localStorage.getItem('adminUser') || '{}');
              localStorage.setItem('adminUser', JSON.stringify({ ...existing, user: data.user }));
            } else {
              setAdmin(null);
              localStorage.removeItem('adminUser');
            }
          } else {
            setAdmin(null);
            localStorage.removeItem('adminUser');
          }
        } else {
          // Fallback to localStorage if server is unreachable but don't clear immediately
          const saved = localStorage.getItem('adminUser');
          if (saved) {
            const data = JSON.parse(saved);
            setAdmin(data.user || data);
          }
        }
      } catch (e) {
        console.error("Session sync failed:", e);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = (sessionData) => {
    setAdmin(sessionData.user);
    localStorage.setItem('adminUser', JSON.stringify(sessionData));
  };

  const logout = () => {
    setAdmin(null);
    localStorage.removeItem('adminUser');
  };

  return (
    <AuthContext.Provider value={{ admin, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};



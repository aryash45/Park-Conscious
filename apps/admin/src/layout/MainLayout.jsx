/**
 * apps/admin/src/layout/MainLayout.jsx
 *
 * Purpose: Persistent shell layout for all authenticated admin pages.
 * Renders the sidebar navigation, top header bar, and an <Outlet> for
 * child routes. Navigation items are conditionally shown based on user role.
 */
import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  BarChart, Calendar, Users, Settings, 
  LogOut, Menu, Shield, Bell,
  Search, Activity, Inbox, QrCode, Tv
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const SidebarItem = ({ icon: Icon, label, to }) => (
  <NavLink 
    to={to}
    className={({ isActive }) => `
      group flex items-center gap-3 px-4 py-2 rounded-lg transition-all text-xs font-semibold tracking-[-0.01em]
      ${isActive 
        ? 'bg-white/5 text-white' 
        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'}
    `}
  >
    {({ isActive }) => (
      <>
        <Icon size={16} className={isActive ? 'text-sky-400' : 'text-zinc-600 group-hover:text-zinc-400'} />
        <span>{label}</span>
        {isActive && <div className="ml-auto w-1 h-1 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]" />}
      </>
    )}
  </NavLink>
);

const MainLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isSuperAdmin = admin?.role === 'superadmin';

  return (
    <div className="min-h-screen bg-[#050508] text-zinc-400 flex selection:bg-sky-500/20 font-inter">
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 w-64 bg-zinc-950/40 backdrop-blur-xl border-r border-white/[0.03] z-50 transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header/Branding */}
          <div className="px-6 py-10">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Shield className="text-sky-400" size={16} />
              </div>
              <div>
                <h1 className="font-bold text-zinc-100 tracking-tighter text-sm uppercase">
                  Park Conscious
                </h1>
                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
                  {isSuperAdmin ? 'Admin Dashboard' : 'Organizer Portal'}
                </p>
              </div>
            </div>

            {/* Navigation Items */}
            <nav className="space-y-1">
              <div className="text-[9px] font-bold text-zinc-700 uppercase tracking-[0.2em] mb-4 ml-1">Management</div>
              <SidebarItem icon={BarChart} label="Dashboard" to="/" />
              <SidebarItem icon={Calendar} label="Events" to="/events" />
              <SidebarItem icon={Users} label="Attendees" to="/attendees" />
              {isSuperAdmin && <SidebarItem icon={QrCode} label="Scanner App" to="/scanner" />}
              
              {isSuperAdmin && (
                <>
                  <div className="text-[9px] font-bold text-zinc-700 uppercase tracking-[0.2em] mt-8 mb-4 ml-1">Team</div>
                  <SidebarItem icon={Tv} label="Homepage Editorial" to="/banners" />
                  <SidebarItem icon={Inbox} label="Inquiries" to="/inquiries" />
                  <SidebarItem icon={Activity} label="Health" to="/health" />
                  <SidebarItem icon={Settings} label="Settings" to="/settings" />
                </>
              )}
            </nav>
          </div>

          {/* User Block */}
          <div className="mt-auto p-4">
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3 flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-100 font-bold text-xs uppercase">
                {admin?.name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-zinc-200 truncate leading-none">{admin?.name}</p>
                <button 
                  onClick={handleLogout}
                  className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest hover:text-sky-400 transition-colors flex items-center gap-1 mt-1.5"
                >
                  <LogOut size={8} /> Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-8 bg-zinc-950/20 backdrop-blur-md border-b border-white/[0.02] sticky top-0 z-30">
          <div className="flex items-center gap-6">
            <button 
              className="lg:hidden p-2 text-zinc-500 hover:text-white"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={18} />
            </button>
            <div className="hidden md:flex items-center gap-2 group cursor-pointer border border-white/[0.05] bg-zinc-900/40 rounded-lg px-3 py-1.5 transition-all hover:bg-zinc-900/60">
              <Search size={12} className="text-zinc-600" />
              <span className="text-[10px] font-medium text-zinc-500">Search...</span>
              <kbd className="ml-8 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-600 text-[8px] font-bold border border-white/5">⌘K</kbd>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5">
              <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[8px] font-bold text-emerald-500/80 uppercase tracking-widest">System Online</span>
            </div>
            <button className="p-2 text-zinc-500 hover:text-white transition-colors relative">
              <Bell size={18} />
              <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full bg-sky-500 border border-zinc-950" />
            </button>
          </div>
        </header>

        {/* Dynamic Viewport */}
        <div className="p-4 lg:p-8">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default MainLayout;

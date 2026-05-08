/**
 * apps/admin/src/App.jsx
 *
 * Purpose: Root component for the Admin Panel.
 * Sets up React Router, wraps the app in an AuthProvider and an Error Boundary,
 * and defines all protected/public routes including role-based SuperAdmin routes.
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import MainLayout from './layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import CreateEvent from './pages/CreateEvent';
import PriceUpdater from './pages/PriceUpdater';
import Attendees from './pages/Attendees';
import Settings from './pages/Settings';
import Login from './pages/Login';
import EditEvent from './pages/EditEvent';
import SystemHealth from './pages/SystemHealth';
import Inquiries from './pages/Inquiries';
import ScannerApp from './pages/ScannerApp';
import { RefreshCw } from 'lucide-react';

const PrivateRoute = ({ children }) => {
  const { admin, loading } = useAuth();
  
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <RefreshCw className="text-sky-500 animate-spin" size={40} />
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Authenticating Session</span>
    </div>
  );
  
  if (admin && admin.role === 'scanner') return <Navigate to="/scanner" replace />;
  return admin ? children : <Navigate to="/login" replace />;
};

const ScannerRoute = ({ children }) => {
  const { admin, loading } = useAuth();
  
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <RefreshCw className="text-sky-500 animate-spin" size={40} />
    </div>
  );
  
  if (!admin) return <Navigate to="/login" replace />;
  if (admin.role !== 'scanner' && admin.role !== 'superadmin') return <Navigate to="/" replace />;
  
  return children;
};

const SuperAdminRoute = ({ children }) => {
  const { admin } = useAuth();
  return admin?.role === 'superadmin' ? children : <Navigate to="/" replace />;
};

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { 
    console.error('CRITICAL ADMIN CRASH:', error, errorInfo); 
    
    // Automatically report to centralized system log
    fetch('/api/admin/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'admin',
        type: 'frontend_crash',
        message: error.message || 'Unknown Admin Crash',
        stack: error.stack,
        url: window.location.href,
        metadata: { errorInfo }
      })
    }).catch(err => console.error('Failed to send error report:', err));
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center text-slate-200">
          <div className="max-w-md space-y-6">
            <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
              <span className="text-4xl text-rose-500">☢️</span>
            </div>
            <h1 className="text-white text-2xl font-black uppercase tracking-tighter">System Malfunction</h1>
            <p className="text-slate-400 text-sm font-medium">A critical error occurred in the Admin Panel runtime. This is likely due to a missing component or an unexpected API response.</p>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-[10px] font-mono text-rose-400 text-left overflow-auto max-h-40">
              {this.state.error?.message}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="bg-sky-600 text-white px-8 py-3 rounded-xl text-xs font-bold uppercase transition hover:bg-sky-500"
            >
              Attempt System Reboot
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="events" element={<Events />} />
              <Route path="events/create" element={<CreateEvent />} />
              <Route path="events/edit/:id" element={<EditEvent />} />
              <Route path="price-updater" element={<PriceUpdater />} />
              <Route path="health" element={<SuperAdminRoute><SystemHealth /></SuperAdminRoute>} />
              <Route path="inquiries" element={<SuperAdminRoute><Inquiries /></SuperAdminRoute>} />
              <Route path="attendees" element={<Attendees />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="/scanner" element={
              <ScannerRoute>
                <ScannerApp />
              </ScannerRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;

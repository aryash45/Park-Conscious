/**
 * apps/admin/src/pages/Settings.jsx
 *
 * Purpose: Team and role management page for Super Admins.
 * Allows creation, assignment, and revocation of organizer accounts.
 * Includes tools for generating secure credentials and copying them.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Users, UserPlus, Trash2, Shield, Mail, Calendar, 
  Search, Filter, Plus, X, Check, ArrowRight,
  AlertCircle, RefreshCw, MoreVertical,
  Copy, CheckCircle
} from "lucide-react";
import { userService, eventService } from "../services/api";
import { useAuth } from '../hooks/useAuth';

const RoleBadge = ({ role }) => {
  const isSuper = role === 'superadmin';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
      isSuper 
        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
        : role === 'scanner'
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
    }`}>
      <Shield size={10} />
      {role || 'organizer'}
    </span>
  );
};

const Settings = () => {
  const { admin } = useAuth();
  const [organizers, setOrganizers] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "organizer",
    assignedEventIds: []
  });

  const isSuperAdmin = admin?.role === 'superadmin';

  const fetchRegistry = useCallback(async (force = false) => {
    if (force) setLoading(true);
    try {
      const { data } = await userService.getAll();
      setOrganizers(data || []);
      const eventsData = await eventService.getAll();
      setAllEvents(eventsData.data || []);
    } catch (e) {
      console.error("Failed to fetch registry", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      Promise.resolve().then(() => fetchRegistry());
    }
  }, [isSuperAdmin, fetchRegistry]);

  const handleCreate = async (e) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    try {
      await userService.create(form);
      setIsModalOpen(false);
      setForm({ name: "", email: "", password: "", role: "organizer", assignedEventIds: [] });
      fetchRegistry();
    } catch (e) {
      alert(e.response?.data?.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Terminate this organizer access? This action is irreversible.")) return;
    try {
      await userService.delete(id);
      fetchRegistry();
    } catch (error) {
      console.error("Terminate failed:", error);
      alert("Deactivation failed");
    }
  };

  const toggleEventSelect = (eventId) => {
    setForm(prev => ({
      ...prev,
      assignedEventIds: prev.assignedEventIds.includes(eventId)
        ? prev.assignedEventIds.filter(id => id !== eventId)
        : [...prev.assignedEventIds, eventId]
    }));
  };

  const generatePassword = () => {
    const pass = Math.random().toString(36).slice(-10);
    setForm(prev => ({ ...prev, password: pass }));
  };

  const copyCredentials = () => {
    const text = `BACKSTAGE Portal Access\nEmail: ${form.email}\nPassword: ${form.password}\nPortal: admin.events.parkconscious.in`;
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (!isSuperAdmin) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in duration-700">
        <div className="w-24 h-24 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-2xl shadow-rose-500/10">
          <AlertCircle size={48} className="text-rose-500" />
        </div>
        <div className="max-w-md">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Access Restricted</h2>
          <p className="mt-2 text-slate-500 text-sm font-medium leading-relaxed">
            System configuration and team protocols are locked. Please contact a Super Administrator to modify organizational permissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-sky-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">
            <Shield size={12} /> Team Management
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase flex items-center gap-4">
            Team Settings
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage organizational access and assign partner credentials.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 shadow-xl shadow-sky-900/20"
        >
          <UserPlus size={16} /> Add Organizer
        </button>
      </div>

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-4">
          <RefreshCw className="text-sky-600 animate-spin" size={48} />
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Loading Team...</span>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <Users size={18} className="text-sky-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Team Members</h3>
                <p className="text-slate-500 text-[10px] font-medium uppercase tracking-widest mt-0.5">Manage platform access</p>
              </div>
            </div>
            <button onClick={() => fetchRegistry(true)} className="text-slate-500 hover:text-white transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-950/30 text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em] border-b border-slate-800">
                  <th className="px-8 py-5">Name</th>
                  <th className="px-8 py-5">Role</th>
                  <th className="px-8 py-5">Date Added</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {organizers.map((user) => (
                  <tr key={user._id} className="group hover:bg-slate-800/20 transition-all duration-300">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center group-hover:border-sky-500/50 transition-all">
                          <Users size={16} className="text-slate-500 group-hover:text-sky-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white uppercase tracking-tight">{user.name}</p>
                          <p className="text-[10px] font-medium text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-8 py-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-6 text-right">
                      {user.role !== 'superadmin' && (
                        <button
                          onClick={() => handleDelete(user._id)}
                          className="p-2.5 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Registration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="px-10 py-8 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-900/20">
                  <UserPlus size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter">Add Organizer</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Create a new organizer account</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Full Name</label>
                  <input
                    required
                    type="text"
                    placeholder="Enter name..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-sky-500/50 transition-all font-medium"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Email Address</label>
                  <input
                    required
                    type="email"
                    placeholder="Enter email..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-sky-500/50 transition-all font-medium"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Password</label>
                    <button type="button" onClick={generatePassword} className="text-[9px] font-bold text-sky-500 hover:text-white transition-colors uppercase">Generate</button>
                  </div>
                  <input
                    required
                    type="text"
                    placeholder="Create password..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-sky-500/50 transition-all font-medium"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Account Role</label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-sky-500/50 transition-all font-medium appearance-none"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="organizer">Organizer</option>
                    <option value="scanner">Ticket Scanner</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>
              </div>

              {/* Experience Assignment */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Assigned Experiences</label>
                  <div className="text-[10px] font-black text-sky-500 uppercase tracking-widest">{form.assignedEventIds.length} Selected</div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                  <div className="grid grid-cols-1 gap-2">
                    {allEvents.map(event => (
                      <div 
                        key={event._id}
                        onClick={() => toggleEventSelect(event._id)}
                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all ${
                          form.assignedEventIds.includes(event._id)
                            ? 'bg-sky-600/10 border-sky-500/40 text-white shadow-lg shadow-sky-900/10'
                            : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Calendar size={14} className={form.assignedEventIds.includes(event._id) ? 'text-sky-500' : 'text-slate-700'} />
                          <span className="text-xs font-bold uppercase tracking-tight truncate max-w-[280px]">{event.title}</span>
                        </div>
                        {form.assignedEventIds.includes(event._id) && <Check size={16} className="text-sky-500" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6 flex flex-col gap-4">
                <button
                  type="submit"
                  disabled={submitting || !form.name || !form.email || !form.password}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black text-[10px] uppercase tracking-[0.2em] py-5 rounded-2xl transition-all shadow-xl shadow-sky-900/20 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {submitting ? <RefreshCw size={20} className="animate-spin" /> : <Shield size={20} />}
                  Create Account
                </button>
                
                {form.email && form.password && (
                  <button 
                    type="button"
                    onClick={copyCredentials}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-[10px] uppercase tracking-widest py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {copySuccess ? <CheckCircle size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    {copySuccess ? 'Copied to Clipboard' : 'Copy Login Credentials'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Settings;

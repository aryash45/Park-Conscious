/**
 * apps/admin/src/pages/Events.jsx
 *
 * Purpose: Event repository and management page for the Admin Panel.
 * Lists all events (both draft and published) with search and filter capabilities.
 * Allows creating, editing, and archiving events.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Search, Filter, Edit2, Trash2, Calendar, 
  Tag, ChevronRight, MapPin, Activity, 
  Archive, FileEdit, ExternalLink, RefreshCw
} from 'lucide-react';
import { eventService } from '../services/api';
import { normalizeApiUrl } from '../utils/apiUtils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import { Globe, Link2, IndianRupee } from 'lucide-react';

const EventStatusBadge = ({ status }) => {
  const styles = {
    draft:     'bg-zinc-500/5 text-zinc-500 border-zinc-500/10',
    published: 'bg-emerald-500/5 text-emerald-500 border-emerald-500/10',
    cancelled: 'bg-red-500/5 text-red-500 border-red-500/10'
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border ${styles[status?.toLowerCase()] || styles.draft}`}>
      {status || 'Draft'}
    </span>
  );
};

const Events = () => {
  const { admin } = useAuth();
  const isSuperAdmin = admin?.role === 'superadmin';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const navigate = useNavigate();

  const fetchEvents = useCallback(async (force = false) => {
    if (force) setLoading(true);
    try {
      const { data } = await eventService.getAll();
      setEvents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch events', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    Promise.resolve().then(() => fetchEvents());
  }, [fetchEvents]);

  const handleDelete = async (id) => {
    if (window.confirm('Archive this experience record?')) {
      try {
        await eventService.delete(id);
        fetchEvents(true);
      } catch (error) {
        console.error('Delete failed', error);
      }
    }
  };

  const [copiedId, setCopiedId] = useState(null);
  const handleCopyLink = (event) => {
    const EVENTS_BASE = import.meta.env.VITE_EVENTS_APP_URL || "https://events.parkconscious.in";
    const urlId = event.slug || event._id;
    const url = `${EVENTS_BASE}/event/${urlId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(event._id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePromotePayment = async (event) => {
    let API_BASE = normalizeApiUrl(import.meta.env.VITE_API_URL);
    setLoading(true);
    try {
      const { data: orderData } = await axios.post(`${API_BASE}/api/events/promote/order`, {
        eventId: event._id
      }, { withCredentials: true });

      if (!orderData.success) throw new Error(orderData.message);

      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: "INR",
        name: "Backstage Promotion",
        description: `Promote "${event.title}" to Homepage`,
        order_id: orderData.orderId,
        handler: async (response) => {
          try {
            const { data: verifyData } = await axios.post(`${API_BASE}/api/events/promote/verify`, {
              ...response,
              eventId: event._id
            }, { withCredentials: true });

            if (verifyData.success) {
              alert("Payment Successful! Event promoted to homepage.");
              fetchEvents(true);
            }
          } catch (err) {
            alert("Verification Failed: " + (err.response?.data?.message || err.message));
          }
        },
        prefill: { 
          email: admin?.email || "",
          contact: admin?.phone || admin?.contact || ""
        },
        theme: { color: "#6366f1" }
      };

      if (!window.Razorpay) {
        alert("Razorpay SDK not loaded. Please refresh the page.");
        return;
      }

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert("Payment Initialization Failed: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (event) => {
    try {
      await eventService.update(event._id, { isPublic: !event.isPublic });
      fetchEvents(true);
    } catch (_) {
      alert("Failed to update visibility");
    }
  };

  const filteredEvents = events.filter(event => {
    const safeTitle = (event.title || event.name || '').toLowerCase();
    const safeLocation = (event.location?.name || event.venue || '').toLowerCase();
    const matchesSearch = safeTitle.includes(searchTerm.toLowerCase()) || safeLocation.includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || event.status?.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-[9px] font-bold uppercase tracking-[0.3em] mb-2">
            <Activity size={10} /> Events Overview
          </div>
          <h1 className="text-3xl font-black text-zinc-100 tracking-tight uppercase flex items-center gap-3">
            Events
          </h1>
          <p className="text-zinc-600 text-xs font-medium mt-1">
            {isSuperAdmin ? 'Manage all platform events.' : 'Active management of assigned experiences.'}
          </p>
        </div>
        <button 
          onClick={() => navigate('/events/create')}
          className="bg-sky-500 hover:bg-sky-400 text-zinc-950 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 shadow-xl shadow-sky-900/10 active:scale-[0.98]"
        >
          <Plus size={16} /> Create Event
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 glass-card rounded-2xl">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" size={14} />
          <input 
            type="text" 
            placeholder="Search Events or Venues..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/[0.02] border border-white/[0.03] text-zinc-200 pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-sky-500/20 transition-all font-mono text-[10px] uppercase tracking-widest"
          />
        </div>
        <select 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-white/[0.02] border border-white/[0.03] text-zinc-500 px-4 py-3 rounded-xl focus:outline-none text-[10px] font-bold uppercase tracking-[0.2em] cursor-pointer hover:bg-white/[0.04] transition-all"
        >
          <option value="all">Any Status</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Repository Table */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden">
        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-4">
            <RefreshCw className="text-sky-500/50 animate-spin" size={32} />
            <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-[0.3em]">Loading Events...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-32 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-800">
              <Archive size={24} />
            </div>
            <div className="max-w-xs">
              <p className="text-xs font-bold text-zinc-600 uppercase tracking-tight">No Events Found</p>
              <p className="text-[9px] text-zinc-800 font-bold uppercase tracking-widest mt-2 leading-relaxed">
                Try adjusting your search filters or create a new event.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] text-zinc-700 font-bold uppercase tracking-[0.2em] border-b border-white/[0.02]">
                  <th className="px-8 py-5">Event Details</th>
                  <th className="px-8 py-5">Date & Location</th>
                  <th className="px-8 py-5">Visibility</th>
                  <th className="px-8 py-5 text-right w-32 px-12">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {filteredEvents.map((event) => (
                  <tr key={event._id} className="group hover:bg-white/[0.01] transition-all duration-300">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-5">
                        <div className="relative w-12 h-12 rounded-[1rem] overflow-hidden border border-white/[0.05] group-hover:border-sky-500/20 transition-all shadow-xl">
                          <img 
                            src={(event.images && event.images[0]) || event.image || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14'} 
                            className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" 
                            alt="" 
                          />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-200 uppercase tracking-tight group-hover:text-white transition-colors leading-none mb-1.5">{event.title || 'Untitled'}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] font-bold text-sky-400/90 font-outfit uppercase tracking-widest">₹{event.price || 0}</span>
                            <EventStatusBadge status={event.status} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-zinc-600 text-[9px] font-bold uppercase tracking-widest leading-none">
                          <Calendar size={10} className="text-zinc-700" />
                          <span>{event.date ? new Date(event.date).toLocaleDateString() : 'TBA'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-500 text-[9px] font-bold uppercase tracking-widest leading-none">
                          <MapPin size={10} className="text-zinc-700" /> 
                          <span className="truncate max-w-[160px]">{event.location?.name || event.venue || 'TBA'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${event.isPublic ? 'bg-sky-500/5 border-sky-500/20 text-sky-500' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                           <Globe size={12} />
                           <span className="text-[9px] font-black uppercase tracking-widest">{event.isPublic ? 'Public' : 'Unlisted'}</span>
                        </div>
                        
                        {/* Copy Link Button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopyLink(event); }}
                          className={`p-2 rounded-xl border transition-all flex items-center gap-2 ${copiedId === event._id ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10 hover:text-white'}`}
                        >
                          <Link2 size={12} />
                          {copiedId === event._id && <span className="text-[8px] font-black uppercase tracking-widest">Copied</span>}
                        </button>

                        {/* Promote Button (Non-SuperAdmin or Non-Paid) */}
                        {!event.isPublic && !event.listingPaid && !isSuperAdmin && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePromotePayment(event); }}
                            className="bg-sky-500 hover:bg-sky-400 text-zinc-950 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                          >
                            <IndianRupee size={10} /> Promote
                          </button>
                        )}

                        {/* SuperAdmin Toggle */}
                        {isSuperAdmin && (
                           <button
                             onClick={(e) => { e.stopPropagation(); handleToggleVisibility(event); }}
                             className="p-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-sky-400 hover:border-sky-500/30 transition-all"
                             title="Toggle Public Visibility"
                           >
                             <RefreshCw size={12} className={event.isPublic ? 'text-sky-500' : ''} />
                           </button>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right px-12">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => navigate(`/events/edit/${event._id}`)}
                          className="p-2.5 text-zinc-700 hover:text-sky-400 hover:bg-sky-400/5 rounded-xl transition-all"
                        >
                          <FileEdit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(event._id)}
                          className="p-2.5 text-zinc-700 hover:text-red-500 hover:bg-red-500/5 rounded-xl transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Events;

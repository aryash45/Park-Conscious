/**
 * apps/admin/src/pages/Attendees.jsx
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, Search, Filter, Download, CheckCircle, Clock, 
  RefreshCw, Trash2, Activity, ArrowUpRight, 
  ExternalLink, FileText, Smartphone, Monitor, Globe, User as UserIcon,
  Briefcase, Mail, MailCheck, MailX
} from 'lucide-react';
import { bookingService } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const StatusBadge = ({ attended, onToggle, loading }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onToggle(); }}
    disabled={loading}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
    attended 
      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
  } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white/10 active:scale-95'}`}>
    {loading ? <RefreshCw size={10} className="animate-spin" /> : attended ? <CheckCircle size={10} /> : <Clock size={10} />}
    {attended ? 'Verified' : 'Pending'}
  </button>
);

const Attendees = () => {
  const { admin } = useAuth();
  const isSuperAdmin = admin?.role === 'superadmin';

  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [toggleLoading, setToggleLoading] = useState(null);
  const [selectedAttendee, setSelectedAttendee] = useState(null);

  const fetchData = useCallback(async (force = false) => {
    if (force) setLoading(true);
    try {
      const { data } = await bookingService.getAllAttendees();
      setAttendees(data || []);
    } catch (err) {
      console.error('Failed to fetch attendees:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await bookingService.getAllAttendees();
        if (active) setAttendees(data || []);
      } catch (err) {
        console.error('Init fetch failed:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  // Handle Body Scroll Lock when modal is open
  useEffect(() => {
    if (selectedAttendee) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedAttendee]);

  const filteredData = useMemo(() => {
    if (!Array.isArray(attendees)) return [];
    return attendees.filter(item => {
      const matchesSearch = 
        (item.user?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.user?.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.ticketId || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'attended' && item.attended) || (statusFilter === 'pending' && !item.attended);
      const matchesEvent = eventFilter === 'all' || item.event?.title === eventFilter;
      return matchesSearch && matchesStatus && matchesEvent;
    });
  }, [attendees, searchQuery, statusFilter, eventFilter]);

  const handleToggleAttendance = async (item) => {
    if (toggleLoading) return;
    setToggleLoading(item.ticketId);
    try {
      if (item.attended) await bookingService.unCheckIn(item.ticketId);
      else await bookingService.checkIn(item.ticketId);
      setAttendees(prev => prev.map(a => a._id === item._id ? { ...a, attended: !a.attended } : a));
      if (selectedAttendee?._id === item._id) setSelectedAttendee(prev => ({ ...prev, attended: !prev.attended }));
    } catch (err) {
      console.error("Toggle failed:", err);
    } finally {
      setToggleLoading(null);
    }
  };

  const handleDeleteBooking = async (id) => {
    if (!window.confirm("CONFIRM DELETION: This action is permanent. Guest ticket will be invalidated.")) return;
    try {
      await bookingService.deleteBooking(id);
      setAttendees(prev => prev.filter(a => a._id !== id));
      if (selectedAttendee?._id === id) setSelectedAttendee(null);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`CONFIRM BULK DELETION: You are about to permanently delete ${selectedIds.length} attendees. This action cannot be undone.`)) return;
    
    setToggleLoading('bulk-delete');
    try {
      const results = await Promise.allSettled(
        selectedIds.map(id => bookingService.deleteBooking(id).then(() => id))
      );
      
      const successfulIds = results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);

      if (successfulIds.length > 0) {
        setAttendees(prev => prev.filter(a => !successfulIds.includes(a._id)));
        if (selectedAttendee && successfulIds.includes(selectedAttendee._id)) setSelectedAttendee(null);
        setSelectedIds(prev => prev.filter(id => !successfulIds.includes(id)));
      }

      if (successfulIds.length < selectedIds.length) {
        alert(`Deleted ${successfulIds.length} attendees. Some deletions failed. Please refresh.`);
        fetchData();
      }
    } catch (err) {
      console.error("Bulk delete critical error:", err);
      alert("A critical error occurred. Please refresh and check.");
      fetchData();
    } finally {
      setToggleLoading(null);
    }
  };

  const handleDispatchEmails = async (bookingIds) => {
    if (!bookingIds || bookingIds.length === 0) return;
    const confirmMsg = bookingIds.length === 1 
      ? "Dispatch ticket email to this guest?" 
      : `Broadcast tickets to ${bookingIds.length} guests in the current pool?`;
    
    if (!window.confirm(confirmMsg)) return;

    setToggleLoading(bookingIds.length === 1 ? 'dispatch-' + bookingIds[0] : 'bulk-dispatch');
    try {
      await bookingService.broadcastEmails(bookingIds);
      alert(bookingIds.length === 1 ? "Ticket dispatched successfully!" : "Bulk broadcast initiated.");
      
      // Update local state if needed (though emailSent is managed by backend)
      if (bookingIds.length === 1) {
        setAttendees(prev => prev.map(a => a._id === bookingIds[0] ? { ...a, emailSent: true } : a));
        if (selectedAttendee?._id === bookingIds[0]) setSelectedAttendee(prev => ({ ...prev, emailSent: true }));
      } else {
        fetchData();
      }
    } catch (err) {
      console.error("Dispatch failed:", err);
      alert("Dispatch protocol failed. Check logs.");
    } finally {
      setToggleLoading(null);
      if (bookingIds.length > 1) setSelectedIds([]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length && filteredData.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map(a => a._id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };


  const handleExportCSV = () => {
    if (!filteredData || filteredData.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = ['Name', 'Email', 'Event', 'Ticket ID', 'Status', 'Email Sent'];
    
    // Dynamically find all unique custom fields across the filtered set
    const customFieldKeys = new Set();
    filteredData.forEach(item => {
      if (item.customData) {
        Object.keys(item.customData).forEach(key => {
          if (key !== 'registrationType') {
            // Try to find the human readable label if available
            const field = item.event?.customForms?.find(f => String(f.id) === String(key));
            customFieldKeys.add(field ? field.label : key);
          }
        });
      }
    });
    
    const customFieldsArray = Array.from(customFieldKeys);
    const allHeaders = [...headers, ...customFieldsArray];

    const rows = filteredData.map(item => {
      const baseRow = [
        `"${String(item.user?.name || 'Guest').replace(/"/g, '""')}"`,
        `"${String(item.user?.email || item.email || '').replace(/"/g, '""')}"`,
        `"${String(item.event?.title || '').replace(/"/g, '""')}"`,
        `"${String(item.ticketId || '').replace(/"/g, '""')}"`,
        item.attended ? 'Verified' : 'Pending',
        item.emailSent ? 'Yes' : 'No'
      ];
      
      const customRow = customFieldsArray.map(headerKey => {
        // Find the matching key in customData by checking the label
        let val = '';
        if (item.customData) {
           for (const [k, v] of Object.entries(item.customData)) {
              const field = item.event?.customForms?.find(f => String(f.id) === String(k));
              const label = field ? field.label : k;
              if (label === headerKey) {
                 val = v;
                 break;
              }
           }
        }
        return `"${String(val || '').replace(/"/g, '""')}"`;
      });
      
      return [...baseRow, ...customRow].join(',');
    });

    const csvContent = [allHeaders.map(h => `"${h}"`).join(','), ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `nexus_registry_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen space-y-12 animate-in fade-in duration-1000 pb-20">
      {/* Header Area */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-10 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-[10px] font-black uppercase tracking-[0.4em] mb-3">
            <Activity size={12} strokeWidth={3} /> Registry Management
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase leading-none">
            Attendee <span className="text-zinc-600">Dossier</span>
          </h1>
          <p className="text-zinc-500 text-sm font-medium mt-4 max-w-xl leading-relaxed uppercase tracking-widest text-[10px]">
            {isSuperAdmin ? `Verifying ${attendees.length} identities in cluster.` : `Managing assigned guest protocols.`}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
           <button onClick={() => fetchData(true)} className="p-4 bg-zinc-900/50 border border-white/5 text-zinc-500 hover:text-white rounded-[1.5rem] transition-all">
             <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
           </button>
           <button 
             onClick={() => handleDispatchEmails(filteredData.filter(a => !a.emailSent).map(a => a._id))}
             disabled={toggleLoading === 'bulk-dispatch' || filteredData.filter(a => !a.emailSent).length === 0}
             className="bg-zinc-900/50 hover:bg-white/5 border border-white/5 text-white px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.25em] transition-all flex items-center gap-3 disabled:opacity-50"
           >
             {toggleLoading === 'bulk-dispatch' ? <RefreshCw size={16} className="animate-spin" /> : <Mail size={16} />} 
             Dispatch Pending ({filteredData.filter(a => !a.emailSent).length})
           </button>

           {selectedIds.length > 0 && (
             <div className="flex items-center gap-3 animate-in zoom-in-95 duration-300">
               <button 
                 onClick={() => handleDispatchEmails(selectedIds)} 
                 disabled={toggleLoading === 'bulk-dispatch' || toggleLoading === 'bulk-delete'}
                 className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.25em] transition-all flex items-center gap-3 shadow-lg shadow-emerald-500/20"
               >
                 <CheckCircle size={16} /> Dispatch ({selectedIds.length})
               </button>
               <button 
                 onClick={handleBulkDelete} 
                 disabled={toggleLoading === 'bulk-dispatch' || toggleLoading === 'bulk-delete'}
                 className="bg-rose-500 hover:bg-rose-400 text-zinc-950 px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.25em] transition-all flex items-center gap-3 shadow-lg shadow-rose-500/20"
               >
                 {toggleLoading === 'bulk-delete' ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete ({selectedIds.length})
               </button>
             </div>
           )}
           <button onClick={handleExportCSV} className="bg-sky-500 hover:bg-sky-400 text-zinc-950 px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.25em] transition-all flex items-center gap-3 shadow-xl">
             <Download size={16} strokeWidth={3} /> Export Master List
           </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 animate-in slide-in-from-bottom-4 duration-700 delay-150">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-sky-400 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search Identity, Email, or Token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/50 transition-all shadow-inner"
          />
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-900/50 border border-white/5 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 focus:outline-none focus:border-sky-500/50 appearance-none cursor-pointer pr-12 min-w-[160px]"
            >
              <option value="all">All Status</option>
              <option value="attended">Verified</option>
              <option value="pending">Pending</option>
            </select>
            <Filter className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" size={14} />
          </div>
          <div className="relative">
            <select 
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="bg-zinc-900/50 border border-white/5 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 focus:outline-none focus:border-sky-500/50 appearance-none cursor-pointer pr-12 min-w-[200px]"
            >
              <option value="all">All Events</option>
              {[...new Set(attendees.map(a => a.event?.title))].filter(Boolean).map(title => (
                <option key={title} value={title}>{title}</option>
              ))}
            </select>
            <Activity className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" size={14} />
          </div>
        </div>
      </div>

      {/* Main Registry Table */}
      <div className="bg-zinc-900/30 border border-white/5 rounded-[3rem] overflow-hidden">
        {loading ? (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-6">
            <RefreshCw className="text-sky-500 animate-spin" size={48} />
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.5em]">Fetching Metadata...</span>
          </div>
        ) : filteredData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.3em] border-b border-white/5">
                  <th className="px-10 py-6 w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length === filteredData.length && filteredData.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-white/10 bg-zinc-900/50 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer transition-all"
                    />
                  </th>
                  <th className="px-10 py-6">Identity Profile</th>
                  <th className="px-10 py-6">Verification Protocol</th>
                  <th className="px-10 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredData.map((item) => (
                  <tr key={item._id} className="group hover:bg-white/[0.02] transition-all cursor-pointer" onClick={() => setSelectedAttendee(item)}>
                    <td className="px-10 py-8 w-10" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(item._id)}
                        onChange={() => toggleSelect(item._id)}
                        className="w-4 h-4 rounded border-white/10 bg-zinc-900/50 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer transition-all"
                      />
                    </td>
                    <td className="px-10 py-8">
                       <div className="flex items-center gap-6">
                          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center group-hover:border-sky-500 transition-all">
                             <UserIcon size={20} className="text-zinc-600 group-hover:text-sky-400" />
                          </div>
                          <div className="space-y-1.5">
                             <div className="flex items-center gap-3">
                                <p className="text-[15px] font-black text-white tracking-tight group-hover:text-sky-400 transition-colors">{item.user?.name || 'Nexus Guest'}</p>
                                {item.customData?.registrationType === 'startup' && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black uppercase text-emerald-400 tracking-widest">Founder</span>
                                )}
                             </div>
                             <p className="text-[11px] font-medium text-zinc-600 font-mono tracking-tighter">{item.user?.email || item.email}</p>
                          </div>
                       </div>
                    </td>
                    <td className="px-10 py-8">
                       <div className="flex flex-col gap-2 items-start">
                          <StatusBadge 
                            attended={item.attended} 
                            onToggle={() => handleToggleAttendance(item)}
                            loading={toggleLoading === item.ticketId}
                          />
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${
                            item.emailSent 
                              ? 'text-sky-400 bg-sky-500/10 border border-sky-500/20'
                              : 'text-zinc-500 bg-zinc-500/10 border border-zinc-500/20'
                          }`}>
                            {item.emailSent ? <MailCheck size={10} /> : <MailX size={10} />}
                            {item.emailSent ? 'Ticket Sent' : 'Mail Pending'}
                          </div>
                       </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleDeleteBooking(item._id); }}
                         className="p-3 text-zinc-700 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                       >
                         <Trash2 size={16} />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-96 flex flex-col items-center justify-center text-center p-20">
             <h3 className="text-xl font-black text-zinc-800 uppercase tracking-tighter">Identity Pool Empty</h3>
          </div>
        )}
      </div>

      {/* --- DOSSIER OVERLAY MODAL --- */}
      {selectedAttendee && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-8">
          {/* Overlay Backdrop - onClick to close */}
          <div 
            className="absolute inset-0 bg-[#050508]/90 backdrop-blur-md animate-in fade-in duration-300" 
            onClick={() => setSelectedAttendee(null)} 
          />
          
          {/* Modal Container */}
          <div className="w-[95vw] lg:w-[90vw] max-w-6xl h-[90vh] bg-[#0c0c0e] border border-white/10 rounded-[2rem] overflow-hidden relative z-10 flex flex-col md:flex-row shadow-2xl animate-in zoom-in-95 duration-300">
            
            {/* LEFT: IDENTITY PANEL */}
            <div className="w-full md:w-[350px] bg-zinc-900/30 p-8 border-r border-white/5 flex flex-col">
               <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
                  <div className="w-20 h-20 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                     <UserIcon size={36} strokeWidth={2.5} />
                  </div>
                  <div>
                     <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedAttendee.user?.name || 'Guest'}</h2>
                     <p className="text-xs font-medium text-sky-500/60 font-mono tracking-tighter mt-1">{selectedAttendee.user?.email || selectedAttendee.email}</p>
                  </div>
                  <div className="space-y-6 pt-6 border-t border-white/5">
                     <div>
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Entry Token</p>
                        <p className="text-xl font-black text-white tracking-widest">{selectedAttendee.ticketId}</p>
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Check-in Status</p>
                        <StatusBadge 
                          attended={selectedAttendee.attended} 
                          onToggle={() => handleToggleAttendance(selectedAttendee)}
                          loading={toggleLoading === selectedAttendee.ticketId}
                        />
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Comms Protocol</p>
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          selectedAttendee.emailSent 
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                        }`}>
                          {selectedAttendee.emailSent ? <MailCheck size={12} /> : <MailX size={12} />}
                          {selectedAttendee.emailSent ? 'Token Dispatched' : 'Pending Dispatch'}
                        </div>
                     </div>
                  </div>
               </div>
               <div className="space-y-3">
                  <button 
                    onClick={() => handleDispatchEmails([selectedAttendee._id])}
                    disabled={toggleLoading === 'dispatch-' + selectedAttendee._id}
                    className="w-full py-4 bg-sky-500 hover:bg-sky-400 text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    {toggleLoading === 'dispatch-' + selectedAttendee._id ? <RefreshCw size={14} className="animate-spin" /> : <Mail size={14} />}
                    Dispatch Gate Token
                  </button>
                  <button 
                    onClick={() => setSelectedAttendee(null)}
                    className="w-full py-4 bg-zinc-800 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:text-white transition-all"
                  >
                    Close Identity File
                  </button>
               </div>
            </div>

            {/* RIGHT: TELEMETRY MATRIX */}
            <div className="flex-1 flex flex-col min-h-0 bg-black/40">
               <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Submission Telemetry</h3>
                  <div className="text-zinc-500">
                     {selectedAttendee.userAgent?.toLowerCase().includes('mobi') ? <Smartphone size={16} /> : <Monitor size={16} />}
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-6 md:px-8 md:py-6 space-y-6 custom-scrollbar">
                  {Object.entries(selectedAttendee.customData || {}).map(([id, value]) => {
                     if (id === 'registrationType') return null;
                     const field = selectedAttendee.event?.customForms?.find(f => String(f.id) === String(id));
                     const label = field ? field.label : id;
                     const isUrl = String(value).trim().startsWith('http');
                     const isError = String(value).toLowerCase().includes('upload failed');

                     return (
                       <div key={id} className="space-y-4">
                          <h4 className="text-[11px] font-black text-sky-400 uppercase tracking-widest ml-1">{label}</h4>

                          {isUrl && !isError ? (
                             <div className="space-y-4">
                                <a 
                                  href={value} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl hover:bg-zinc-800 transition-colors"
                                >
                                  <FileText size={16} className="text-sky-400" />
                                  <span className="text-xs font-bold text-white">Open Raw Asset</span>
                                  <ExternalLink size={14} className="text-zinc-500" />
                                </a>
                                
                                {/* NATIVE PDF PREVIEWER */}
                                <div className="rounded-xl overflow-hidden border border-white/10 h-[500px] bg-zinc-950 w-full relative">
                                  {/* Using <object> is highly reliable for PDFs */}
                                  <object 
                                    data={value} 
                                    type="application/pdf" 
                                    className="w-full h-full"
                                  >
                                    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                                      <p className="text-zinc-400 text-sm mb-4">Your browser does not support inline PDFs.</p>
                                      <a href={value} target="_blank" rel="noreferrer" className="text-sky-400 underline">Click here to download the PDF</a>
                                    </div>
                                  </object>
                                </div>
                             </div>
                          ) : (
                             <div className={`p-6 rounded-xl border ${isError ? 'bg-rose-500/10 border-rose-500/20' : 'bg-white/[0.02] border-white/5'}`}>
                                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isError ? 'text-rose-400 font-mono' : 'text-zinc-200'}`}>
                                   {String(value)}
                                </p>
                             </div>
                          )}
                       </div>
                     );
                  })}
                  
                  {(!selectedAttendee.customData || Object.keys(selectedAttendee.customData).length <= 1) && (
                    <div className="h-40 flex flex-col items-center justify-center text-center opacity-30">
                       <Briefcase size={40} className="mb-4" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No custom data</p>
                    </div>
                  )}
               </div>
            </div>
            
          </div>
        </div>
      )}

      {/* GLOBAL SCROLLBAR STYLING */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
      `}} />
    </div>
  );
};

export default Attendees;

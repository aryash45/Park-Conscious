/**
 * apps/admin/src/pages/SystemHealth.jsx
 *
 * Purpose: Centralized diagnostic and error monitoring dashboard.
 * Displays system logs, crashes, and API failures collected from both
 * the Admin Panel and public Events application.
 * Allows resolving issues and viewing detailed stack traces.
 */
import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, CheckCircle2, AlertTriangle, Clock, Globe, Terminal, RefreshCw, Search, ChevronRight, Check, X, Shield, BarChart, Server } from 'lucide-react';
import { adminService } from '../services/api';

const StatsCard = ({ title, value, icon: Icon, color = 'sky' }) => {
  const colors = {
    sky:     'text-sky-400 bg-sky-500/5 border-sky-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10',
    rose:    'text-rose-400 bg-rose-500/5 border-rose-500/10',
    amber:   'text-amber-400 bg-amber-500/5 border-amber-500/10',
  };

  return (
    <div className="glass-card rounded-[2rem] p-7 group cursor-default">
      <div className="flex justify-between items-start mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500 group-hover:scale-110 group-hover:bg-white/5 ${colors[color]}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">{title}</p>
        <h3 className="text-3xl font-bold font-outfit text-zinc-100 tracking-tight">{value}</h3>
      </div>
    </div>
  );
};

const SystemHealth = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); 
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedLog, setExpandedLog] = useState(null);

    const fetchLogs = async () => {
        try {
            const { data } = await adminService.getLogs();
            setLogs(data);
        } catch (_err) {
            console.error('Failed to fetch logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const loadInitialLogs = async () => {
            try {
                const { data } = await adminService.getLogs();
                if (isMounted) {
                    setLogs(data);
                    setLoading(false);
                }
            } catch (_err) {
                if (isMounted) setLoading(false);
            }
        };
        loadInitialLogs();
        return () => { isMounted = false; };
    }, []);

    const toggleResolve = async (id, currentStatus) => {
        try {
            await adminService.resolveLog(id, !currentStatus);
            setLogs(logs.map(log => log._id === id ? { ...log, resolved: !currentStatus } : log));
        } catch (_err) {
            alert('Failed to update log status');
        }
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.message?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             log.source?.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (filter === 'unresolved') return !log.resolved && matchesSearch;
        if (filter === 'admin' || filter === 'events' || filter === 'web') return log.source === filter && matchesSearch;
        return matchesSearch;
    });

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Standard Admin Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-sky-400 text-[9px] font-bold uppercase tracking-[0.3em] mb-2">
                        <Activity size={10} /> System Diagnostics
                    </div>
                    <h1 className="text-3xl font-black text-zinc-100 tracking-tight uppercase">Health Monitor</h1>
                    <p className="text-zinc-600 text-xs font-medium mt-1">Audit ecosystem crashes and API failures across all platforms.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-zinc-900/40 border border-white/5 p-1 rounded-xl">
                        {['all', 'unresolved'].map(f => (
                            <button
                                key={f}
                                onClick={() => { setLoading(true); setFilter(f); fetchLogs(); }}
                                className={`px-5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${filter === f ? 'bg-sky-500 text-[#050508]' : 'text-zinc-500 hover:text-zinc-200'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={() => { setLoading(true); fetchLogs(); }}
                        className="bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 text-zinc-500 hover:text-zinc-200 p-2.5 rounded-xl transition-all active:scale-95"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard 
                    title="Active Alerts" 
                    value={logs.filter(l => !l.resolved).length} 
                    icon={AlertTriangle} 
                    color="rose" 
                />
                <StatsCard 
                    title="Resolved Today" 
                    value={logs.filter(l => l.resolved && new Date(l.createdAt).toDateString() === new Date().toDateString()).length} 
                    icon={CheckCircle2} 
                    color="emerald" 
                />
                <StatsCard 
                    title="Platform Load" 
                    value="Stable" 
                    icon={Server} 
                    color="sky" 
                />
                <StatsCard 
                    title="Log Retention" 
                    value="Last 200" 
                    icon={Terminal} 
                    color="amber" 
                />
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-800 group-focus-within:text-sky-500 transition-colors" size={14} />
                    <input 
                        type="text" 
                        placeholder="FILTER LOGS..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/[0.02] border border-white/5 text-zinc-100 placeholder:text-zinc-800 rounded-xl px-12 py-3.5 font-mono text-[10px] focus:outline-none focus:border-sky-500/30 transition-all uppercase tracking-widest"
                    />
                </div>
                
                <div className="flex gap-2">
                    {['admin', 'events', 'web'].map(s => (
                        <button
                            key={s}
                            onClick={() => { setLoading(true); setFilter(filter === s ? 'all' : s); fetchLogs(); }}
                            className={`px-6 py-3.5 rounded-xl border transition-all text-[9px] font-bold uppercase tracking-widest flex items-center gap-3 ${filter === s ? 'bg-white/5 border-sky-500/30 text-sky-400' : 'bg-white/[0.02] border-white/5 text-zinc-600 hover:text-zinc-300'}`}
                        >
                            <div className={`w-1 h-1 rounded-full ${s === 'admin' ? 'bg-sky-500' : s === 'events' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Logs Table Style */}
            <div className="glass-card rounded-[2.5rem] overflow-hidden">
                <div className="px-8 py-7 border-b border-white/[0.02] flex items-center justify-between">
                    <div>
                        <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-[0.1em]">Recent System Logs</h3>
                        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Diagnostic Output Feed</p>
                    </div>
                </div>

                {loading ? (
                    <div className="p-24 flex flex-col items-center justify-center text-center space-y-4">
                        <RefreshCw className="text-sky-500/50 animate-spin" size={32} />
                        <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-[0.3em]">Querying Database...</span>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-24 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                        <CheckCircle2 size={32} />
                        <p className="text-xs font-bold text-zinc-600 uppercase tracking-tight">System Healthy</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[9px] text-zinc-700 font-bold uppercase tracking-[0.2em] border-b border-white/[0.02]">
                                    <th className="px-8 py-5">Source</th>
                                    <th className="px-8 py-5">Issue Message</th>
                                    <th className="px-8 py-5 text-center">Occurrences</th>
                                    <th className="px-8 py-5 text-center">Status</th>
                                    <th className="px-8 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.02]">
                                {filteredLogs.map((log) => (
                                    <React.Fragment key={log._id}>
                                        <tr className={`group hover:bg-white/[0.01] transition-all duration-300 ${log.resolved ? 'opacity-40' : ''}`}>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-7 h-7 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-[9px] font-bold uppercase ${log.source === 'admin' ? 'text-sky-400' : log.source === 'events' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                                        {log.source.charAt(0)}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{log.source}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="space-y-1">
                                                    <p className={`text-xs font-semibold tracking-tight ${log.resolved ? 'text-zinc-500 line-through' : 'text-zinc-200 group-hover:text-white'}`}>
                                                        {log.message}
                                                    </p>
                                                    <p className="text-[8px] text-zinc-700 font-mono uppercase truncate max-w-xs">Last seen: {new Date(log.lastSeenAt || log.createdAt).toLocaleString()}</p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[14px] font-black text-zinc-300 font-outfit">{log.count || 1}</span>
                                                    <span className="text-[7px] text-zinc-600 font-bold uppercase tracking-widest">Times</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${log.resolved ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                    {log.resolved ? 'Resolved' : 'Attention'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => setExpandedLog(expandedLog === log._id ? null : log._id)}
                                                        className="p-2 text-zinc-600 hover:text-sky-400 transition-colors"
                                                    >
                                                        <Terminal size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => toggleResolve(log._id, log.resolved)}
                                                        className={`p-2 transition-colors ${log.resolved ? 'text-zinc-800 hover:text-emerald-500' : 'text-zinc-600 hover:text-emerald-500'}`}
                                                    >
                                                        {log.resolved ? <RefreshCw size={14} /> : <Check size={14} />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedLog === log._id && (
                                            <tr className="bg-white/[0.01]">
                                                <td colSpan="4" className="px-8 py-10">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in slide-in-from-top-4">
                                                        <div className="space-y-6">
                                                            <h4 className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] border-b border-white/5 pb-3">Technical Context</h4>
                                                            <div className="space-y-3 font-mono text-[10px]">
                                                                <div className="flex justify-between border-b border-white/[0.01] pb-1.5">
                                                                    <span className="text-zinc-700">TRACE_ID</span>
                                                                    <span className="text-zinc-400">{log._id}</span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-white/[0.01] pb-1.5">
                                                                    <span className="text-zinc-700">TYPE</span>
                                                                    <span className="text-zinc-300 uppercase">{log.type}</span>
                                                                </div>
                                                                <div className="flex justify-between border-b border-white/[0.01] pb-1.5">
                                                                    <span className="text-zinc-700">DEDUPE_HASH</span>
                                                                    <span className="text-zinc-400 font-mono">{log.hash || 'N/A'}</span>
                                                                </div>
                                                                <div className="space-y-2 mt-4">
                                                                    <span className="text-zinc-700 block">METADATA_PAYLOAD</span>
                                                                    <div className="bg-black/20 p-4 rounded-xl border border-white/5 text-zinc-600 overflow-auto max-h-40">
                                                                        <pre>{JSON.stringify(log.metadata || {}, null, 4)}</pre>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-6">
                                                            <h4 className="text-[9px] font-bold text-rose-900/50 uppercase tracking-[0.2em] border-b border-white/5 pb-3">Stack Trace Output</h4>
                                                            <div className="bg-[#050508] border border-white/5 p-6 rounded-2xl font-mono text-[9px] text-zinc-700 overflow-auto max-h-80 leading-relaxed shadow-inner">
                                                                <pre className="whitespace-pre-wrap">
                                                                    {log.stack || 'NO STACK TRACE LOGGED FOR THIS ENTRY'}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SystemHealth;

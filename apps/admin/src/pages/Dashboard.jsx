/**
 * apps/admin/src/pages/Dashboard.jsx
 *
 * Purpose: Advanced Analytics Command Center for Organizers.
 * Displays real-time sales trends, ticket tier distribution, 
 * device telemetry, and geo-insights using Recharts.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Users, TrendingUp, Activity,
  IndianRupee, Ticket, QrCode, Maximize, CheckCircle,
  XCircle, RefreshCw, Smartphone, Monitor, Map,
  Globe, Zap, ArrowUpRight, ArrowDownRight, Layers
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, 
  Cell, BarChart, Bar, Legend 
} from 'recharts';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { adminService } from '../services/api';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

const CHART_COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const StatsCard = ({ title, value, icon, color = 'sky', trend, subtitle }) => {
  const Icon = icon;
  const colors = {
    sky:     'text-sky-400 bg-sky-500/10 border-sky-500/20 shadow-[0_0_20px_rgba(56,189,248,0.1)]',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]',
    amber:   'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)]',
    violet:  'text-violet-400 bg-violet-500/10 border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.1)]',
  };

  return (
    <Motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-[2.5rem] p-8 border border-white/5 hover:border-white/10 transition-all duration-500 group relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-white/[0.05] transition-all" />
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500 group-hover:rotate-6 ${colors[color]}`}>
            <Icon size={22} />
          </div>
          {trend && (
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${trend.includes('+') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
               {trend.includes('+') ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
               {trend}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-zinc-100 tracking-tighter uppercase">{value}</h3>
          </div>
          {subtitle && <p className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest mt-2">{subtitle}</p>}
        </div>
      </div>
    </Motion.div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0c0c0e] border border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-xl">
        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">{label}</p>
        <p className="text-lg font-black text-sky-400 uppercase tracking-tight">
          {payload[0].value} <span className="text-[10px] text-zinc-600 ml-1">Orders</span>
        </p>
      </div>
    );
  }
  return null;
};

const CheckInTool = () => {
  const [ticketInput, setTicketInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async () => {
    const id = ticketInput.trim().toUpperCase();
    if (!id) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post('/api/bookings/check-in', { ticketId: id });
      setResult({ success: true, message: data.message || 'Access Granted!' });
      setTicketInput('');
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Invalid Credential.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-[2.5rem] p-8 space-y-6 border border-white/5">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <Maximize size={18} className="text-sky-400" />
        </div>
        <div>
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Entry Protocol</h3>
          <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest mt-0.5">Rapid ID Verification</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={ticketInput}
          onChange={(e) => setTicketInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCheckIn()}
          placeholder="SCAN OR TYPE ID..."
          className="flex-1 bg-white/[0.02] border border-white/5 text-zinc-100 placeholder:text-zinc-800 rounded-xl px-5 py-4 font-mono text-[10px] focus:outline-none focus:border-sky-500/30 transition-all uppercase tracking-widest"
        />
        <button
          onClick={handleCheckIn}
          disabled={loading || !ticketInput.trim()}
          className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-[#050508] font-black text-[9px] uppercase tracking-[0.2em] px-6 rounded-xl transition-all flex items-center gap-2 active:scale-95"
        >
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <QrCode size={14} />}
          VERIFY
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <Motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border ${
            result.success
              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500'
              : 'bg-rose-500/5 border-rose-500/20 text-rose-500'
          }`}>
            {result.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {result.message}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Dashboard = () => {
  const { admin } = useAuth();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminService.getInsights();
      setInsights(data);
    } catch (e) {
      console.error('Insights fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await adminService.getInsights();
        if (active) setInsights(data);
      } catch (err) {
        console.error('Insights fetch failed:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  if (loading && !insights) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-6">
        <Motion.div 
          animate={{ rotate: 360 }} 
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 rounded-[2rem] border-4 border-sky-500/10 border-t-sky-500"
        />
        <div className="text-center">
           <h2 className="text-[12px] font-black text-white uppercase tracking-[0.4em] mb-2">Nexus Diagnostic</h2>
           <p className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest">Compiling Global Telemetry...</p>
        </div>
      </div>
    );
  }

  const { summary, charts, geoData, eventBreakdown } = insights || {};

  return (
    <div className="space-y-10 pb-20 max-w-[1600px] mx-auto">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <div className="flex items-center gap-3 text-sky-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse shadow-[0_0_10px_#0ea5e9]" />
            System Live
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">
            Nexus Dashboard
          </h1>
          <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest mt-4">
            Scoped Telemetry for <span className="text-zinc-200">{admin?.name}</span> • v4.0.1
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={fetchInsights}
            className="group w-14 h-14 rounded-3xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-500 hover:text-white hover:border-white/20 transition-all"
            title="Refresh Core"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'} />
          </button>
          <div className="px-8 py-4 bg-sky-500 rounded-3xl text-[#050508] font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-sky-500/20 cursor-default">
             Live Insights
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Revenue" 
          value={`₹${(summary?.totalRevenue || 0).toLocaleString('en-IN')}`} 
          icon={IndianRupee} 
          color="emerald" 
          trend="+14.2%"
          subtitle="Net Sales established"
        />
        <StatsCard 
          title="Conversion" 
          value={summary?.conversionRate} 
          icon={Zap} 
          color="sky" 
          trend="+5.1%"
          subtitle="Intent to Confirmed"
        />
        <StatsCard 
          title="Ticket Load" 
          value={summary?.totalSales} 
          icon={Ticket} 
          color="amber" 
          subtitle="Active credentials issued"
        />
        <StatsCard 
          title="Attendance" 
          value={summary?.totalAttended} 
          icon={Users} 
          color="violet" 
          subtitle="Validated entries at gate"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Sales Chart */}
        <Motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="xl:col-span-2 glass-card rounded-[3rem] p-10 border border-white/5"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Velocity Metrics</h3>
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-1">14-Day Sales Forecasting</p>
            </div>
            <div className="flex items-center gap-6">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-sky-500" />
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Confirmed Sales</span>
               </div>
            </div>
          </div>
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts?.salesOverTime}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#3f3f46', fontSize: 9, fontWeight: 700 }}
                  dy={10}
                  tickFormatter={(str) => {
                    const d = new Date(str);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#3f3f46', fontSize: 9, fontWeight: 700 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#38bdf8" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Motion.div>

        {/* Right Info Stack */}
        <div className="space-y-10">
           <CheckInTool />

           {/* Tier Distribution */}
           <Motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             className="glass-card rounded-[3rem] p-10 border border-white/5"
           >
              <h3 className="text-xs font-black text-white uppercase tracking-widest mb-8">Tier Distribution</h3>
              <div className="h-[200px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie
                          data={charts?.tierDistribution || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={8}
                          dataKey="value"
                          animationBegin={500}
                          animationDuration={1500}
                       >
                          {(charts?.tierDistribution || []).map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="none" />
                          ))}
                       </Pie>
                       <Tooltip 
                         contentStyle={{ backgroundColor: '#0c0c0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '9px', fontWeight: 'bold' }}
                         itemStyle={{ color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}
                       />
                    </PieChart>
                 </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                 {(charts?.tierDistribution || []).map((tier, i) => (
                    <div key={tier.name} className="flex items-center gap-3">
                       <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                       <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest truncate">{tier.name}</span>
                       <span className="text-[10px] font-black text-white ml-auto">{tier.value}</span>
                    </div>
                 ))}
              </div>
           </Motion.div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
         {/* Geo Insights */}
         <div className="glass-card rounded-[3rem] p-10 border border-white/5">
            <div className="flex items-center gap-3 mb-10">
               <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <Globe size={18} />
               </div>
               <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Geo Insights</h3>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Network Origin Top 5</p>
               </div>
            </div>
            <div className="space-y-6">
               {geoData?.map((item, i) => (
                  <div key={item.region} className="space-y-2">
                     <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-zinc-500">{item.region}</span>
                        <span className="text-white">{item.count}</span>
                     </div>
                     <div className="h-1.5 w-full bg-white/[0.02] rounded-full overflow-hidden">
                        <Motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(item.count / (geoData[0]?.count || 1)) * 100}%` }}
                          transition={{ duration: 1, delay: i * 0.1 }}
                          className="h-full bg-emerald-500/40 rounded-full"
                        />
                     </div>
                  </div>
               ))}
               {(!geoData || geoData.length === 0) && (
                 <div className="py-10 text-center opacity-20">
                    <Map className="mx-auto mb-2" size={24} />
                    <p className="text-[9px] font-black uppercase tracking-widest">Insufficient Geo-Data</p>
                 </div>
               )}
            </div>
         </div>

         {/* Device Insights */}
         <div className="glass-card rounded-[3rem] p-10 border border-white/5">
            <div className="flex items-center gap-3 mb-10">
               <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-500">
                  <Smartphone size={18} />
               </div>
               <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Device Load</h3>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">User Agent Distribution</p>
               </div>
            </div>
            <div className="space-y-8">
               {charts?.deviceBreakdown.map((device) => (
                  <div key={device.name} className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/[0.04] rounded-[2rem] hover:bg-white/[0.04] transition-all">
                     <div className="flex items-center gap-4">
                        <div className="text-zinc-500">
                           {device.name === 'mobile' ? <Smartphone size={20} /> : 
                            device.name === 'desktop' ? <Monitor size={20} /> : 
                            device.name === 'tablet' ? <Monitor size={20} className="rotate-90" /> : <Activity size={20} />}
                        </div>
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{device.name}</span>
                     </div>
                     <div className="text-right">
                        <p className="text-lg font-black text-white leading-none">{device.value}</p>
                        <p className="text-[8px] font-bold text-zinc-700 uppercase tracking-widest mt-1">Sessions</p>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {/* Event Breakdown List */}
         <div className="glass-card rounded-[3rem] p-10 border border-white/5 overflow-hidden">
            <div className="flex items-center justify-between mb-10">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                     <Layers size={18} />
                  </div>
                  <div>
                     <h3 className="text-xs font-black text-white uppercase tracking-widest">Performance List</h3>
                     <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Per Event Scoped Metrics</p>
                  </div>
               </div>
               <a href="/attendees" className="text-[9px] font-black text-sky-500 hover:text-white transition-colors uppercase tracking-widest">View All</a>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-4">
               {eventBreakdown?.map((ev) => (
                  <div key={ev.id} className="p-6 bg-zinc-900/40 border border-white/5 rounded-3xl group hover:border-sky-500/30 transition-all">
                     <div className="flex justify-between items-start mb-4">
                        <h4 className="text-xs font-black text-white uppercase tracking-tight truncate max-w-[200px]">{ev.title}</h4>
                        <span className="text-[10px] font-black text-sky-400">₹{ev.revenue.toLocaleString()}</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <Ticket size={12} className="text-zinc-700" />
                           <span className="text-[10px] font-bold text-zinc-600 tracking-widest">{ev.sales} SOLD</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <Activity size={12} className="text-emerald-500/40" />
                           <span className="text-[10px] font-black text-emerald-500">{ev.occupancy}% FILL</span>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};

export default Dashboard;

/**
 * apps/events/src/pages/OrganizerDashboard.Page.jsx
 *
 * Purpose: Dedicated dashboard for event organizers to track real-time
 * analytics, ticket sales, and revenue. Includes a built-in QR Check-In
 * Tool for managing event entry.
 */
import React, { useEffect, useState } from "react";
import { backendAxios } from "../axios";
import {
  IndianRupee,
  Ticket,
  Users,
  TrendingUp,
  QrCode,
  CheckCircle2,
  XCircle,
  Loader2,
  ScanLine,
  ArrowRight,
  Zap,
} from "lucide-react";
import DefaultlayoutHoc from "../layout/Default.layout";

// ── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className={`bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl flex items-center gap-5 hover:border-${color}-500/30 transition-all duration-300`}>
    <div className={`w-14 h-14 rounded-2xl bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center shrink-0`}>
      <Icon size={24} className={`text-${color}-400`} />
    </div>
    <div>
      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  </div>
);

// ── Check-In Tool ─────────────────────────────────────────────────────────────
const CheckInTool = () => {
  const [ticketInput, setTicketInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async () => {
    if (!ticketInput.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await backendAxios.post("/api/bookings/check-in", {
        ticketId: ticketInput.trim().toUpperCase(),
      });
      setResult({ success: true, message: data.message });
    } catch (err) {
      const msg = err.response?.data?.message || "An error occurred.";
      setResult({ success: false, message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <ScanLine size={20} className="text-sky-400" />
        </div>
        <div>
          <h3 className="text-white font-black text-lg">QR Check-In Portal</h3>
          <p className="text-slate-500 text-xs">Enter Ticket ID to mark attendance</p>
        </div>
      </div>

      <div className="flex gap-3">
        <input
          value={ticketInput}
          onChange={(e) => setTicketInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCheckIn()}
          placeholder="e.g. TKT-A1B2C3D4"
          className="flex-1 bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-2xl px-5 py-3 font-mono text-sm focus:outline-none focus:border-sky-500/50 transition-all"
        />
        <button
          onClick={handleCheckIn}
          disabled={loading || !ticketInput.trim()}
          className="bg-sky-500 hover:bg-sky-400 disabled:bg-white/10 disabled:text-slate-600 text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-2xl transition-all flex items-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
          Check In
        </button>
      </div>

      {result && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${result.success ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
          {result.success ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
          <p className="font-black text-sm">{result.message}</p>
        </div>
      )}
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
const ORGANIZER_ID = "global"; // Use "global" to get all events stats

const OrganizerDashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await backendAxios.get(`/api/organizer/stats/${ORGANIZER_ID}`);
        setStats(data);
      } catch (err) {
        setError("Failed to load dashboard data.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#040b17] flex items-center justify-center">
        <Loader2 className="text-sky-500 animate-spin" size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#040b17] flex items-center justify-center text-red-400 font-black">
        {error}
      </div>
    );
  }

  const attendanceRate = stats?.totalSales > 0
    ? Math.round((stats.totalAttended / stats.totalSales) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#040b17] py-16 px-6 md:px-12">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* Header */}
        <div className="space-y-2">
          <p className="text-[10px] text-sky-500 font-black uppercase tracking-widest">Admin View</p>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter">Organizer Dashboard</h1>
          <p className="text-slate-400">Real-time attendance and revenue analytics.</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={IndianRupee}
            label="Gross Revenue"
            value={`₹${(stats?.totalRevenue || 0).toLocaleString("en-IN")}`}
            color="emerald"
          />
          <StatCard
            icon={TrendingUp}
            label="Your Payout (Net)"
            value={`₹${(stats?.totalPayout || 0).toLocaleString("en-IN")}`}
            color="indigo"
          />
          <StatCard
            icon={Ticket}
            label="Tickets Sold"
            value={stats?.totalSales || 0}
            color="sky"
          />
          <StatCard
            icon={Users}
            label="Attended"
            value={stats?.totalAttended || 0}
            color="violet"
          />
        </div>

        {/* Check-in Tool */}
        <CheckInTool />

        {/* Event Breakdown Table */}
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-white font-black text-xl">Event Breakdown</h2>
            <p className="text-slate-500 text-xs mt-1">Revenue and attendance per event</p>
          </div>

          {stats?.events?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-[10px] text-slate-500 font-black uppercase tracking-widest px-6 py-4">Event</th>
                    <th className="text-center text-[10px] text-slate-500 font-black uppercase tracking-widest px-6 py-4">Visibility</th>
                    <th className="text-right text-[10px] text-slate-500 font-black uppercase tracking-widest px-6 py-4">Sales</th>
                    <th className="text-right text-[10px] text-slate-500 font-black uppercase tracking-widest px-6 py-4">Payout</th>
                    <th className="text-right text-[10px] text-slate-500 font-black uppercase tracking-widest px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                    {stats.events.map((ev, i) => (
                      <tr key={ev.eventId || i} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-white font-bold">{ev.title || "Untitled Event"}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-0.5">{ev.status}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {ev.isPublic ? (
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest">Public</span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-500 text-[10px] font-black uppercase tracking-widest">Unlisted</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-white font-mono font-bold">{ev.totalTickets}</p>
                          <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mt-0.5">{ev.attended} Attended</p>
                        </td>
                        <td className="px-6 py-4 text-right text-emerald-400 font-mono font-bold">
                          ₹{ev.payout.toLocaleString("en-IN")}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                             <button 
                               onClick={() => window.open(`/event/${ev.slug || ev.eventId}`, '_blank')}
                               className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
                               title="View Event"
                             >
                               <ArrowRight size={14} />
                             </button>
                             {!ev.isPublic && (
                               <button 
                                 onClick={() => window.location.href = `/promote/${ev.eventId}`}
                                 className="px-3 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                               >
                                 <Zap size={10} fill="currentColor" /> Promote
                               </button>
                             )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <Ticket size={40} className="mb-4" />
              <p className="font-black">No event data found.</p>
              <p className="text-xs mt-1">Events will appear here once bookings are made.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default DefaultlayoutHoc(OrganizerDashboardPage);

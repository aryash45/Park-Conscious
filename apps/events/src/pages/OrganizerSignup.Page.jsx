import React, { useState } from "react";
import { 
  Rocket, 
  ShieldCheck, 
  Globe, 
  Zap, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  Loader2,
  CheckCircle2
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { backendAxios } from "../axios";
import DefaultlayoutHoc from "../layout/Default.layout";

const OrganizerSignupPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await backendAxios.post("/api/auth/register/organizer", formData);
      setSuccess(true);
      setTimeout(() => {
        window.location.href = "https://admin.events.parkconscious.in/login";
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] flex items-center justify-center px-6 py-32 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-sky-600/10 rounded-full blur-[120px] -z-10" />

      <div className="w-full max-w-md space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">
            <Rocket size={12} fill="currentColor" /> Organizer Portal
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter">
            Join the <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-sky-400">Backstage</span> Network.
          </h1>
          <p className="text-slate-500 font-medium text-sm">
            Start hosting premium experiences in minutes.
          </p>
        </div>

        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-10 text-center space-y-6 backdrop-blur-xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">Account Created!</h3>
              <p className="text-slate-400 text-sm font-medium">Redirecting you to the Admin Panel...</p>
            </div>
            <Loader2 className="animate-spin text-emerald-500 mx-auto" size={24} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 space-y-6 backdrop-blur-2xl shadow-2xl">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Piyush ..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-14 pr-6 py-5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Work Email</label>
                <div className="relative group">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input 
                    type="email" 
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="piyush@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-14 pr-6 py-5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Secure Password</label>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input 
                    type="password" 
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-14 pr-6 py-5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-6 bg-gradient-to-r from-indigo-500 to-sky-500 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
              Create My Account
            </button>

            <div className="text-center pt-4">
              <p className="text-slate-600 text-xs font-medium">
                Already have an account?{" "}
                <a href="https://admin.events.parkconscious.in/login" className="text-indigo-400 font-black uppercase tracking-widest text-[10px] hover:text-white transition-colors">Login Here</a>
              </p>
            </div>
          </form>
        )}

        <div className="flex justify-center gap-8 pt-10">
          <div className="flex items-center gap-2 text-[9px] font-black text-slate-700 uppercase tracking-widest">
            <ShieldCheck size={14} className="text-emerald-500" /> Secure Protocol
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black text-slate-700 uppercase tracking-widest">
            <Globe size={14} className="text-sky-500" /> Global Distribution
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefaultlayoutHoc(OrganizerSignupPage);

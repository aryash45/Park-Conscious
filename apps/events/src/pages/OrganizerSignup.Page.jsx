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
  CheckCircle2,
  ShieldAlert,
  ChevronLeft,
  Key
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { backendAxios } from "../axios";
import DefaultlayoutHoc from "../layout/Default.layout";

const OrganizerSignupPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: Details
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    code: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const sendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await backendAxios.post("/api/auth/register/send-otp", { email: formData.email });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async (e) => {
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
      setError(err.response?.data?.message || "Registration failed. Check your details.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setLoading(true);
    setError("");
    
    try {
      await backendAxios.post("/api/auth/register/verify-otp", { 
        email: formData.email, 
        code: formData.code.replace(/\D/g, '') 
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid verification code. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <form onSubmit={sendOTP} className="w-full space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-slate-500 uppercase tracking-widest ml-1">Professional Email</label>
                <div className="relative group">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                  <input 
                    type="email" 
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="piyush@example.com"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-white text-sm focus:outline-none focus:border-indigo-400 transition-all font-medium backdrop-blur-xl"
                  />
                </div>
              </div>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-6 bg-white text-black font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-xs uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-white/5 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-4 group"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>Send Verification Code <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" /></>
              )}
            </button>
          </form>
        );
      case 2:
        return (
          <form onSubmit={handleVerifyOTP} className="w-full space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <button 
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-[10px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-slate-500 hover:text-white uppercase tracking-widest transition-colors mb-4"
            >
              <ChevronLeft size={14} /> Back to Email
            </button>
            <div className="space-y-6">
              <div className="space-y-2 text-center pb-4">
                <p className="text-slate-400 text-sm font-medium">We've sent a 6-digit protocol to <span className="text-white font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter">{formData.email}</span></p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-slate-500 uppercase tracking-widest ml-1 text-center block w-full">Authentication Code</label>
                <div className="relative">
                  <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                  <input 
                    type="text" 
                    required
                    maxLength="6"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.replace(/\D/g, '')})}
                    placeholder="0 0 0 0 0 0"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-white text-2xl text-center focus:outline-none focus:border-indigo-400 transition-all font-mono tracking-[0.5em] backdrop-blur-xl"
                  />
                </div>
              </div>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-6 bg-white text-black font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-xs uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-white/5 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-4"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>Verify Protocol <ArrowRight size={20} /></>
              )}
            </button>
          </form>
        );
      case 3:
        return (
          <form onSubmit={handleFinalSubmit} className="w-full space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-6">
              <div className="space-y-2 text-center pb-4">
                <p className="text-emerald-400 text-[10px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                  <CheckCircle2 size={14} /> Email Verified
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Piyush ..."
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-white text-sm focus:outline-none focus:border-indigo-400 transition-all font-medium backdrop-blur-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-slate-500 uppercase tracking-widest ml-1">Access Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    <input 
                      type="password" 
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="••••••••"
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-white text-sm focus:outline-none focus:border-indigo-400 transition-all font-medium backdrop-blur-xl"
                    />
                  </div>
                </div>
              </div>
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-6 bg-white text-black font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-xs uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-white/5 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-4"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <>Complete Onboarding <ArrowRight size={20} /></>}
            </button>
          </form>
        );
    }
  };

  return (
    <>
    <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center px-6 py-32 relative overflow-hidden gap-16">
      {/* Subtle Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-400/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-white/[0.02] blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-5xl space-y-16 relative z-10">
          <div className="flex flex-col items-center gap-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-[9px] font-black text-indigo-400 uppercase tracking-[0.4em]">
              Organizer Access
            </div>
            <div className="flex flex-col items-center">
              <h1 className="text-7xl sm:text-8xl md:text-[9rem] font-black uppercase tracking-tight leading-[0.85] md:leading-[0.75] m-0 p-0 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10 select-none animate-reveal">
                Start
              </h1>
              <h1 className="text-7xl sm:text-8xl md:text-[9rem] font-black uppercase tracking-tight leading-[0.85] md:leading-[0.75] m-0 p-0 text-transparent bg-clip-text bg-gradient-to-b from-indigo-400 to-indigo-800/20 select-none animate-reveal -mt-1 sm:-mt-2 md:-mt-4" style={{ animationDelay: '0.2s' }}>
                Hosting.
              </h1>
            </div>
            <p className="text-zinc-600 font-bold text-[10px] uppercase tracking-[0.4em]">Step {step} of 3: Verification & Identity</p>
          </div>
        </div>

        <div className="w-full flex justify-center">
           <div className="w-full max-w-2xl relative bg-zinc-950/20 border border-white/[0.03] rounded-[3.5rem] p-10 md:p-16 backdrop-blur-3xl shadow-2xl">
              {success ? (
                <div className="rounded-3xl p-10 text-center space-y-8 animate-in zoom-in duration-700">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                    <CheckCircle2 size={40} />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-3xl font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-white uppercase tracking-tighter italic leading-none">Access Granted</h3>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Identity synced. Redirecting to Stage One...</p>
                  </div>
                  <div className="flex justify-center">
                    <Loader2 className="animate-spin text-indigo-400" size={24} />
                  </div>
                </div>
              ) : (
                <div className="space-y-10">
                  {error && (
                    <div className="bg-red-500/5 border border-red-500/10 text-red-400 text-[9px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter uppercase tracking-widest px-6 py-4 rounded-2xl flex items-center gap-3 animate-in fade-in duration-500">
                      <ShieldAlert size={14} /> {error}
                    </div>
                  )}

                  {renderStep()}
                </div>
              )}
           </div>
        </div>

        <div className="flex justify-center gap-12 pt-12 border-t border-white/[0.03]">
          <div className="flex items-center gap-3 text-[8px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-zinc-800 uppercase tracking-[0.3em]">
            <ShieldCheck size={14} className="text-zinc-800" /> End-to-End Encryption
          </div>
          <div className="flex items-center gap-3 text-[8px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-zinc-800 uppercase tracking-[0.3em]">
            <Globe size={14} className="text-zinc-800" /> Global Distribution
          </div>
        </div>
      </div>
    <style>{`
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
      .animate-shake {
        animation: shake 0.2s ease-in-out 0s 2;
      }
    `}</style>
    </>
  );
};

export default DefaultlayoutHoc(OrganizerSignupPage);

import React from "react";
import { 
  Rocket, 
  ShieldCheck, 
  Globe, 
  Zap, 
  IndianRupee, 
  ChevronRight, 
  CheckCircle2,
  Lock,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DefaultlayoutHoc from "../layout/Default.layout";

const FeatureCard = ({ icon: Icon, title, desc, color }) => (
  <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 backdrop-blur-2xl hover:border-white/20 transition-all duration-500 group">
    <div className={`w-16 h-16 rounded-2xl bg-${color}-500/10 border border-${color}-500/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
      <Icon size={32} className={`text-${color}-400`} />
    </div>
    <h3 className="text-2xl font-black text-white mb-4 tracking-tight">{title}</h3>
    <p className="text-slate-400 leading-relaxed text-sm font-medium">{desc}</p>
  </div>
);

const ListYourEventPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050507] pt-32 pb-20 px-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-sky-600/10 rounded-full blur-[120px] -z-10" />

      <div className="max-w-6xl mx-auto space-y-32">
        
        {/* Hero Section */}
        <div className="text-center space-y-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-sky-400 uppercase tracking-[0.3em] animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Zap size={12} fill="currentColor" /> Self-Service Event Platform
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-[0.9] animate-in fade-in slide-in-from-bottom-6 duration-1000">
            Host Your Event <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400">Like a Pro.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            From unlisted private links to featured public discoveries. Backstage gives you the tools to manage ticketing, QR check-ins, and analytics for free.
          </p>
          <div className="flex flex-wrap justify-center gap-6 pt-6">
            <button 
              onClick={() => navigate('/organizer/signup')}
              className="px-10 py-5 bg-white text-black font-black text-sm uppercase tracking-widest rounded-2xl hover:scale-105 transition-all flex items-center gap-3 shadow-xl shadow-white/10"
            >
              Start Creating <ChevronRight size={18} />
            </button>
            <button 
              onClick={() => window.location.href = 'https://admin.events.parkconscious.in/login'}
              className="px-10 py-5 bg-white/5 border border-white/10 text-white font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all"
            >
              Organizer Login
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={Lock}
            color="amber"
            title="Unlisted Links"
            desc="Keep your event private. Perfect for closed parties, corporate retreats, or internal sessions. Share via WhatsApp or Instagram."
          />
          <FeatureCard 
            icon={Globe}
            color="sky"
            title="Public Discovery"
            desc="One-click promotion to the Backstage homepage. Reach thousands of attendees looking for their next big experience."
          />
          <FeatureCard 
            icon={Zap}
            color="emerald"
            title="Smart Ticketing"
            desc="Automatic QR code generation, real-time sales tracking, and a seamless checkout experience for your guests."
          />
        </div>

        {/* Pricing Section */}
        <div className="bg-gradient-to-br from-indigo-600/20 to-sky-600/20 border border-white/10 rounded-[3rem] p-12 md:p-20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">Transparent <br/>Pricing Model</h2>
              <p className="text-slate-400 font-medium leading-relaxed">
                We only succeed when you do. That's why our core tools are free for private events.
              </p>
              <div className="space-y-4">
                {[
                  "Free QR Scanning App for iOS/Android",
                  "Unlimited Private (Unlisted) Events",
                  "Detailed Sales & Revenue Analytics",
                  "Custom Data Collection Fields"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-white/80 font-bold text-sm">
                    <CheckCircle2 size={18} className="text-emerald-400" /> {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-[2.5rem] p-10 space-y-10 backdrop-blur-xl">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-white font-black text-2xl">Public Listing</h4>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">One-time per event</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-black text-white">₹499</p>
                </div>
              </div>

              <div className="w-full h-px bg-white/10" />

              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-white font-black text-2xl">Commission</h4>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Only on paid tickets</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-black text-white">8%</p>
                </div>
              </div>

              <button 
                onClick={() => navigate('/organizer/signup')}
                className="w-full py-6 bg-gradient-to-r from-indigo-500 to-sky-500 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-4"
              >
                Create Your Account <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DefaultlayoutHoc(ListYourEventPage);

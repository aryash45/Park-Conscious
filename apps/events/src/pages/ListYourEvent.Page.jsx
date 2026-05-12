import React, { useEffect } from "react";
import { 
  Rocket, 
  ShieldCheck, 
  Globe, 
  Zap, 
  IndianRupee, 
  ChevronRight, 
  CheckCircle2,
  Lock,
  ArrowRight,
  Monitor,
  Sparkles,
  Command,
  Layout,
  Layers,
  Cpu
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DefaultlayoutHoc from "../layout/Default.layout";

const FeatureCard = ({ icon: Icon, title, desc, delay }) => (
  <div 
    className="group relative bg-zinc-950/40 border border-white/[0.05] rounded-[3rem] p-10 backdrop-blur-3xl hover:border-indigo-500/30 transition-all duration-700 animate-in fade-in slide-in-from-bottom-8 fill-mode-both"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[3rem]" />
    <div className="relative z-10">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-indigo-500/10 transition-all duration-500">
        <Icon size={32} className="text-indigo-400" />
      </div>
      <h3 className="text-2xl font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-white mb-4 tracking-tighter uppercase italic">{title}</h3>
      <p className="text-zinc-500 leading-relaxed text-sm font-medium">{desc}</p>
    </div>
  </div>
);

const ListYourEventPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#050507] pb-32 relative overflow-hidden">
      {/* Cinematic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-screen overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/5 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-white/[0.02] blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 space-y-48">
        
        {/* Massive Hero Section */}
        <div className="pt-48 md:pt-64 text-center space-y-16">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-white/[0.03] border border-white/10 text-[9px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-indigo-400 uppercase tracking-[0.5em] animate-in fade-in zoom-in duration-1000">
              <Sparkles size={14} /> The Next Stage of Events
            </div>
            <div className="flex flex-col items-center">
              <h1 className="text-7xl sm:text-8xl md:text-[10rem] font-black uppercase tracking-tight leading-[0.85] md:leading-[0.75] m-0 p-0 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10 select-none animate-reveal">
                SCALE YOUR
              </h1>
              <h1 className="text-7xl sm:text-8xl md:text-[10rem] font-black uppercase tracking-tight leading-[0.85] md:leading-[0.75] m-0 p-0 text-transparent bg-clip-text bg-gradient-to-b from-indigo-400 to-indigo-800/20 select-none animate-reveal -mt-1 sm:-mt-2 md:-mt-4 italic" style={{ animationDelay: '0.2s' }}>
                VISION.
              </h1>
            </div>
          </div>

          <p className="text-xl md:text-2xl text-zinc-500 font-medium max-w-3xl mx-auto leading-relaxed animate-in fade-in duration-1000 delay-500">
            Beyond generic forms. Build a premium ticketing experience for your community with professional tools for creators and founders.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-700">
            <button 
              onClick={() => navigate('/organizer/signup')}
              className="group relative px-16 py-7 bg-white text-black font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-xs uppercase tracking-[0.4em] rounded-full hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/5 overflow-hidden"
            >
              <div className="absolute inset-0 bg-indigo-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              <span className="relative z-10 flex items-center gap-3 group-hover:text-white transition-colors">
                Start Hosting <ChevronRight size={18} />
              </span>
            </button>
            <button 
              onClick={() => window.location.href = 'https://admin.events.parkconscious.in/login'}
              className="px-16 py-7 bg-transparent border border-white/10 text-white font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-xs uppercase tracking-[0.4em] rounded-full hover:bg-white/5 transition-all"
            >
              Organizer Login
            </button>
          </div>
        </div>

        {/* Feature Matrix */}
        <div className="space-y-24">
          <div className="text-center space-y-4">
             <p className="text-[10px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-indigo-500 uppercase tracking-[0.4em]">Integrated Infrastructure</p>
             <h2 className="text-4xl md:text-6xl font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-white tracking-tighter uppercase italic leading-none">Professional Grade Tooling.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <FeatureCard 
              icon={Command}
              delay={0}
              title="Dual-Track Entry"
              desc="Manage multiple registration paths simultaneously. Founders, Speakers, and Attendees—all in one unified flow."
            />
            <FeatureCard 
              icon={Layout}
              delay={100}
              title="Real-time Insights"
              desc="Deep visibility into your community. Track conversions, engagement, and ticket velocity in real-time."
            />
            <FeatureCard 
              icon={Layers}
              delay={200}
              title="Hybrid Ready"
              desc="Adapt to your event's evolving lifecycle. TBA dates and Online-only flows built-in for maximum flexibility."
            />
          </div>
        </div>

        {/* Showcase / CTA Section */}
        <div className="relative py-48">
           <div className="relative bg-zinc-950/40 border border-white/[0.05] rounded-[4rem] p-16 md:p-32 text-center space-y-16 backdrop-blur-3xl overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[120px] -translate-y-1/2 translate-x-1/2" />
              
              <div className="max-w-4xl mx-auto space-y-8">
                <p className="text-[10px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-indigo-500 uppercase tracking-[0.5em]">The Organizer Network</p>
                 <h2 className="text-5xl md:text-7xl font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-white tracking-tighter uppercase leading-[0.9] italic">
                    No more forms. <br/>
                    <span className="text-zinc-600">Just experiences.</span>
                 </h2>
                 <p className="text-lg text-zinc-500 font-medium">Join the elite network of organizers building the future of city culture.</p>
              </div>

              <button 
                onClick={() => navigate('/organizer/signup')}
                className="inline-flex items-center gap-6 px-16 py-8 bg-white text-black rounded-full font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-[12px] uppercase tracking-[0.4em] hover:scale-105 transition-all active:scale-95 group shadow-xl"
              >
                Launch Your First Event <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
              </button>

              <div className="pt-16 flex flex-wrap justify-center gap-12 border-t border-white/[0.03]">
                 {[
                   { icon: ShieldCheck, label: "Encrypted Transactions" },
                   { icon: Globe, label: "Global Distribution" },
                   { icon: Layout, label: "High-Fidelity Interface" }
                 ].map((item, i) => (
                   <div key={i} className="flex items-center gap-3 text-[9px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-zinc-700 uppercase tracking-widest">
                      <item.icon size={14} className="text-zinc-800" /> {item.label}
                   </div>
                 ))}
              </div>
           </div>
        </div>

      </div>

      {/* Custom Styles */}
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default DefaultlayoutHoc(ListYourEventPage);

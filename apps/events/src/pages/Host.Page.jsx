/**
 * apps/events/src/pages/Host.Page.jsx
 *
 * Purpose: Marketing and onboarding page for prospective event organisers.
 * Outlines the benefits of hosting with Backstage and provides access to
 * the RequestEventModal to initiate the onboarding process.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, MapPin, Shield, Globe, Send, Sparkles, LogIn } from 'lucide-react';
import DefaultlayoutHoc from "../layout/Default.layout";
import RequestEventModal from "../components/Modal/RequestEventModal";

const HostPage = () => {
  const navigate = useNavigate();
  const [isRequestModalOpen, setIsRequestModalOpen] = React.useState(false);

  return (
    <div className="bg-[#050507] min-h-screen text-white pb-24 overflow-hidden">
      {/* Hero Section */}
      <div className="relative pt-32 pb-48 md:pt-48 md:pb-64 flex flex-col items-center">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full animate-mesh pointer-events-none"></div>
        <div className="absolute bottom-[0%] right-[-5%] w-[40%] h-[60%] bg-blue-600/5 blur-[120px] rounded-full animate-mesh pointer-events-none" style={{ animationDelay: '-5s' }}></div>
        
        <div className="container mx-auto px-6 text-center z-10">
          <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-white/5 bg-white/5 mb-12 animate-reveal">
            <Sparkles size={14} className="text-indigo-400" />
            <span className="text-[10px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter uppercase tracking-[0.4em] text-indigo-300">The Organizer Ecosystem</span>
          </div>
          
          <div className="flex flex-col items-center">
            <h1 className="text-7xl sm:text-8xl md:text-[10rem] lg:text-[12rem] font-black uppercase tracking-tight leading-[0.85] md:leading-[0.75] m-0 p-0 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10 select-none animate-reveal" style={{ animationDelay: '0.2s' }}>
              HOST WITH
            </h1>
            <h1 className="text-7xl sm:text-8xl md:text-[10rem] lg:text-[12rem] font-black uppercase tracking-tight leading-[0.85] md:leading-[0.75] m-0 p-0 text-transparent bg-clip-text bg-gradient-to-b from-indigo-400 to-indigo-800/20 select-none animate-reveal -mt-1 sm:-mt-2 md:-mt-4 italic" style={{ animationDelay: '0.4s' }}>
              BACKSTAGE.
            </h1>
          </div>

          <p className="text-zinc-500 text-lg md:text-2xl font-medium max-w-3xl mx-auto leading-relaxed animate-reveal" style={{ animationDelay: '0.4s' }}>
            Elevate your event from a spreadsheet to a premium experience. Professional ticketing, secure entries, and built-in logistics for Delhi's top creators.
          </p>

          <div className="mt-16 flex flex-col items-center gap-8 animate-reveal" style={{ animationDelay: '0.6s' }}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button 
                onClick={() => setIsRequestModalOpen(true)}
                className="px-12 py-5 bg-white text-black rounded-full font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-[12px] uppercase tracking-[0.3em] hover:bg-indigo-600 hover:text-white transition-all shadow-2xl active:scale-95"
              >
                Launch Your Event
              </button>
              <button 
                onClick={() => document.getElementById('value-prop').scrollIntoView({ behavior: 'smooth' })}
                className="px-12 py-5 border border-white/10 text-white rounded-full font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-[12px] uppercase tracking-[0.3em] hover:bg-white/5 transition-all"
              >
                Why Backstage?
              </button>
            </div>
            
            <button 
              onClick={() => navigate("/admin")}
              className="flex items-center gap-3 text-slate-500 hover:text-white transition-colors text-[9px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter uppercase tracking-[0.4em]"
            >
               <LogIn size={14} /> Already an Organizer? Sign In
            </button>
          </div>
        </div>
      </div>

      {/* Value Prop Section (Google Forms Alternative) */}
      <div id="value-prop" className="container mx-auto px-6 md:px-12 mb-48">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <div className="space-y-12">
            <div className="space-y-6">
              <h2 className="text-5xl md:text-7xl font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter uppercase tracking-tighter leading-[0.9]">
                 Stop hosting forms.<br/>
                 <span className="text-slate-500 italic">Start hosting experiences.</span>
              </h2>
              <p className="text-slate-400 text-xl font-medium leading-relaxed max-w-lg">
                Generic forms are for surveys, not for events. Move beyond manual spreadsheets with a platform built for high-stakes coordination.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
              {[
                { icon: <Zap className="text-indigo-400" />, title: "Instant Ticketing", desc: "Automatic QR ticket generation and secure delivery for every guest." },
                { icon: <MapPin className="text-indigo-400" />, title: "Smart Logistics", desc: "Integrated parking management linked directly to event entries." },
                { icon: <Shield className="text-indigo-400" />, title: "Secure Entries", desc: "Scan and verify tickets at the gate with real-time check-in logs." },
                { icon: <Globe className="text-indigo-400" />, title: "Auto Discovery", desc: "Get featured on our main grid and reach thousands of seekers." }
              ].map((item, i) => (
                <div key={i} className="space-y-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-indigo-600/20 transition-colors">
                    {item.icon}
                  </div>
                  <h4 className="text-sm font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter uppercase tracking-widest">{item.title}</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-400/20 to-blue-500/20 rounded-[4rem] blur-3xl opacity-50"></div>
            <div className="relative bg-[#0a0a0f] border border-white/5 rounded-[4rem] p-12 md:p-20 space-y-12 overflow-hidden shadow-2xl">
              <div className="space-y-4">
                <p className="text-[10px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-indigo-400 uppercase tracking-[0.5em]">The Dashboard Advantage</p>
                <h3 className="text-4xl font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter uppercase tracking-tighter leading-none italic">Total Control.</h3>
              </div>

              <div className="space-y-6">
                 {[
                   "Register / book tickets",
                   "Fill required details",
                   "Make payments (via Razorpay)",
                   "Receive automatic email confirmations and QR based passes"
                 ].map((feature, i) => (
                   <div key={i} className="flex items-start gap-4 border-b border-white/5 pb-4 last:border-0 hover:translate-x-1 transition-transform cursor-default group/feat">
                      <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 group-hover/feat:scale-125 transition-transform"></div>
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest leading-relaxed">
                        {feature}
                      </span>
                   </div>
                 ))}
              </div>

              <button 
                onClick={() => setIsRequestModalOpen(true)}
                className="w-full py-6 bg-white text-black rounded-full font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-[12px] uppercase tracking-[0.4em] hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
              >
                Get Started
              </button>

              <div className="text-center pt-4">
                 <button 
                   onClick={() => navigate("/admin")}
                   className="text-[9px] font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-slate-600 hover:text-indigo-400 uppercase tracking-[0.3em] transition-colors"
                 >
                    Existing Organizer? Login here
                 </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Footer */}
      <div className="container mx-auto px-6 mb-32">
        <div className="bg-gradient-to-r from-indigo-600/20 to-blue-600/10 border border-white/5 rounded-[4rem] p-16 md:p-24 text-center space-y-12 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-400/10 blur-[100px] pointer-events-none"></div>
           
           <div className="max-w-2xl mx-auto space-y-6">
              <h2 className="text-4xl md:text-6xl font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter uppercase tracking-tighter leading-tight italic">
                Ready to take your events to the <span className="text-indigo-400">Next Stage?</span>
              </h2>
              <p className="text-slate-400 text-lg font-medium">Join the network of creators building the future of city culture.</p>
           </div>
           
           <button 
             onClick={() => setIsRequestModalOpen(true)}
             className="inline-flex items-center gap-6 px-16 py-6 bg-white text-black rounded-full font-['Plus_Jakarta_Sans'] font-['Plus_Jakarta_Sans'] font-extrabold tracking-tighter text-[12px] uppercase tracking-[0.4em] hover:bg-white hover:shadow-[0_0_50px_rgba(255,255,255,0.2)] transition-all"
           >
             Start Your Journey <ArrowRight size={20} />
           </button>
        </div>
      </div>

      <RequestEventModal 
        isOpen={isRequestModalOpen} 
        onClose={() => setIsRequestModalOpen(false)} 
      />
    </div>
  );
};

export default DefaultlayoutHoc(HostPage);

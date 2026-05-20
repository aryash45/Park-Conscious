/**
 * apps/events/src/pages/Success.Page.jsx
 *
 * Purpose: Post-checkout confirmation page for users.
 * Verifies the transaction ID, displays the digital ticket with QR code,
 * and provides options for downloading/printing the access pass.
 */
import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { backendAxios } from "../axios";
import { QRCodeSVG } from "qrcode.react";
import { 
  CheckCircle2, 
  Download, 
  MapPin, 
  Calendar, 
  User, 
  Ticket, 
  ArrowRight, 
  Loader2,
  AlertTriangle,
  Clock,
  ExternalLink
} from 'lucide-react';

const SuccessPage = () => {
  const [searchParams] = useSearchParams();
  const txnId = searchParams.get("txnId");
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const ticketRef = useRef();

  useEffect(() => {
    if (txnId) {
      const fetchBooking = async () => {
        try {
          const res = await backendAxios.get(`/api/pay?action=status&txnId=${txnId}`);
          setBooking(res.data);
        } catch (err) {
          console.error("Error fetching booking:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchBooking();
    } else {
      setLoading(false);
    }
  }, [txnId]);

  const handleDownload = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
           <Loader2 className="animate-spin text-indigo-500" size={48} />
           <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">Authenticating Your Entry...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-8">
           <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
              <AlertTriangle className="text-rose-500" size={40} />
           </div>
           <div className="space-y-4">
              <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Access Denied</h1>
              <p className="text-slate-400 text-sm leading-relaxed">We couldn't find a valid booking associated with this transaction ID. If you believe this is an error, please contact support.</p>
           </div>
           <Link to="/" className="inline-flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full font-black uppercase tracking-[0.2em] text-[10px] hover:bg-slate-200 transition-colors">
              Return Home <ArrowRight size={16} />
           </Link>
        </div>
      </div>
    );
  }

  const event = booking.event || {};
  const userName = booking.name || booking.userId || "Guest Attendee";
  const venue = event.location?.name || event.venue || "To Be Announced";
  const dateStr = event.date ? new Date(event.date).toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  }) : "Check Event Details";

  return (
    <div className="min-h-screen bg-[#050507] py-12 md:py-24 px-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-600/5 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="max-w-xl mx-auto relative z-10 space-y-12">
        {/* Top Header */}
        <div className="text-center space-y-6">
           <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400">
              <CheckCircle2 size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Transaction Verified</span>
           </div>
           <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase leading-[0.9]">
              Entry <br/> Confirmed
           </h1>
           <p className="text-slate-500 text-xs md:text-sm uppercase tracking-[0.3em] font-medium max-w-sm mx-auto leading-relaxed">
              Your pass for <span className="text-white">{event.title || "the event"}</span> has been successfully issued.
           </p>
        </div>

        {/* The Premium Ticket */}
        <div className="relative group" id="ticket-card">
          {/* Outer Shadow/Glow */}
          <div className="absolute -inset-4 bg-indigo-500/15 blur-2xl opacity-100 transition-opacity rounded-[3rem]" />
          
          <div className="bg-gradient-to-br from-[#131317] via-[#0E0E12] to-[#0A0A0C] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_-12px_rgba(99,102,241,0.25)] relative">
            
            {/* Top Section: Event Header */}
            <div className="p-8 md:p-12 space-y-8">
               <div className="flex justify-between items-start">
                  <div className="space-y-1.5">
                     <p className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-sky-400 text-[10px] font-black uppercase tracking-[0.3em]">Access Pass</p>
                     <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase max-w-[280px] leading-none">
                        {event.title || "Event Tickets"}
                      </h2>
                  </div>
                  <div className="text-right space-y-1">
                     <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.2em]">Ticket ID</p>
                     <p className="text-white text-xs font-mono tracking-wider font-bold bg-white/5 px-2.5 py-1 rounded-md border border-white/10 inline-block">{booking.ticketId || "TK-PENDING"}</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-8 pt-4">
                  <div className="space-y-3">
                     <div className="flex items-center gap-2 text-zinc-400">
                        <User size={12} className="text-indigo-400" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Guest</span>
                     </div>
                     <p className="text-base font-black text-white truncate uppercase tracking-tight">{userName}</p>
                  </div>
                  <div className="space-y-3">
                     <div className="flex items-center gap-2 text-zinc-400">
                        <Ticket size={12} className="text-indigo-400" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Type</span>
                     </div>
                     <p className="text-base font-black text-indigo-400 uppercase tracking-tight">{booking.amount > 0 ? "Standard Pass" : "Early Access"}</p>
                  </div>
               </div>

               <div className="space-y-6 pt-2">
                  <div className="flex items-start gap-4">
                     <div className="w-10 h-10 bg-white/[0.06] rounded-xl flex items-center justify-center shrink-0 border border-white/10">
                        <Calendar size={18} className="text-indigo-400" />
                     </div>
                     <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Event Date</p>
                        <p className="text-xs md:text-sm text-slate-100 font-extrabold uppercase">{dateStr}</p>
                     </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                     <div className="w-10 h-10 bg-white/[0.06] rounded-xl flex items-center justify-center shrink-0 border border-white/10">
                        <MapPin size={18} className="text-indigo-400" />
                     </div>
                     <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Location</p>
                        <p className="text-xs md:text-sm text-slate-100 font-extrabold uppercase">{venue}</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Perforated Divider (Dots and stubs are now highly visible) */}
            <div className="relative py-4 overflow-hidden">
               {/* Left Ticket Stub Cutout */}
               <div className="absolute left-[-16px] top-1/2 -translate-y-1/2 w-8 h-8 bg-[#050507] rounded-full border-2 border-white/20 z-20 shadow-[inset_-4px_0_6px_rgba(0,0,0,0.6)]" />
               {/* Right Ticket Stub Cutout */}
               <div className="absolute right-[-16px] top-1/2 -translate-y-1/2 w-8 h-8 bg-[#050507] rounded-full border-2 border-white/20 z-20 shadow-[inset_4px_0_6px_rgba(0,0,0,0.6)]" />
               {/* High-contrast Perforated Dots */}
               <div className="mx-8 border-t-2 border-dashed border-white/35" />
            </div>

            {/* Bottom Section: QR Code */}
            <div className="p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 bg-white/[0.04] border-t border-white/5">
               <div className="space-y-4 text-center md:text-left">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Security Code</h3>
                  <p className="text-slate-400 text-[10px] leading-relaxed uppercase tracking-[0.1em] max-w-[200px]">
                     Present this QR code at the entrance for scanning. Entry is limited to one person per ticket.
                  </p>
                  <div className="flex items-center gap-4 justify-center md:justify-start pt-2">
                     <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                        <Clock size={12} className="text-indigo-400" />
                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Valid Entry</span>
                     </div>
                  </div>
               </div>
               
               <div className="relative group/qr">
                  <div className="absolute -inset-4 bg-indigo-500/10 blur-xl rounded-full opacity-100 transition-opacity" />
                  <div className="p-6 bg-white rounded-[2rem] shadow-[0_0_30px_rgba(99,102,241,0.2)] relative">
                    <QRCodeSVG 
                      value={booking.ticketId || txnId} 
                      size={140} 
                      level="H"
                      includeMargin={false}
                    />
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Verification Note */}
        <p className="text-center text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
           A detailed copy of this ticket will be sent to your registered email after verification.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row items-center gap-4 pt-4 no-print">
           <button 
             onClick={handleDownload}
             className="w-full md:flex-1 bg-white text-black py-6 rounded-full font-black uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 hover:bg-slate-200 transition-all active:scale-95 shadow-xl"
           >
              <Download size={18} /> Download Ticket
           </button>
           <Link 
             to="/"
             className="w-full md:w-auto bg-white/5 border border-white/10 text-white px-10 py-6 rounded-full font-black uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95"
           >
              Return Home <ArrowRight size={16} />
           </Link>
        </div>

        {/* Footer Note */}
        <p className="text-center text-slate-600 text-[9px] font-black uppercase tracking-[0.4em] pt-8 no-print">
           Managed by Backstage • All Rights Reserved
        </p>
      </div>

      {/* Printable Style Hook */}
      <style>{`
        @media print {
          @page { margin: 0.5cm; size: portrait; }
          
          /* Reset and Basics */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          
          /* Container Tweaks */
          .min-h-screen { min-height: auto !important; background: white !important; padding: 0 !important; }
          .max-w-xl { max-width: 100% !important; width: 100% !important; margin: 0 !important; }
          
          /* Hide the Header Text for Print to save space */
          h1, .text-center.space-y-6 > p, .inline-flex.items-center.gap-3 { display: none !important; }
          .text-center.space-y-6 { margin-bottom: 0 !important; padding-bottom: 0 !important; }
          
          /* Force Ticket to be White with Clean Borders */
          #ticket-card > div:last-child { 
            background: white !important; 
            border: 2px solid #000 !important; 
            color: black !important;
            box-shadow: none !important;
            border-radius: 1.5rem !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-top: 0 !important;
          }
          
          /* Text Colors - Target everything within the ticket card */
          #ticket-card p, #ticket-card h2, #ticket-card h3, #ticket-card span, #ticket-card div {
            color: black !important;
          }
          
          /* Icon Colors */
          #ticket-card svg { color: #000 !important; }
          
          /* Perforated Divider */
          .border-dashed { border-color: #000 !important; border-top-width: 2px !important; }
          .absolute.left-\[-15px\], .absolute.right-\[-15px\] { background: white !important; border: 1px solid #000 !important; }
          
          /* QR Code Section */
          #ticket-card div:last-child > div:last-child { background: #fafafa !important; border-top: 1px solid #000 !important; }
          
          /* Hide non-essential decor */
          .absolute, .bg-indigo-600\/5, .blur-\[150px\], .group-hover\:opacity-100 { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default SuccessPage;

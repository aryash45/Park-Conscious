/**
 * apps/events/src/pages/MyBookings.Page.jsx
 *
 * Purpose: User dashboard for managing acquired event passes ("The Wallet").
 * Displays active and past bookings fetched via the authenticated user's ID.
 * Provides a detailed TicketModal with QR code for entry verification.
 */
import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/DiscussionAuth.context";
import { backendAxios } from "../axios";
import { Ticket, Calendar, MapPin, SearchX, X, Download, Share2, Info, CheckCircle2 } from "lucide-react";
import DefaultlayoutHoc from "../layout/Default.layout";
import { Link } from "react-router-dom";

const TicketModal = ({ booking, onClose }) => {
   if (!booking) return null;

   const ticketId = booking.ticketId || booking.transactionId || booking._id || "000000";
   const event = booking.event || {};
   const dateStr = new Date(event.date || booking.createdAt || Date.now()).toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
   });

   return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
         <div className="absolute inset-0 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-500" onClick={onClose}></div>
         
         <div className="relative w-full max-w-xl bg-[#0A0A0C] border border-white/5 rounded-[3rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] animate-in zoom-in-95 fade-in duration-500 slide-in-from-bottom-10">
            {/* Close Button */}
            <button 
               onClick={onClose}
               className="absolute top-8 right-8 z-50 w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-all border border-white/5"
            >
               <X size={20} />
            </button>

            {/* Header / Event Image */}
            <div className="relative h-64 md:h-80 overflow-hidden">
               <img 
                  src={event.image || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14'} 
                  className="w-full h-full object-cover opacity-60" 
                  alt={event.title} 
               />
               <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-transparent to-transparent"></div>
               
               <div className="absolute bottom-8 left-8 right-8">
                  <div className="flex items-center gap-3 mb-4">
                     <span className="px-4 py-1.5 rounded-full bg-indigo-600 text-white text-[9px] font-black uppercase tracking-[0.2em]">Verified Access</span>
                     <span className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em]">{event.category}</span>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic text-white leading-none">{event.title}</h2>
               </div>
            </div>

            {/* Ticket Details */}
            <div className="p-10 md:p-12 space-y-12">
               <div className="grid grid-cols-2 gap-8 border-b border-white/5 pb-10">
                  <div className="space-y-2">
                     <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2">
                        <Calendar size={12} className="text-indigo-400" /> Date
                     </p>
                     <p className="text-lg font-bold text-white">{dateStr}</p>
                  </div>
                  <div className="space-y-2 text-right">
                     <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2 justify-end">
                        <MapPin size={12} className="text-indigo-400" /> Venue
                     </p>
                     <p className="text-lg font-bold text-white truncate">{event.venue || event.locationName || "NCR"}</p>
                  </div>
               </div>

               <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                  <div className="space-y-6 flex-1 text-center md:text-left">
                     <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 mb-2">Attendee Pass</p>
                        <p className="text-2xl font-black text-white italic">{booking.tierName || "General Admission"}</p>
                     </div>
                     <div className="flex items-center justify-center md:justify-start gap-4">
                        <div className="flex flex-col">
                           <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-600 mb-1">Transaction ID</p>
                           <p className="text-[10px] font-mono text-slate-400">#{ticketId}</p>
                        </div>
                     </div>
                  </div>

                  <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-2xl scale-110">
                     <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticketId)}&ecc=L&margin=0`}
                        alt="QR Code"
                        width={140}
                        height={140}
                        className="rounded-lg"
                     />
                     <p className="text-[9px] font-black text-black uppercase tracking-[0.4em]">Entry Code</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4 pt-4">
                  <button className="flex-1 py-4 rounded-full bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-white/10 transition-all">
                     <Download size={14} /> Download PDF
                  </button>
                  <button className="flex-1 py-4 rounded-full bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-white/10 transition-all">
                     <Share2 size={14} /> Share Pass
                  </button>
               </div>
            </div>

            <div className="bg-white/5 p-6 text-center border-t border-white/5">
               <p className="text-[8px] font-black uppercase tracking-[0.5em] text-slate-500">Valid Government ID Required for Entry</p>
            </div>
         </div>
      </div>
   );
};

const BookingCard = ({ booking, onClick }) => (
   <div 
      onClick={() => onClick(booking)}
      className="bg-white/5 border border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative hover:-translate-y-2 cursor-pointer transition-all duration-700 group"
   >
      {booking.event?.image && (
         <div className="w-full h-56 bg-[#050507] relative overflow-hidden">
            <img src={booking.event.image} alt={booking.event.title} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700 opacity-80 group-hover:opacity-100" />
            <div className="absolute top-6 right-6 bg-indigo-500/10 backdrop-blur-md border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-[0.3em] px-5 py-2 rounded-full">
               {booking.status}
            </div>
         </div>
      )}

      <div className={`p-6 md:p-10 flex-1 flex flex-col ${!booking.event?.image ? "pt-12 md:pt-16" : ""}`}>
         {!booking.event?.image && (
            <div className="mb-8 flex justify-between items-center">
               <div className="bg-indigo-500/10 backdrop-blur-md border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-[0.3em] px-5 py-2 rounded-full">
                  {booking.status}
               </div>
            </div>
         )}

         <h3 className="text-3xl font-black uppercase tracking-tighter text-white mb-8 leading-[0.85] italic">
            {booking.event?.title || "Classified Event"}
         </h3>

         <div className="space-y-5 mb-10 flex-1">
            <div className="flex items-center gap-4 text-slate-500 font-bold text-[10px] uppercase tracking-[0.3em]">
               <Calendar size={14} className="text-white" />
               <span>{new Date(booking.event?.date || booking.event?.createdAt || booking.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-4 text-slate-500 font-bold text-[10px] uppercase tracking-[0.3em]">
               <MapPin size={14} className="text-white" />
               <span className="truncate">{(typeof booking.event?.location === 'string' ? booking.event.location : booking.event?.location?.name || booking.event?.locationName || booking.event?.venue) || "Venue Restricted"}</span>
            </div>
         </div>

         <div className="mt-auto border-t border-white/5 pt-8 border-dashed flex justify-between items-end">
            <div>
               <p className="text-[9px] uppercase font-black tracking-[0.4em] text-slate-400 mb-2">Ticket Price</p>
               <span className="font-black text-2xl text-white italic">₹{booking.amount}</span>
            </div>
            <div className="text-right flex flex-col items-end gap-3 opacity-50 group-hover:opacity-100 transition-opacity">
               <p className="text-[9px] uppercase font-black tracking-[0.4em] text-slate-400 mb-2">Tap to view</p>
               <div className="bg-white p-1 rounded-lg">
                  <img
                     src={`https://api.qrserver.com/v1/create-qr-code/?size=48x48&data=${encodeURIComponent(booking.ticketId || booking.transactionId)}&ecc=L&margin=0`}
                     alt="QR" width={48} height={48} className="rounded-sm"
                  />
               </div>
            </div>
         </div>
      </div>

      <div className="absolute top-[224px] -left-4 w-8 h-8 bg-[#050507] rounded-full border border-white/5 z-10" style={{ transform: booking.event?.image ? "" : "translateY(-180px)" }}></div>
      <div className="absolute top-[224px] -right-4 w-8 h-8 bg-[#050507] rounded-full border border-white/5 z-10" style={{ transform: booking.event?.image ? "" : "translateY(-180px)" }}></div>
   </div>
);

const MyBookingsPage = () => {
   const { user } = useAuth();
   const [bookings, setBookings] = useState([]);
   const [loading, setLoading] = useState(true);
   const [selectedBooking, setSelectedBooking] = useState(null);

   useEffect(() => {
      if (!user) {
         setLoading(false);
         return;
      }

      const fetchBookings = async () => {
         try {
            const id = user.uid || user.id;
            if (!id) return setLoading(false);
            const { data } = await backendAxios.get(`/api/pay?action=bookings&userId=${id}`);
            setBookings(Array.isArray(data) ? data : []);
         } catch (err) {
            console.error("Error fetching bookings:", err);
         } finally {
            setLoading(false);
         }
      };

      fetchBookings();
   }, [user]);

   const { activeBookings, pastBookings } = useMemo(() => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      return bookings.reduce((acc, booking) => {
         const eventDate = new Date(booking.event?.date || booking.createdAt);
         eventDate.setHours(23, 59, 59, 999);
         
         if (eventDate < now) {
            acc.pastBookings.push(booking);
         } else {
            acc.activeBookings.push(booking);
         }
         return acc;
      }, { activeBookings: [], pastBookings: [] });
   }, [bookings]);

   if (loading) {
      return (
         <div className="bg-[#050507] min-h-screen text-white flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-r-transparent animate-spin"></div>
         </div>
      );
   }

   if (!user) {
      return (
         <div className="bg-[#050507] min-h-screen text-white flex flex-col items-center justify-center p-8 text-center pt-24 pb-32">
            <Ticket size={80} className="text-white/5 mb-8" />
            <h1 className="text-4xl font-black uppercase tracking-tighter mb-4">Access Restricted</h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px] max-w-sm leading-relaxed">Secure your session to view your curated experience vault.</p>
         </div>
      );
   }

   return (
      <div className="bg-[#050507] min-h-screen text-white pb-32">
         <div className="container mx-auto px-8 lg:px-24 pt-24">
            <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
               <div>
                  <h1 className="text-4xl md:text-7xl font-black uppercase tracking-tighter mb-4 italic">The <span className="text-indigo-400">Wallet</span></h1>
                  <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[10px] md:text-xs">Your curated collection of experience credentials.</p>
               </div>
               <div className="bg-white/5 px-6 py-3 rounded-full border border-white/5 flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">{activeBookings.length} Active Passes</span>
               </div>
            </div>

            {bookings.length === 0 ? (
               <div className="bg-white/5 border border-white/5 rounded-[3.5rem] p-12 md:p-24 flex flex-col items-center justify-center text-center backdrop-blur-xl">
                  <Ticket size={80} className="text-white/10 mb-8" />
                  <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 italic text-white/20">Vault is Empty</h2>
                  <Link to="/" className="mt-12 bg-white text-black hover:bg-indigo-600 hover:text-white uppercase tracking-[0.3em] font-black text-[11px] px-12 py-4 rounded-full transition-all">Secure Entry Now</Link>
               </div>
            ) : (
               <div className="space-y-32">
                  {/* Active Section */}
                  <div className="space-y-12">
                     <div className="flex items-center gap-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.5em] text-indigo-400">Active Experiences</h3>
                        <div className="h-px flex-1 bg-white/5"></div>
                     </div>
                     {activeBookings.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                           {activeBookings.map(booking => (
                              <BookingCard key={booking._id} booking={booking} onClick={setSelectedBooking} />
                           ))}
                        </div>
                     ) : (
                        <div className="py-20 text-center border border-white/5 border-dashed rounded-[3rem]">
                           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">No Upcoming Access Passes</p>
                        </div>
                     )}
                  </div>

                  {/* Past Section */}
                  {pastBookings.length > 0 && (
                     <div className="space-y-12 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-700">
                        <div className="flex items-center gap-6">
                           <h3 className="text-xs font-black uppercase tracking-[0.5em] text-slate-500">Archive Vault</h3>
                           <div className="h-px flex-1 bg-white/5"></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                           {pastBookings.map(booking => (
                              <BookingCard key={booking._id} booking={booking} onClick={setSelectedBooking} />
                           ))}
                        </div>
                     </div>
                  )}
               </div>
            )}
         </div>

         {/* Ticket Detail Modal */}
         {selectedBooking && (
            <TicketModal 
               booking={selectedBooking} 
               onClose={() => setSelectedBooking(null)} 
            />
         )}
      </div>
   );
};

export default DefaultlayoutHoc(MyBookingsPage);

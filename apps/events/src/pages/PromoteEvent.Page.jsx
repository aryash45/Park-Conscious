import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { backendAxios } from "../axios";
import { 
  Rocket, 
  ShieldCheck, 
  Globe, 
  Zap, 
  IndianRupee, 
  Loader2, 
  CheckCircle2,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import DefaultlayoutHoc from "../layout/Default.layout";

const PromoteEventPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data } = await backendAxios.get(`/api/events?id=${id}`);
        setEvent(data);
      } catch (err) {
        setError("Failed to load event details.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  const handlePayment = async () => {
    setPaying(true);
    try {
      const { data } = await backendAxios.post("/api/pay/listing", {
        eventId: id
      });

      const options = {
        key: data.key,
        amount: data.amount,
        currency: "INR",
        name: "Backstage Events",
        description: `Listing Fee for ${event.title}`,
        order_id: data.orderId,
        handler: async (response) => {
          try {
            await backendAxios.post("/api/payment-callback/listing", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            navigate(`/event/${id}?promoted=true`);
          } catch (err) {
            alert("Payment verification failed. Please contact support.");
          }
        },
        theme: { color: "#6366f1" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert("Failed to initiate payment.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050507] flex items-center justify-center">
      <Loader2 className="text-sky-500 animate-spin" size={40} />
    </div>
  );

  if (error || !event) return (
    <div className="min-h-screen bg-[#050507] flex items-center justify-center text-red-400 font-black">
      {error || "Event not found."}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050507] pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/5 border border-white/10 rounded-[3rem] p-8 md:p-16 space-y-12 backdrop-blur-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black text-indigo-400 uppercase tracking-widest">
              Event Promotion
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter">
              Ready to go <span className="text-sky-400 text-italic">Public?</span>
            </h1>
            <p className="text-slate-400 font-medium max-w-xl">
              Promoting <span className="text-white font-bold">"{event.title}"</span> to the Backstage homepage will make it visible to our entire community.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                  <Globe size={20} className="text-sky-400" />
                </div>
                <div>
                  <h4 className="text-white font-black text-sm uppercase tracking-tight">Homepage Discovery</h4>
                  <p className="text-slate-500 text-xs mt-1">Appear in the "Upcoming Events" feed for all users.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <IndianRupee size={20} className="text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-white font-black text-sm uppercase tracking-tight">One-time Fee</h4>
                  <p className="text-slate-500 text-xs mt-1">Pay once, stay public until the event ends.</p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
              <div className="flex justify-between items-end">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Listing Charge</p>
                <p className="text-3xl font-black text-white">₹499</p>
              </div>
              <div className="w-full h-px bg-white/10" />
              <button 
                onClick={handlePayment}
                disabled={paying}
                className="w-full py-5 bg-white text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {paying ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} fill="currentColor" />}
                Promote Now
              </button>
              <p className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-widest">Secure Payment via Razorpay</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefaultlayoutHoc(PromoteEventPage);

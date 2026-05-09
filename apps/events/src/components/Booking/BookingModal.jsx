/**
 * apps/events/src/components/Booking/BookingModal.jsx
 *
 * Purpose: Interactive modal for processing ticket purchases.
 * Captures attendee details, integrates with Razorpay for payment
 * processing, and handles successful checkouts and failures.
 */
import React, { useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { backendAxios } from "../../axios";
import { useAuth } from "../../context/DiscussionAuth.context";
import { X, CheckCircle2, AlertCircle, Loader2, CreditCard, User, Mail, Phone, ShieldCheck, Zap, FileText, ChevronDown } from 'lucide-react';
import { uploadToCloudinary } from "../../utils/cloudinary";
import { reportSystemError } from "../../utils/monitoring";

const BookingModal = ({ isOpen, setIsOpen, event, themeConfig }) => {
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: ""
  });
  
  const [customData, setCustomData] = useState({});
  const [registrationType, setRegistrationType] = useState(null); // 'attendee' or 'startup'
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill user data
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: user?.name || "",
        email: user?.email || "",
        phone: ""
      });
      setCustomData({});
      setRegistrationType(event.startupFormEnabled ? null : 'attendee');
    }
  }, [user, isOpen, event.startupFormEnabled]);

  const closeModal = () => {
    if (!loading) setIsOpen(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    setError("");

    const reqFields = event.requiredFields || { name: true, email: true, phone: true };

    // Validation
    if (reqFields.name && !formData.name.trim()) return setError("Name is required");
    if (reqFields.email && (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email))) return setError("Valid email is required");
    if (reqFields.phone && (!formData.phone || formData.phone.length < 10)) return setError("Valid 10-digit phone number is required");

    if (uploading) return setError("Please wait for the file upload to complete.");
    
    // Custom Fields Validation (Only if Startup or Legacy)
    const shouldShowCustomFields = !event.startupFormEnabled || registrationType === 'startup';
    
    if (shouldShowCustomFields && event.customForms && event.customForms.length > 0) {
      for (const field of event.customForms) {
        if (field.required && !customData[field.id]) {
          return setError(`${field.label} is required`);
        }
        // Ensure no error strings are saved as values
        if (customData[field.id] && String(customData[field.id]).toLowerCase().includes('upload failed')) {
           return setError(`Please re-upload a valid file for ${field.label}`);
        }
      }
    }

    setLoading(true);

    try {
      const response = await backendAxios.post("/api/pay", {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        amount: event.selectedTier ? event.selectedTier.price : (event.displayPrice || 0),
        userId: user ? (user.uid || user.id) : (formData.name || "Guest"),
        eventId: event.id || event._id,
        tierName: event.selectedTier?.name || (registrationType === 'startup' ? 'Startup Founder' : 'Standard'),
        customData: {
          ...customData,
          registrationType: registrationType
        }
      });

      if (response.data?.success && response.data?.orderId) {
        const loadScript = (src) => new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });

        const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
        if (!res) {
            setError("Payment SDK failed to load. Please check connection.");
            reportSystemError("Razorpay SDK Load Failed", "sdk_failure", { eventId: event.id });
            setLoading(false);
            return;
        }

        const options = {
            key: response.data.key,
            amount: response.data.amount,
            currency: "INR",
            name: "BACKSTAGE",
            description: event.selectedTier ? `${event.displayTitle || "Event"} - ${event.selectedTier.name}` : (event.displayTitle || event.title || "Event Tickets"),
            order_id: response.data.orderId,
            handler: async function (paymentResponse) {
                try {
                    const verifyRes = await backendAxios.post("/api/payment-callback", paymentResponse);
                    if (verifyRes.data?.success) {
                        window.location.href = `/payment-success?txnId=${verifyRes.data.txnId}`;
                    } else {
                        setError("Payment verification failed.");
                        reportSystemError("Payment Verification Failed (Logic)", "payment_failure", { paymentResponse, eventId: event.id });
                        setLoading(false);
                    }
                } catch (err) {
                    setError("Payment verification failed. Please contact support.");
                    reportSystemError("Payment Verification Error (Network)", "api_failure", { error: err.message, eventId: event.id });
                    setLoading(false);
                }
            },
            prefill: {
                name: formData.name,
                email: formData.email,
                contact: formData.phone
            },
            theme: { color: "#4f46e5" },
            modal: {
                ondismiss: function() {
                    setLoading(false);
                }
            }
        };

        const paymentObject = new window.Razorpay(options);
        paymentObject.on('payment.failed', function () {
            setError("Payment failed! Please try again.");
            setLoading(false);
        });
        paymentObject.open();

      } else if (response.data?.success && response.data?.redirectUrl) {
        window.location.href = response.data.redirectUrl;
      } else if (response.data?.success && response.data?.amount === 0) {
          // Handle free events
          alert("Registration Successful!");
          closeModal();
      } else {
        setError("Failed to initiate booking. Please try again.");
        reportSystemError("Booking Initiation Failed", "api_failure", { response: response.data, eventId: event.id });
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Server connection error.");
      reportSystemError("Booking Process Exception", "frontend_crash", { error: err.message, eventId: event.id });
    } finally {
      setLoading(false);
    }
  };

  if (!event) return null;

  const reqFields = event.requiredFields || { name: true, email: true, phone: true };

  const activeTheme = themeConfig || event?.themeConfig || {};
  const primaryColor = activeTheme.primaryColor || '#E33B76';
  const displayMode = activeTheme.displayMode || 'light';
  
  const textTitleClass = displayMode === 'dark' ? 'text-white' : 'text-slate-900';
  const textSubtitleClass = displayMode === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const bgCardClass = displayMode === 'dark' ? 'bg-black/80 backdrop-blur-3xl border border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]' : 'glass-card-light shadow-[0_50px_100px_-20px_rgba(255,154,158,0.3)]';
  const inputBgClass = displayMode === 'dark' ? 'bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:bg-white/10 focus:border-white/30' : 'bg-white/60 border border-white/80 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-pink-500';
  const labelClass = displayMode === 'dark' ? 'text-slate-400' : 'text-slate-500';
  const textBodyClass = displayMode === 'dark' ? 'text-slate-300' : 'text-slate-600';
  const closeBtnClass = displayMode === 'dark' ? 'bg-white/10 text-slate-300 hover:text-white border-white/10' : 'bg-white/60 text-slate-500 hover:text-pink-600 border-white/80';

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={closeModal}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className={`fixed inset-0 backdrop-blur-xl ${displayMode === 'dark' ? 'bg-black/60' : 'bg-white/30'}`} />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`w-full max-w-xl transform overflow-hidden rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-16 text-left align-middle transition-all relative ${bgCardClass}`}>
                {/* Dynamic Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 blur-[100px] rounded-full pointer-events-none opacity-20" style={{ backgroundColor: primaryColor }}></div>

                <div className="flex justify-between items-start mb-12 relative z-10">
                  <div>
                    <h3 className={`text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none font-heading ${textTitleClass}`}>Booking Summary</h3>
                    <p className={`text-[10px] mt-3 font-black uppercase tracking-[0.3em] ${textSubtitleClass}`}>{event.displayTitle}</p>
                  </div>
                  <button 
                    onClick={closeModal}
                    className={`p-3 transition-colors rounded-full border ${closeBtnClass}`}
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleBooking} className="space-y-8 md:space-y-10 relative z-10">
                  <div className="grid grid-cols-1 gap-6 md:gap-10">
                    {event.startupFormEnabled && !registrationType ? (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <p className={`text-[10px] font-black uppercase tracking-[0.4em] text-center mb-8 ${labelClass}`}>Select Registration Protocol</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                           <button
                             type="button"
                             onClick={() => setRegistrationType('attendee')}
                             className={`group p-6 md:p-8 rounded-[2rem] border-2 transition-all text-left relative overflow-hidden flex flex-col gap-5 md:gap-6 ${displayMode === 'dark' ? 'bg-zinc-900/50 border-white/5 hover:border-sky-500/30' : 'bg-white/60 border-white/80 hover:border-sky-500'}`}
                           >
                             <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-sky-500/5 flex items-center justify-center text-sky-500 group-hover:scale-110 transition-transform">
                               <User size={20} className="md:w-6 md:h-6" strokeWidth={1.5} />
                             </div>
                             <div>
                               <h4 className={`text-base md:text-lg font-black uppercase tracking-tight ${textTitleClass}`}>Attendee</h4>
                               <p className={`text-[8px] md:text-[9px] font-bold uppercase tracking-widest mt-1.5 ${textSubtitleClass}`}>General Entry Access</p>
                             </div>
                             <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-sky-500/10 transition-all" />
                           </button>

                           <button
                             type="button"
                             onClick={() => setRegistrationType('startup')}
                             className={`group p-6 md:p-8 rounded-[2rem] border-2 transition-all text-left relative overflow-hidden flex flex-col gap-5 md:gap-6 ${displayMode === 'dark' ? 'bg-zinc-900/50 border-white/5 hover:border-emerald-500/30' : 'bg-white/60 border-white/80 hover:border-emerald-500'}`}
                           >
                             <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-emerald-500/5 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                               <Zap size={20} className="md:w-6 md:h-6" strokeWidth={1.5} />
                             </div>
                             <div>
                               <h4 className={`text-base md:text-lg font-black uppercase tracking-tight ${textTitleClass}`}>Founder</h4>
                               <p className={`text-[8px] md:text-[9px] font-bold uppercase tracking-widest mt-1.5 ${textSubtitleClass}`}>Pitching & Stall Access</p>
                             </div>
                             <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-all" />
                           </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {reqFields.name && (
                          <div className="space-y-3">
                            <label className={`block text-[10px] font-black uppercase tracking-[0.4em] ml-1 ${labelClass}`}>Full Name</label>
                            <div className="relative group">
                              <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 transition-colors" style={{ color: displayMode === 'dark' ? '#94a3b8' : '#94a3b8' }} size={18} />
                              <input 
                                type="text" name="name" value={formData.name} onChange={handleInputChange}
                                placeholder="Full Legal Name"
                                className={`w-full rounded-2xl pl-16 pr-6 py-5 text-sm outline-none transition-all font-medium shadow-sm ${inputBgClass}`}
                              />
                            </div>
                          </div>
                        )}

                        {reqFields.email && (
                          <div className="space-y-3">
                            <label className={`block text-[10px] font-black uppercase tracking-[0.4em] ml-1 ${labelClass}`}>Email Address</label>
                            <div className="relative group">
                              <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 transition-colors" size={18} />
                              <input 
                                type="email" name="email" value={formData.email} onChange={handleInputChange}
                                placeholder="your@email.com"
                                className={`w-full rounded-2xl pl-16 pr-6 py-5 text-sm outline-none transition-all font-medium shadow-sm ${inputBgClass}`}
                              />
                            </div>
                          </div>
                        )}

                        {reqFields.phone && (
                          <div className="space-y-3">
                            <label className={`block text-[10px] font-black uppercase tracking-[0.4em] ml-1 ${labelClass}`}>Phone Number</label>
                            <div className="relative group">
                              <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 transition-colors" size={18} />
                              <input 
                                type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                                placeholder="10 Digit Contact" maxLength={10}
                                className={`w-full rounded-2xl pl-16 pr-6 py-5 text-sm outline-none transition-all font-medium shadow-sm ${inputBgClass}`}
                              />
                            </div>
                          </div>
                        )}

                        {/* Dynamic Fields Renderer */}
                        {(!event.startupFormEnabled || registrationType === 'startup') && event.customForms && event.customForms.length > 0 && event.customForms.map(field => (
                          <div key={field.id} className="space-y-3">
                            <label className={`block text-[10px] font-black uppercase tracking-[0.4em] ml-1 ${labelClass}`}>
                              {field.label} {field.required && <span className="text-rose-500">*</span>}
                            </label>
                            
                            {field.type === 'textarea' ? (
                              <textarea
                                value={customData[field.id] || ''} 
                                onChange={(e) => setCustomData(prev => ({ ...prev, [field.id]: e.target.value }))}
                                placeholder={`Your ${field.label}`}
                                rows={4}
                                className={`w-full rounded-2xl px-6 py-5 text-sm outline-none transition-all font-medium shadow-sm resize-none ${inputBgClass}`}
                              />
                            ) : field.type === 'select' ? (
                              <div className="relative">
                                <select
                                  value={customData[field.id] || ''} 
                                  onChange={(e) => setCustomData(prev => ({ ...prev, [field.id]: e.target.value }))}
                                  className={`w-full rounded-2xl px-6 py-5 text-sm outline-none transition-all font-medium shadow-sm appearance-none ${inputBgClass}`}
                                >
                                  <option value="">Select Option...</option>
                                  {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                                <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" size={18} />
                              </div>
                            ) : field.type === 'file' ? (
                               <div className="relative">
                                  <label className={`w-full rounded-2xl px-6 py-5 flex items-center justify-between cursor-pointer border-2 border-dashed transition-all ${customData[field.id] ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/20 hover:border-sky-500/50'} ${inputBgClass}`}>
                                    <div className="flex items-center gap-4">
                                      {uploading ? <Loader2 size={18} className="animate-spin text-sky-500" /> : <FileText size={18} className={customData[field.id] ? 'text-emerald-500' : 'text-slate-400'} />}
                                      <span className={`text-sm ${customData[field.id] ? 'text-emerald-500 font-bold' : 'text-slate-500'}`}>
                                        {uploading ? 'Transmitting Data...' : customData[field.id] ? 'File Attached Successfully' : 'Upload Pitch Deck (PDF/PPT)'}
                                      </span>
                                    </div>
                                    <input 
                                      type="file" className="hidden" accept=".pdf,.ppt,.pptx"
                                      onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        setUploading(true);
                                        try {
                                          const url = await uploadToCloudinary(file);
                                          setCustomData(prev => ({ ...prev, [field.id]: url }));
                                          setError(""); // Clear previous errors on success
                                        } catch (err) {
                                          setError(`Upload Failed: ${err.message}`);
                                          setCustomData(prev => {
                                            const copy = { ...prev };
                                            delete copy[field.id]; // Don't save the error message as data
                                            return copy;
                                          });
                                        } finally {
                                          setUploading(false);
                                        }
                                      }}
                                    />
                                    {!uploading && !customData[field.id] && <span className="text-[9px] font-black uppercase tracking-widest text-sky-500">Attach File</span>}
                                    {customData[field.id] && <CheckCircle2 size={18} className="text-emerald-500" />}
                                  </label>
                               </div>
                            ) : field.type === 'checkbox' ? (
                               <label className={`flex items-center gap-4 p-5 rounded-2xl cursor-pointer transition-all border ${customData[field.id] ? 'border-sky-500/50 bg-sky-500/5' : 'border-white/20 hover:bg-white/5'} ${inputBgClass}`}>
                                  <input 
                                    type="checkbox" className="sr-only peer"
                                    checked={!!customData[field.id]}
                                    onChange={(e) => setCustomData(prev => ({ ...prev, [field.id]: e.target.checked }))}
                                  />
                                  <div className="w-6 h-6 rounded-lg border-2 border-slate-400 flex items-center justify-center peer-checked:bg-sky-500 peer-checked:border-sky-500 transition-all">
                                    <CheckCircle2 size={16} className="text-white" />
                                  </div>
                                  <span className={`text-xs font-medium ${textBodyClass}`}>{field.label}</span>
                               </label>
                            ) : (
                              <div className="relative group">
                                <div className={`absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-sm border-2 transition-colors flex items-center justify-center ${displayMode === 'dark' ? 'border-slate-600' : 'border-slate-400'}`}>
                                  <div className="w-1.5 h-1.5 rounded-[1px] transition-colors" style={{ backgroundColor: primaryColor, opacity: customData[field.id] ? 1 : 0 }} />
                                </div>
                                <input 
                                  type="text" 
                                  name={field.id} 
                                  value={customData[field.id] || ''} 
                                  onChange={(e) => setCustomData(prev => ({ ...prev, [field.id]: e.target.value }))}
                                  placeholder={`Your ${field.label}`}
                                  className={`w-full rounded-2xl pl-16 pr-6 py-5 text-sm outline-none transition-all font-medium shadow-sm ${inputBgClass}`}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {error && (
                    <div className="p-6 bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl flex items-center gap-4">
                      <AlertCircle size={20} /> {error}
                    </div>
                  )}

                  <div className="pt-6 space-y-8">
                    <button 
                      type="submit" disabled={loading || (event.startupFormEnabled && !registrationType) || uploading}
                      className="w-full text-white font-black py-6 rounded-full hover:scale-[1.02] transition-all shadow-xl active:scale-95 disabled:opacity-40 mt-4 uppercase tracking-[0.3em] text-[11px] flex items-center justify-center px-12"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin shrink-0" size={20} />
                          <span className="flex-1 text-center">Securing Ticket...</span>
                          <div className="w-5 shrink-0" />
                        </>
                      ) : uploading ? (
                        <>
                          <Loader2 className="animate-spin shrink-0" size={20} />
                          <span className="flex-1 text-center">Processing Media...</span>
                          <div className="w-5 shrink-0" />
                        </>
                      ) : (
                        <>
                          <CreditCard className="shrink-0" size={20} />
                          <span className="flex-1 text-center">{(event.selectedTier?.price || event.displayPrice || 0) > 0 ? `Pay • ₹${event.selectedTier?.price || event.displayPrice}` : (event.startupFormEnabled && !registrationType) ? "Select Option Above" : "Confirm Ticket Booking"}</span>
                          <div className="w-5 shrink-0" />
                        </>
                      )}
                    </button>
                    
                    <div className="flex flex-col items-center gap-4 opacity-70">
                       <div className="flex items-center gap-2">
                          <ShieldCheck size={14} className="text-slate-400" />
                          <span className="text-[8px] text-slate-500 font-black uppercase tracking-[0.4em]">Secure Checkout Gateway</span>
                       </div>
                       <p className="text-center text-[8px] text-slate-400 font-black uppercase leading-relaxed tracking-[0.3em]">
                          Non-Refundable Ticket • Individual Assignment Only
                       </p>
                    </div>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default BookingModal;

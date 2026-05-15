import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";
import { useAuth } from "../../context/DiscussionAuth.context";
import { GOOGLE_CLIENT_ID } from "../../config";

const CustomModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut, loading } = useAuth();

  const closeModal = () => {
    setIsOpen(false);
  };

  const openModal = () => {
    setIsOpen(true);
  };

  const handleGoogleLogin = () => {
    const scope = encodeURIComponent("profile email openid");
    const redirectUri = encodeURIComponent(window.location.origin + "/");
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`;
    
    // Perform full page redirect
    window.location.assign(authUrl);
  };

  return (
    <>
      <button
        onClick={user ? signOut : openModal}
        disabled={loading}
        className="bg-premier-700 text-white px-2 py-1 text-sm rounded flex items-center gap-2 min-w-[80px] justify-center disabled:opacity-50"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : user ? (
          <>
            {user.picture && <img src={user.picture} alt="profile" className="w-5 h-5 rounded-full" />}
            <span className="hidden sm:inline">Hi, {user.name.split(" ")[0]}</span>
            <span className="text-[10px] opacity-70">(Sign Out)</span>
          </>
        ) : (
          "Sign In"
        )}
      </button>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="fixed inset-0 z-[9999] overflow-y-auto"
          onClose={closeModal}
        >
          <div className="min-h-screen flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-md" />
            </Transition.Child>

            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div className="relative w-full max-w-md p-10 bg-white/5 border border-white/10 rounded-[3rem] backdrop-blur-2xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] isolation-isolate">
                {/* Decorative Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
                
                <button
                  onClick={closeModal}
                  className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>

                <div className="text-center mb-12">
                   <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-4">Authentication Portal</p>
                   <h2 className="text-4xl font-black text-white uppercase tracking-tighter italic leading-none">
                     BACK<span className="text-indigo-500">STAGE</span>
                   </h2>
                </div>

                <div className="space-y-6">
                  <p className="text-center text-slate-400 text-xs font-medium leading-relaxed max-w-[240px] mx-auto">
                    Sign in to access your bookings, personalized events, and community threads.
                  </p>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="group relative w-full bg-white text-black font-black py-4 rounded-full flex items-center justify-center gap-4 transition-all hover:bg-indigo-600 hover:text-white active:scale-95 shadow-xl"
                  >
                    <img
                      src="https://in.bmscdn.com/webin/common/icons/googlelogo.svg"
                      alt="Google Logo"
                      className="w-5 h-5"
                    />
                    <span className="text-[11px] uppercase tracking-[0.2em]">Continue with Google</span>
                  </button>
                </div>

                {/* Terms & Conditions */}
                <div className="mt-12 pt-8 border-t border-white/5">
                  <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-loose">
                    By continuing, you agree to our <br/>
                    <a href="/legal?tab=terms" className="text-indigo-400 hover:text-white transition-colors">Terms of Service</a> & <a href="/legal?tab=privacy" className="text-indigo-400 hover:text-white transition-colors">Privacy Policy</a>
                  </p>
                </div>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default CustomModal;

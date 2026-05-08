/**
 * apps/events/src/pages/DiscussionList.Page.jsx
 *
 * Purpose: A dedicated page to view all community discussions across all events.
 * Provides a centralized hub for community feedback and engagement.
 */
import React from "react";
import DiscussionBoard from "../components/Discussion/DiscussionBoard";
import DefaultlayoutHoc from "../layout/Default.layout";
import { BiArrowBack } from "react-icons/bi";
import { Link } from "react-router-dom";

const DiscussionListPage = () => {
  return (
    <div className="bg-[#050507] min-h-screen pb-32 relative">
      {/* Background Glows */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-600/5 blur-[150px] rounded-full pointer-events-none"></div>

      <div className="container mx-auto px-6 md:px-12 py-24 relative z-10">
        <Link to="/" className="group inline-flex items-center gap-4 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.4em] mb-16 transition-all">
          <BiArrowBack className="group-hover:-translate-x-2 transition-transform" /> BACK TO HOME
        </Link>

        <div className="space-y-4 mb-20">
           <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.5em]">The Community Vault</p>
           <h1 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter italic">All Discussions</h1>
           <p className="text-slate-500 text-sm md:text-base font-medium max-w-xl leading-relaxed uppercase tracking-widest opacity-60">
             Explore every take, review, and conversation happening across the Backstage ecosystem.
           </p>
        </div>

        <div className="bg-black/20 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-20 shadow-3xl">
           <DiscussionBoard />
        </div>
      </div>
    </div>
  );
};

export default DefaultlayoutHoc(DiscussionListPage);

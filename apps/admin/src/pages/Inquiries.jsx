/**
 * apps/admin/src/pages/Inquiries.jsx
 *
 * Purpose: Contact and proposal management page for the Admin Panel.
 * Handles incoming support messages and event hosting proposals.
 * Allows admins to approve/reject proposals and manage support tickets.
 */
import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Send, CheckCircle2, Clock, 
  Trash2, ExternalLink, Filter, Search,
  AlertCircle, ChevronRight, User, Mail
} from 'lucide-react';
import { adminService } from '../services/api';

const TabButton = ({ active, onClick, icon: Icon, label, count }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-2 px-6 py-4 border-b-2 transition-all relative
      ${active 
        ? 'border-sky-500 text-white bg-sky-500/5' 
        : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'}
    `}
  >
    <Icon size={16} />
    <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
    {count > 0 && (
      <span className="ml-2 px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[9px] font-black">
        {count}
      </span>
    )}
  </button>
);

const InquiryCard = ({ data, type, onAction }) => {
  const isRequest = type === 'request';
  const date = new Date(data.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="group bg-zinc-900/40 border border-white/[0.03] rounded-2xl p-6 transition-all hover:bg-zinc-900/60 hover:border-white/[0.06]">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sky-400">
            {isRequest ? <Send size={18} /> : <MessageSquare size={18} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-200">
              {isRequest ? data.eventName : data.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-zinc-500 font-medium">{date}</span>
              <span className="text-zinc-700">•</span>
              <span className="text-[10px] text-zinc-500 font-medium">{data.email || data.contactEmail}</span>
            </div>
          </div>
        </div>

        {isRequest && (
          <div className={`
            px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border
            ${data.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
              data.status === 'rejected' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 
              'bg-amber-500/10 text-amber-500 border-amber-500/20'}
          `}>
            {data.status}
          </div>
        )}
      </div>

      <div className="bg-black/20 rounded-xl p-4 mb-6 border border-white/[0.02]">
        <p className="text-xs text-zinc-400 leading-relaxed italic">
          "{isRequest ? data.description : data.message}"
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRequest && data.status === 'pending' && (
            <>
              <button 
                onClick={() => onAction('approve', data._id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all"
              >
                <CheckCircle2 size={12} /> Approve
              </button>
              <button 
                onClick={() => onAction('reject', data._id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all"
              >
                <AlertCircle size={12} /> Reject
              </button>
            </>
          )}
          {!isRequest && (
            <button 
              onClick={() => onAction('delete', data._id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all"
            >
              <Trash2 size={12} /> Archive
            </button>
          )}
        </div>
        
        <a 
          href={`mailto:${isRequest ? data.contactEmail : data.email}`}
          className="flex items-center gap-2 text-[10px] font-bold text-sky-400 uppercase tracking-widest hover:text-sky-300 transition-colors"
        >
          Reply via Mail <ChevronRight size={12} />
        </a>
      </div>
    </div>
  );
};

const Inquiries = () => {
  const [activeTab, setActiveTab] = useState('support');
  const [data, setData] = useState({ contacts: [], requests: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const res = await adminService.getInquiries();
        if (isMounted) setData(res.data);
      } catch (err) {
        console.error('Failed to fetch inquiries:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    loadData();
    return () => { isMounted = false; };
  }, [refreshTrigger]);

  const handleAction = async (action, id) => {
    try {
      await adminService.handleInquiry(action, id, { status: action === 'approve' ? 'approved' : 'rejected' });
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      alert('Action failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const contacts = data?.contacts || [];
  const requests = data?.requests || [];

  const filteredData = activeTab === 'support' 
    ? contacts.filter(c => (c.name || '').toLowerCase().includes(filter.toLowerCase()) || (c.email || '').toLowerCase().includes(filter.toLowerCase()))
    : requests.filter(r => (r.eventName || '').toLowerCase().includes(filter.toLowerCase()) || (r.contactName || '').toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">Platform Inquiries</h1>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-[0.2em]">Manage support tickets and event proposals</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
            <input 
              type="text" 
              placeholder="Search inquiries..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-zinc-900 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs text-zinc-300 focus:outline-none focus:border-sky-500/50 transition-all min-w-[240px]"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.03] flex items-center gap-2">
        <TabButton 
          active={activeTab === 'support'} 
          onClick={() => setActiveTab('support')}
          icon={MessageSquare}
          label="Support Messages"
          count={contacts.length}
        />
        <TabButton 
          active={activeTab === 'proposals'} 
          onClick={() => setActiveTab('proposals')}
          icon={Send}
          label="Event Proposals"
          count={requests.filter(r => r.status === 'pending').length}
        />
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-white/[0.02] border border-white/[0.03] rounded-2xl" />
          ))}
        </div>
      ) : filteredData.length === 0 ? (
        <div className="py-24 text-center bg-white/[0.01] border border-dashed border-white/[0.05] rounded-[3rem]">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-zinc-700">
            <Clock size={32} />
          </div>
          <h3 className="text-xl font-bold text-zinc-300 uppercase tracking-tighter mb-2">No Inquiries Found</h3>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">You're all caught up! New messages will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredData.map(item => (
            <InquiryCard 
              key={item._id} 
              data={item} 
              type={activeTab === 'support' ? 'contact' : 'request'} 
              onAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Inquiries;

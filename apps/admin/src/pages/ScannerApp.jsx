import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
    QrCode, Download, WifiOff, Wifi, Search, 
    CheckCircle, XCircle, RefreshCw, X, LogOut, Check
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api'; // Using axios instance

const ScannerApp = () => {
    const { admin, logout } = useAuth();
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState(null);
    const [attendees, setAttendees] = useState([]);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null); // { valid: boolean, message: string, attendee: object }
    const [searchQuery, setSearchQuery] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [lastSyncTime, setLastSyncTime] = useState(null);

    const scannerRef = useRef(null);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        fetchEvents();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            stopScanner();
        };
    }, []);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/api/admin/scanner/events');
            setEvents(data);
            if (data.length === 1) handleSelectEvent(data[0]._id);
        } catch (e) {
            console.error('Failed to fetch events:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectEvent = async (eventId) => {
        setSelectedEventId(eventId);
        
        // Load offline data if available
        const localData = localStorage.getItem(`scanner_data_${eventId}`);
        if (localData) {
            setAttendees(JSON.parse(localData));
        }

        if (!isOffline) {
            await syncAttendees(eventId);
        }
    };

    const syncAttendees = async (eventId) => {
        try {
            setSyncing(true);
            
            // 1. Upload local check-ins if any
            const localData = JSON.parse(localStorage.getItem(`scanner_data_${eventId}`) || '[]');
            const pendingCheckIns = localData.filter(a => a.attended && a._pendingSync).map(a => a.ticketId);
            
            if (pendingCheckIns.length > 0) {
                const res = await api.post(`/api/admin/scanner/sync/${eventId}`, { checkIns: pendingCheckIns });
                console.log(`[SYNC] Uploaded ${res.data.updated} pending check-ins.`);
            }

            // 2. Download fresh data
            const { data } = await api.get(`/api/admin/scanner/attendees/${eventId}`);
            setAttendees(data);
            localStorage.setItem(`scanner_data_${eventId}`, JSON.stringify(data));
            setLastSyncTime(new Date());
            
            if (pendingCheckIns.length > 0) {
                alert(`Sync Complete! Successfully uploaded ${pendingCheckIns.length} check-ins.`);
            }
        } catch (e) {
            console.error('Sync failed:', e);
            const errorMsg = e.response?.data?.message || e.message || 'Unknown error';
            alert(`Sync Failed: ${errorMsg}. You can continue scanning offline.`);
        } finally {
            setSyncing(false);
        }
    };

    const startScanner = async () => {
        if (!selectedEventId) return alert('Select an event first');
        setScanning(true);
        setScanResult(null);

        try {
            const html5QrCode = new Html5Qrcode("reader");
            scannerRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                },
                (decodedText) => {
                    handleScan(decodedText);
                    // Pause after scan to show result
                    if (scannerRef.current) {
                        scannerRef.current.pause();
                    }
                },
                (errorMessage) => {
                    // ignore frequent read errors
                }
            );
        } catch (err) {
            console.error("Error starting scanner:", err);
            setScanning(false);
            alert("Camera access denied or unavailable.");
        }
    };

    const stopScanner = () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => {
                scannerRef.current.clear();
                scannerRef.current = null;
            });
        }
        setScanning(false);
    };

    const handleScan = (ticketId) => {
        const attendee = attendees.find(a => 
            a.ticketId === ticketId || a.transactionId === ticketId || String(a._id) === ticketId
        );

        if (!attendee) {
            setScanResult({ valid: false, message: 'TICKET NOT FOUND', attendee: null });
            playBeep(false);
            return;
        }

        if (attendee.attended) {
            setScanResult({ valid: false, message: 'ALREADY SCANNED', attendee });
            playBeep(false);
            return;
        }

        // Mark as attended
        const updatedAttendees = attendees.map(a => 
            a.ticketId === attendee.ticketId ? { ...a, attended: true, _pendingSync: true } : a
        );
        
        setAttendees(updatedAttendees);
        localStorage.setItem(`scanner_data_${selectedEventId}`, JSON.stringify(updatedAttendees));
        
        setScanResult({ valid: true, message: 'ACCESS GRANTED', attendee });
        playBeep(true);
        
        // Background sync if online
        if (!isOffline) {
            api.post(`/api/admin/scanner/sync/${selectedEventId}`, { checkIns: [attendee.ticketId] })
                .then(() => {
                    // Remove pending sync flag
                    const syncd = updatedAttendees.map(a => 
                        a.ticketId === attendee.ticketId ? { ...a, _pendingSync: false } : a
                    );
                    setAttendees(syncd);
                    localStorage.setItem(`scanner_data_${selectedEventId}`, JSON.stringify(syncd));
                }).catch(err => console.error("Bg sync failed", err));
        }
    };

    const playBeep = (valid) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            if (valid) {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.2);
            } else {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, ctx.currentTime); // Low buzz
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.4);
            }
        } catch (e) {
            console.warn("Audio not supported");
        }
    };

    const resumeScanning = () => {
        setScanResult(null);
        if (scannerRef.current) {
            scannerRef.current.resume();
        }
    };

    const manualCheckIn = (attendee) => {
        if (attendee.attended) return;
        handleScan(attendee.ticketId);
    };

    const filteredAttendees = attendees.filter(a => {
        if (!searchQuery) return false; // Only show when searching
        const query = searchQuery.toLowerCase();
        return (a.name || '').toLowerCase().includes(query) ||
               (a.email || '').toLowerCase().includes(query) ||
               (a.phone || '').toLowerCase().includes(query) ||
               (a.ticketId || '').toLowerCase().includes(query);
    });

    const pendingSyncCount = attendees.filter(a => a._pendingSync).length;
    const scannedCount = attendees.filter(a => a.attended).length;

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
            <RefreshCw className="animate-spin text-emerald-500 mb-4" size={40} />
            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-500">Initializing Scanner</p>
        </div>
    );

    if (!selectedEventId) {
        return (
            <div className="min-h-screen bg-slate-950 text-white p-6 pb-24">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-black uppercase tracking-tighter">Scanner App</h1>
                    <button onClick={logout} className="p-2 bg-slate-900 rounded-xl text-slate-400 hover:text-rose-500">
                        <LogOut size={20} />
                    </button>
                </div>
                
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Select Event to Scan</h2>
                <div className="space-y-4">
                    {events.map(ev => (
                        <button 
                            key={ev._id}
                            onClick={() => handleSelectEvent(ev._id)}
                            className="w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left hover:border-emerald-500/50 transition-all flex items-center justify-between group"
                        >
                            <div>
                                <h3 className="font-bold text-lg">{ev.title || ev.name}</h3>
                                <p className="text-xs text-slate-400 mt-1">{new Date(ev.date).toLocaleDateString()}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-emerald-500/20 group-hover:text-emerald-500 transition-colors">
                                <QrCode size={18} />
                            </div>
                        </button>
                    ))}
                    {events.length === 0 && (
                        <div className="text-center p-8 bg-slate-900 rounded-3xl border border-slate-800">
                            <p className="text-slate-400 text-sm">No events assigned to you.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => { stopScanner(); setSelectedEventId(null); }} className="p-2 -ml-2 rounded-xl text-slate-400 hover:bg-slate-800">
                        <X size={20} />
                    </button>
                    <div>
                        <h1 className="text-sm font-bold uppercase tracking-tight truncate max-w-[150px]">
                            {events.find(e => e._id === selectedEventId)?.title}
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            {isOffline ? (
                                <span className="flex items-center gap-1 text-[9px] font-black text-rose-500 uppercase tracking-widest"><WifiOff size={10} /> Offline</span>
                            ) : (
                                <div className="flex flex-col">
                                    <span className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase tracking-widest"><Wifi size={10} /> Online</span>
                                    {lastSyncTime && (
                                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">Sync: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="text-right mr-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scanned</p>
                        <p className="text-sm font-black">{scannedCount} <span className="text-slate-600">/ {attendees.length}</span></p>
                    </div>
                    <button 
                        onClick={() => syncAttendees(selectedEventId)} 
                        disabled={isOffline || syncing}
                        className={`p-3 rounded-xl border flex items-center justify-center transition-all ${
                            pendingSyncCount > 0 
                                ? 'bg-amber-500/20 border-amber-500/30 text-amber-500' 
                                : 'bg-slate-800 border-slate-700 text-emerald-500'
                        }`}
                    >
                        {syncing ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
                        {pendingSyncCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">{pendingSyncCount}</span>}
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
                
                {/* Scanner View */}
                {!scanning && !scanResult && (
                    <div className="flex-1 w-full flex flex-col items-center justify-center">
                        <button 
                            onClick={startScanner}
                            className="w-48 h-48 bg-emerald-500/10 border-2 border-emerald-500 rounded-[3rem] flex flex-col items-center justify-center text-emerald-500 gap-4 hover:bg-emerald-500/20 hover:scale-105 transition-all shadow-[0_0_50px_rgba(16,185,129,0.2)]"
                        >
                            <QrCode size={64} />
                            <span className="font-black tracking-[0.2em] uppercase text-xs">Tap to Scan</span>
                        </button>
                    </div>
                )}

                <div 
                    id="reader" 
                    className={`w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl ${scanning && !scanResult ? 'block' : 'hidden'}`}
                    style={{ border: '4px solid #10b981' }}
                ></div>
                
                {scanning && !scanResult && (
                    <button onClick={stopScanner} className="mt-6 px-6 py-3 bg-slate-800 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400">Cancel Scan</button>
                )}

                {/* Scan Result Popup */}
                {scanResult && (
                    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 animate-in slide-in-from-bottom-10 fade-in duration-300">
                        <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 shadow-2xl ${scanResult.valid ? 'bg-emerald-500/20 text-emerald-500 shadow-emerald-500/20' : 'bg-rose-500/20 text-rose-500 shadow-rose-500/20'}`}>
                            {scanResult.valid ? <CheckCircle size={80} /> : <XCircle size={80} />}
                        </div>
                        
                        <h2 className={`text-4xl font-black uppercase tracking-tighter mb-2 ${scanResult.valid ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {scanResult.message}
                        </h2>
                        
                        {scanResult.attendee && (
                            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl w-full max-w-sm mt-6 text-center">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Attendee Name</p>
                                <p className="text-2xl font-bold text-white uppercase mb-4">{scanResult.attendee.name}</p>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Ticket ID</p>
                                        <p className="text-xs font-mono text-slate-300">#{scanResult.attendee.ticketId}</p>
                                    </div>
                                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tier</p>
                                        <p className="text-xs font-bold text-slate-300 uppercase">{scanResult.attendee.tierName || 'Standard'}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="w-full max-w-sm mt-12 space-y-4">
                            <button 
                                onClick={resumeScanning}
                                className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-xl ${scanResult.valid ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/50'}`}
                            >
                                Scan Next
                            </button>
                            <button 
                                onClick={() => { stopScanner(); setScanResult(null); }}
                                className="w-full py-4 rounded-2xl bg-slate-900 border border-slate-800 font-bold text-xs uppercase tracking-widest text-slate-400 hover:text-white"
                            >
                                Close Scanner
                            </button>
                        </div>
                    </div>
                )}

                {/* Manual Search Section */}
                {!scanning && !scanResult && (
                    <div className="w-full max-w-sm mt-12">
                        <div className="relative mb-6">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search size={16} className="text-slate-500" />
                            </div>
                            <input 
                                type="text"
                                placeholder="Search by Name, Email, or Ticket ID..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white">
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {searchQuery && (
                            <div className="space-y-3 pb-8">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-2">Search Results</p>
                                {filteredAttendees.length === 0 ? (
                                    <div className="text-center p-6 bg-slate-900 rounded-2xl border border-slate-800">
                                        <p className="text-slate-400 text-xs font-medium">No attendees found.</p>
                                    </div>
                                ) : (
                                    filteredAttendees.map(a => (
                                        <div key={a._id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group">
                                            <div className="overflow-hidden pr-2">
                                                <p className="font-bold text-sm truncate uppercase">{a.name}</p>
                                                <p className="text-[10px] text-slate-500 mt-0.5 truncate">{a.email}</p>
                                            </div>
                                            {a.attended ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                                                        <Check size={12} /> Checked In
                                                    </span>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => manualCheckIn(a)}
                                                    className="shrink-0 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-colors"
                                                >
                                                    Check In
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScannerApp;

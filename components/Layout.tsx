
import React, { useState, useEffect } from 'react';
import { AppDatabase, SRSStatus } from '../types';
import { playSfx } from '../services/audioService';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Home, ArrowLeft, Settings, Book, Flame, Layers, CheckCircle } from 'lucide-react';
import { getRankByCount } from '../services/storageService';

interface LayoutProps {
    title: string;
    onHome: () => void;
    onBack?: () => void;
    onSettings: () => void;
    children: React.ReactNode;
    showBack?: boolean;
    showHome?: boolean;
    onOpenRules?: () => void;
    db: AppDatabase;
    onCheckIn?: () => void;
}

// --- GLOBAL TIMER WIDGET ---
const TimerWidget = () => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [mode, setMode] = useState<'clock' | 'stopwatch' | 'timer'>('clock');
    
    // Stopwatch
    const [swTime, setSwTime] = useState(0);
    const [swRunning, setSwRunning] = useState(false);

    // Timer
    const [tmTime, setTmTime] = useState(0); // ms
    const [tmMinutes, setTmMinutes] = useState(5);
    const [tmSeconds, setTmSeconds] = useState(0);
    const [tmRunning, setTmRunning] = useState(false);
    const [isAlarming, setIsAlarming] = useState(false);

    // Clock
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleOpen = () => {
            setIsExpanded(true);
            setIsPanelOpen(true);
        };
        window.addEventListener('open-timer', handleOpen);
        return () => window.removeEventListener('open-timer', handleOpen);
    }, []);

    // Stopwatch Logic
    useEffect(() => {
        let interval: any;
        if (swRunning) {
            interval = setInterval(() => setSwTime(prev => prev + 100), 100);
        }
        return () => clearInterval(interval);
    }, [swRunning]);

    // Timer Logic
    useEffect(() => {
        let interval: any;
        if (tmRunning) {
            interval = setInterval(() => {
                setTmTime(prev => {
                    if (prev <= 1000) {
                        setTmRunning(false);
                        triggerAlarm();
                        return 0;
                    }
                    return prev - 1000;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [tmRunning]);

    const triggerAlarm = () => {
        setIsAlarming(true);
        document.body.classList.add('animate-shake'); 
        playSfx(1000, 'sawtooth', 0.5);
        // Loop sound
        const alarmLoop = setInterval(() => {
             playSfx(800, 'square', 0.2);
             playSfx(1200, 'square', 0.2);
        }, 500);
        (window as any)._alarmLoop = alarmLoop;
    };

    const stopAlarm = () => {
        setIsAlarming(false);
        document.body.classList.remove('animate-shake');
        if ((window as any)._alarmLoop) clearInterval((window as any)._alarmLoop);
    };

    const formatTime = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const startTimer = () => {
        setTmTime((tmMinutes * 60 + tmSeconds) * 1000);
        setTmRunning(true);
        setIsAlarming(false);
    };

    const isRunning = swRunning || swTime > 0 || tmRunning || tmTime > 0 || isAlarming;

    if (!isExpanded && !isRunning) return null;

    return (
        <div className="absolute top-4 right-4 z-[90] flex flex-col items-end pointer-events-none">
            {/* Widget Button */}
            <div className="pointer-events-auto">
                {!isExpanded && isRunning ? (
                    <button 
                        onClick={() => { setIsExpanded(true); setIsPanelOpen(true); }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-all backdrop-blur-md ${isAlarming ? 'bg-red-600 text-white animate-pulse border-red-400' : 'bg-black/50 border-white/10 hover:border-neon-cyan/50 text-white'}`}
                    >
                        <i className={`fas ${mode === 'stopwatch' ? 'fa-stopwatch' : 'fa-hourglass-half'} ${isAlarming ? 'text-white' : 'text-neon-cyan'} text-[10px]`}></i>
                        <span className={`text-xs font-digital font-bold tracking-wider ${isAlarming ? 'text-white' : 'text-white'}`}>
                            {mode === 'stopwatch' && (swTime / 1000).toFixed(1) + 's'}
                            {mode === 'timer' && (isAlarming ? "BÁO THỨC" : formatTime(tmTime))}
                            {mode === 'clock' && now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </button>
                ) : isExpanded ? (
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setIsPanelOpen(!isPanelOpen)} 
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-[0_0_10px_rgba(0,0,0,0.5)] min-w-[100px] justify-center transition-all backdrop-blur-md ${isAlarming ? 'bg-red-600 text-white animate-pulse border-red-400' : 'bg-black/80 border-white/10 hover:border-neon-cyan/50 text-white'}`}
                            >
                                <i className={`fas ${mode === 'clock' ? 'fa-clock' : mode === 'stopwatch' ? 'fa-stopwatch' : 'fa-hourglass-half'} ${isAlarming ? 'text-white' : 'text-neon-cyan'} text-[9px]`}></i>
                                <span className={`text-xs font-digital font-bold tracking-wider ${isAlarming ? 'text-white' : 'text-white'}`}>
                                    {mode === 'clock' && now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    {mode === 'stopwatch' && (swTime / 1000).toFixed(1) + 's'}
                                    {mode === 'timer' && (isAlarming ? "BÁO THỨC" : formatTime(tmTime))}
                                </span>
                            </button>
                            <button 
                                onClick={() => { setIsExpanded(false); setIsPanelOpen(false); }}
                                className="w-8 h-8 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg flex items-center justify-center hover:bg-white/10 transition text-slate-400 hover:text-white"
                            >
                                <i className="fas fa-times text-[12px]"></i>
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Dropdown Panel */}
            {isPanelOpen && isExpanded && (
                <div className="pointer-events-auto mt-2 w-64 bg-[#0a0a0a]/95 border border-neon-purple/50 rounded-xl shadow-[0_0_30px_rgba(188,19,254,0.3)] p-4 animate-slide-up backdrop-blur-xl z-50">
                    <div className="flex justify-between mb-4 border-b border-white/10 pb-2">
                         <button onClick={() => setMode('clock')} className={`text-[9px] uppercase font-black ${mode === 'clock' ? 'text-neon-cyan glow-text' : 'text-slate-500'}`}>Giờ</button>
                         <button onClick={() => setMode('stopwatch')} className={`text-[9px] uppercase font-black ${mode === 'stopwatch' ? 'text-neon-cyan glow-text' : 'text-slate-500'}`}>Bấm giờ</button>
                         <button onClick={() => setMode('timer')} className={`text-[9px] uppercase font-black ${mode === 'timer' ? 'text-neon-cyan glow-text' : 'text-slate-500'}`}>Hẹn giờ</button>
                    </div>

                    <div className="text-center">
                        {mode === 'clock' && (
                            <div className="space-y-2">
                                <div className="text-[10px] font-black text-slate-500 uppercase">
                                    {now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </div>
                                <div className="text-3xl font-digital font-bold text-white tracking-widest glow-text">
                                    {now.toLocaleTimeString('en-US', { hour12: false })}
                                </div>
                            </div>
                        )}

                        {mode === 'stopwatch' && (
                            <div className="space-y-3">
                                <div className="text-3xl font-digital font-bold text-neon-lime glow-text">
                                    {(swTime / 1000).toFixed(1)}<span className="text-xs text-slate-500 ml-1">s</span>
                                </div>
                                <div className="flex gap-2 justify-center">
                                    <button onClick={() => setSwRunning(!swRunning)} className={`px-3 py-1.5 rounded font-bold uppercase text-[10px] border ${swRunning ? 'bg-red-900/50 border-red-500 text-red-400' : 'bg-green-900/50 border-green-500 text-green-400'}`}>
                                        {swRunning ? 'DỪNG' : 'CHẠY'}
                                    </button>
                                    <button onClick={() => { setSwRunning(false); setSwTime(0); }} className="px-3 py-1.5 bg-white/10 text-slate-300 rounded font-bold uppercase text-[10px] border border-white/10">Đặt lại</button>
                                </div>
                            </div>
                        )}

                        {mode === 'timer' && (
                            <div className="space-y-3">
                                {isAlarming ? (
                                    <button onClick={stopAlarm} className="w-full py-3 bg-red-600 animate-pulse text-white font-black text-lg uppercase rounded-xl shadow-[0_0_20px_red]">
                                        TẮT BÁO THỨC
                                    </button>
                                ) : (
                                    <>
                                        {tmRunning ? (
                                            <div className="text-3xl font-digital font-bold text-neon-amber glow-text">{formatTime(tmTime)}</div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="flex flex-col items-center">
                                                    <input 
                                                        type="number" 
                                                        value={tmMinutes} 
                                                        onChange={(e) => setTmMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                                                        className="w-12 bg-black/50 border border-neon-cyan/50 rounded p-1.5 text-center text-white font-bold font-digital text-lg outline-none focus:border-neon-cyan focus:shadow-[0_0_10px_#00f3ff]"
                                                    />
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase mt-1">Phút</span>
                                                </div>
                                                <span className="text-xl font-bold text-slate-600">:</span>
                                                <div className="flex flex-col items-center">
                                                    <input 
                                                        type="number" 
                                                        value={tmSeconds} 
                                                        onChange={(e) => setTmSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                                                        className="w-12 bg-black/50 border border-neon-cyan/50 rounded p-1.5 text-center text-white font-bold font-digital text-lg outline-none focus:border-neon-cyan focus:shadow-[0_0_10px_#00f3ff]"
                                                    />
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase mt-1">Giây</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex gap-2 justify-center">
                                            {tmRunning ? (
                                                <button onClick={() => setTmRunning(false)} className="px-3 py-1.5 bg-red-900/50 border border-red-500 text-red-400 rounded font-bold uppercase text-[10px]">Dừng</button>
                                            ) : (
                                                <button onClick={startTimer} className="px-3 py-1.5 bg-neon-purple/20 border border-neon-purple text-neon-purple rounded font-bold uppercase text-[10px] hover:bg-neon-purple/40">Bắt đầu</button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export const Layout: React.FC<LayoutProps> = ({ title, onHome, onBack, onSettings, children, showBack, showHome = true, onOpenRules, db, onCheckIn }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isTopBarOpen, setIsTopBarOpen] = useState(false);
    const [isBackButtonVisible, setIsBackButtonVisible] = useState(true);
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());

    const today = new Date().toISOString().split('T')[0];
    const wordsStudiedToday = db.studyLog[today] || 0;
    const hasCheckedInToday = db.stats.checkIns?.includes(today) || false;
    const canCheckIn = wordsStudiedToday >= 20 && !hasCheckedInToday;

    const handleCheckIn = () => {
        if (canCheckIn && onCheckIn) {
            onCheckIn();
            playSfx(800, 'square', 0.1);
        }
    };

    // Calendar logic
    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    
    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setViewDate(newDate);
    };
    
    const calendarDays = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push(i);
    }

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const handleActivity = (e: any) => {
            let clientX, clientY;
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else if (e.clientX !== undefined) {
                clientX = e.clientX;
                clientY = e.clientY;
            } else {
                return;
            }

            // Check if interaction is in the top-left area (left half, top third)
            const isTopLeft = clientX < window.innerWidth / 2 && clientY < window.innerHeight / 3;
            
            if (isTopLeft) {
                setIsBackButtonVisible(true);
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    setIsBackButtonVisible(false);
                }, 2000);
            }
        };

        // Initial setup
        setIsBackButtonVisible(true);
        timeoutId = setTimeout(() => setIsBackButtonVisible(false), 2000);

        // Add event listeners for user activity
        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('touchstart', handleActivity);

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('touchstart', handleActivity);
        };
    }, []);

    // Stats calculation for Sidebar
    const { streak } = db.stats;
    const totalVocab = db.vocab.filter(v => v.type === 'vocab').length;
    const masteredCount = (Object.values(db.srs) as SRSStatus[]).filter(s => s.status === 'review').length;
    const progressPercent = totalVocab > 0 ? (masteredCount / totalVocab) * 100 : 0;
    const rankInfo = getRankByCount(masteredCount);

    const SidebarItem = ({ icon: Icon, label, value, iconColor, borderColor, bgColor, sublabel, onClick }: any) => {
        const Wrapper = onClick ? 'button' : 'div';
        return (
            <Wrapper 
                onClick={onClick}
                className={`flex items-center gap-4 p-4 rounded-2xl bg-white/5 border ${borderColor || 'border-white/10'} w-full text-left ${onClick ? 'hover:bg-white/10 transition cursor-pointer active:scale-95' : ''}`}
            >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgColor || 'bg-black/40'} ${iconColor} shadow-[0_0_15px_currentColor]`}>
                    <Icon size={20} />
                </div>
                <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black text-white font-digital">{value}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
                    </div>
                    {sublabel && <span className="text-[8px] font-bold text-slate-500 uppercase">{sublabel}</span>}
                </div>
            </Wrapper>
        );
    };

    return (
        <div className="h-[100dvh] w-full flex flex-col font-sans relative overflow-hidden text-slate-100 bg-black">
            {/* BACKGROUND: Pure Black */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-black">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(20,20,20,0.5)1px,transparent_1px),linear-gradient(90deg,rgba(20,20,20,0.5)1px,transparent_1px)] bg-[size:40px_40px] opacity-20"></div>
            </div>

            {/* Sidebar Overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[200]"
                    />
                )}
            </AnimatePresence>

            <motion.aside 
                initial={false}
                animate={{ x: isSidebarOpen ? 0 : '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute top-0 left-0 h-full w-72 bg-[#0A0A0A] border-r border-white/10 z-[210] p-6 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-y-auto custom-scrollbar"
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-sm font-black uppercase tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 truncate pr-2 drop-shadow-md">
                        {title !== "KOTOBA MASTER PRO" ? title : "Dashboard"}
                    </h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 hover:text-white transition shrink-0">
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation Buttons */}
                <div className="flex flex-col gap-2 mb-6">
                    {showHome && (
                        <button 
                            onClick={() => { onHome(); setIsSidebarOpen(false); }}
                            className="w-full py-3 flex items-center justify-center gap-3 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition"
                        >
                            <Home size={16} /> Trang chủ
                        </button>
                    )}
                    <button 
                        onClick={() => { window.dispatchEvent(new CustomEvent('open-timer')); setIsSidebarOpen(false); }}
                        className="w-full py-3 flex items-center justify-center gap-3 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition text-neon-cyan"
                    >
                        <i className="fas fa-clock text-base"></i> Đồng hồ / Bấm giờ
                    </button>
                </div>

                {/* Rank Info */}
                <div className={`p-5 rounded-2xl border-2 bg-slate-900/50 mb-6 flex flex-col items-center text-center ${rankInfo.color.replace('text-', 'border-') || 'border-white/10'} shadow-[0_0_20px_rgba(0,0,0,0.3)]`}>
                    <div className="text-4xl mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{rankInfo.icon}</div>
                    <div className={`text-xs font-black uppercase tracking-widest ${rankInfo.color}`}>{rankInfo.title}</div>
                    <div className="text-[9px] font-bold text-slate-500 mt-1">Đã thuộc {masteredCount} từ vựng</div>
                </div>

                <div className="flex-none mb-6 space-y-3">
                    <SidebarItem 
                        icon={Flame} 
                        label="Chuỗi" 
                        value={streak} 
                        iconColor="text-orange-500 animate-pulse" 
                        borderColor="border-orange-500" 
                        bgColor="bg-orange-500/20"
                        sublabel="Ngày liên tiếp" 
                        onClick={() => setShowCheckInModal(true)} 
                    />
                    <SidebarItem 
                        icon={Layers} 
                        label="Tổng từ" 
                        value={totalVocab} 
                        iconColor="text-neon-cyan" 
                        borderColor="border-neon-cyan/50" 
                        bgColor="bg-neon-cyan/10"
                        sublabel="Toàn bộ từ vựng" 
                    />
                    <SidebarItem 
                        icon={CheckCircle} 
                        label="Tiến độ" 
                        value={`${Math.round(progressPercent)}%`} 
                        iconColor="text-neon-lime" 
                        borderColor="border-neon-lime/50" 
                        bgColor="bg-neon-lime/10"
                        sublabel="Tỉ lệ hoàn thành" 
                    />
                </div>

                <div className="mt-auto pt-6 border-t border-white/10">
                    <button 
                        onClick={() => { onSettings(); setIsSidebarOpen(false); }}
                        className="w-full py-3 flex items-center justify-center gap-3 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition"
                    >
                        <Settings size={14} /> Cài đặt
                    </button>
                </div>
            </motion.aside>

            {/* Edge Handle to open Sidebar */}
            <div className={`absolute top-1/4 left-0 -translate-y-1/2 z-[100] flex items-center transition-opacity duration-500 ${isBackButtonVisible ? 'opacity-100' : 'opacity-15'}`}>
                <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsSidebarOpen(true)} 
                    className="w-6 h-24 bg-black/50 backdrop-blur-md border border-white/10 border-l-0 rounded-r-2xl flex items-center justify-center hover:bg-white/10 transition shadow-[2px_0_10px_rgba(0,0,0,0.5)] group"
                >
                    <div className="w-1.5 h-10 bg-white/20 rounded-full group-hover:bg-neon-cyan transition-colors"></div>
                </motion.button>
            </div>

            {/* Floating Back Button (iPhone style) */}
            {showBack && onBack && (
                <div className={`absolute top-4 left-4 z-[90] transition-opacity duration-500 ${isBackButtonVisible ? 'opacity-100' : 'opacity-15'}`}>
                    <button 
                        onClick={onBack} 
                        className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition text-xs font-black uppercase tracking-widest bg-black/50 backdrop-blur-md px-3 py-2 rounded-full border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                    >
                        <i className="fas fa-chevron-left"></i> Quay lại
                    </button>
                </div>
            )}

            {/* Timer Widget in Top Right */}
            <TimerWidget />

            {/* Main Content */}
            <main className="flex-1 relative overflow-hidden z-10 flex flex-col">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={title}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="flex-1 relative flex flex-col"
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Check-In Modal */}
            <AnimatePresence>
                {showCheckInModal && (
                    <div className="absolute inset-0 z-[300] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => setShowCheckInModal(false)}
                        />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-2xl flex flex-col items-center text-center"
                        >
                            <button onClick={() => setShowCheckInModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition">
                                <i className="fas fa-times"></i>
                            </button>
                            
                            <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center mb-4 border border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.5)] animate-pulse">
                                <i className="fas fa-fire text-4xl text-orange-500"></i>
                            </div>
                            
                            <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Điểm Danh</h2>
                            <p className="text-sm text-slate-400 mb-6">Học ít nhất 20 từ mỗi ngày để duy trì chuỗi học tập của bạn.</p>
                            
                            {/* Calendar View */}
                            <div className="w-full bg-black/50 rounded-2xl p-4 mb-6 border border-white/5">
                                <div className="flex justify-between items-center mb-4">
                                    <button onClick={() => changeMonth(-1)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition">
                                        <i className="fas fa-chevron-left"></i>
                                    </button>
                                    <div className="text-xs font-black text-white uppercase tracking-widest">Tháng {currentMonth + 1} / {currentYear}</div>
                                    <button onClick={() => changeMonth(1)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition">
                                        <i className="fas fa-chevron-right"></i>
                                    </button>
                                </div>
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => (
                                        <div key={d} className="text-[10px] font-bold text-slate-500">{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {calendarDays.map((day, i) => {
                                        if (day === null) return <div key={`empty-${i}`} className="aspect-square"></div>;
                                        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        const isCheckedIn = db.stats.checkIns?.includes(dateStr);
                                        const isToday = dateStr === today;
                                        const isPast = new Date(dateStr) < new Date(today);
                                        
                                        let dayClass = "text-slate-500 border border-transparent"; // Default future/empty
                                        
                                        if (isCheckedIn) {
                                            dayClass = "bg-black border border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)] relative overflow-hidden";
                                        } else if (isToday) {
                                            dayClass = "bg-gradient-to-br from-yellow-400 to-orange-500 border-2 border-white text-black font-black shadow-[0_0_20px_rgba(249,115,22,0.6)] scale-110 z-10";
                                        } else if (isPast) {
                                            dayClass = "bg-black border border-red-500 text-white opacity-60";
                                        }

                                        return (
                                            <div 
                                                key={day} 
                                                className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-all ${dayClass}`}
                                            >
                                                {day}
                                                {isCheckedIn && <i className="fas fa-check absolute text-[20px] text-green-500/20 pointer-events-none"></i>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="w-full bg-black/50 rounded-2xl p-4 mb-6 border border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Tiến độ hôm nay</span>
                                    <span className="text-xs font-black text-orange-400">{wordsStudiedToday} / 20 từ</span>
                                </div>
                                <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                                    <div 
                                        className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all duration-1000 shadow-[0_0_15px_rgba(249,115,22,0.5)]"
                                        style={{ width: `${Math.min(100, (wordsStudiedToday / 20) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                            
                            {hasCheckedInToday ? (
                                <div className="w-full py-4 bg-emerald-900/30 border border-emerald-500/50 rounded-xl text-emerald-400 font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                    <i className="fas fa-check-circle"></i> Đã Điểm Danh
                                </div>
                            ) : canCheckIn ? (
                                <button 
                                    onClick={handleCheckIn}
                                    className="w-full py-4 bg-orange-500 text-white rounded-xl font-black uppercase tracking-widest hover:bg-orange-600 transition shadow-[0_0_20px_rgba(249,115,22,0.4)] active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <i className="fas fa-fire"></i> Điểm Danh Ngay
                                </button>
                            ) : (
                                <div className="w-full py-4 bg-slate-800 border border-slate-700 rounded-xl text-slate-500 font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                    <i className="fas fa-lock"></i> Cần học thêm {Math.max(0, 20 - wordsStudiedToday)} từ
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

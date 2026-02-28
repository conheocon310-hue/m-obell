
import React, { useMemo, useState } from 'react';
import { AppDatabase } from '../../types';
import { getDueVocab } from '../../services/storageService';
import { motion } from 'motion/react';

interface DashboardProps {
    db: AppDatabase;
    onChangeView: (view: any) => void;
    onStartLesson: (lessonId: string | 'FAV' | 'SRS') => void;
    onCheckIn?: () => void;
    onOpenFav?: () => void;
}

export const DashboardView: React.FC<DashboardProps> = ({ db, onChangeView, onStartLesson, onCheckIn, onOpenFav }) => {
    const { lastStudyDate } = db.stats;
    const dueItems = getDueVocab(db);
    const dueCount = dueItems.length;
    const [showCalendar, setShowCalendar] = useState(false);
    const [displayDate, setDisplayDate] = useState(new Date());

    const lastLessonId = db.config.lastLessonId;

    const BentoBlock = ({ children, className = "", onClick, colorClass = "border-white/10" }: any) => (
        <motion.div 
            whileTap={onClick ? { scale: 0.98 } : {}}
            onClick={onClick}
            className={`
                relative bg-slate-900/80 backdrop-blur-2xl rounded-2xl border-2 ${colorClass} 
                overflow-hidden transition-all duration-300 group
                ${onClick ? 'cursor-pointer hover:bg-white/5' : ''}
                ${className}
            `}
        >
            {children}
        </motion.div>
    );

    // Calendar Data - Full Month Grid with Navigation
    const calendarData = useMemo(() => {
        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        const today = new Date();
        
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
        
        const days = [];
        // Empty slots for start of week
        for (let i = 0; i < firstDayOfWeek; i++) {
            days.push(null);
        }
        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            // Shift timezone to ensure local day match for keys
            const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
            const localIso = offsetDate.toISOString().split('T')[0];
            const count = db.studyLog?.[localIso] || 0;
            const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
            
            days.push({ dayNum: i, count, iso: localIso, isToday });
        }
        return { year, month, days };
    }, [db.studyLog, displayDate]);

    const changeMonth = (delta: number) => {
        setDisplayDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + delta);
            return newDate;
        });
    };

    const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

    return (
        <section className="absolute inset-0 flex flex-col p-3 md:p-6 gap-4 overflow-hidden animate-slide-up bg-transparent relative">
            <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pb-20 w-full max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row gap-4 shrink-0">
                    <BentoBlock 
                        onClick={() => dueCount > 0 ? onStartLesson('SRS') : onChangeView('lesson-list')}
                        className={`flex-[2] relative flex flex-col justify-center items-center px-8 py-6 transition-all duration-500 overflow-hidden shrink-0 ${dueCount > 0 ? 'bg-slate-900/40 backdrop-blur-md' : 'bg-slate-900/40 backdrop-blur-md'}`}
                        colorClass={dueCount > 0 ? 'border-red-500 shadow-[0_0_30px_rgba(244,63,94,0.3)]' : 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.3)]'}
                    >
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
                        <div className="text-[10px] font-black uppercase tracking-[0.5em] mb-2 relative z-10 glow-text text-white text-center">
                            {dueCount > 0 ? 'NHIỆM VỤ ƯU TIÊN' : 'HÀNH TRÌNH TIẾP THEO'}
                        </div>
                        <div className="flex items-baseline gap-4 mb-4 relative z-10">
                            <span className={`text-6xl lg:text-8xl font-digital font-bold text-white drop-shadow-2xl leading-none`}>
                                {dueCount > 0 ? dueCount : 'READY'}
                            </span>
                            <span className="text-sm font-black text-white/80 uppercase tracking-widest origin-bottom-left" style={{ transform: 'rotate(90deg) translate(0px, -15px)' }}>{dueCount > 0 ? 'THẺ' : 'BÀI'}</span>
                        </div>
                        <div className={`flex items-center gap-3 text-xs font-bold text-white bg-gradient-to-r ${dueCount > 0 ? 'from-red-600 via-rose-600 to-pink-600' : 'from-indigo-600 via-blue-600 to-cyan-600'} px-8 py-3 rounded-full shadow-lg group-hover:scale-110 transition duration-300 relative z-10 border border-white/30`}>
                            <span className="animate-pulse">{dueCount > 0 ? 'ÔN TẬP NGAY' : 'BẮT ĐẦU HỌC'}</span>
                            <i className={`fas ${dueCount > 0 ? 'fa-bolt' : 'fa-play'}`}></i>
                        </div>
                    </BentoBlock>

                    {lastLessonId && (
                        <BentoBlock 
                            onClick={() => onStartLesson(lastLessonId)}
                            className="flex-1 bg-slate-900/40 backdrop-blur-md flex flex-col items-center justify-center group py-4 shrink-0 relative overflow-hidden"
                            colorClass="border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                        >
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent"></div>
                            <div className="text-[8px] font-black text-emerald-300 uppercase tracking-widest mb-1 opacity-80 relative z-10">Học tiếp</div>
                            <div className="text-5xl font-black text-white italic tracking-tighter mb-3 group-hover:text-emerald-300 transition-colors relative z-10 text-shadow-lg">BÀI {lastLessonId}</div>
                            <div className="text-[8px] font-bold text-emerald-950 bg-emerald-400 px-4 py-1.5 rounded-full uppercase tracking-[0.2em] group-hover:bg-white group-hover:text-emerald-600 transition-all relative z-10 shadow-lg">TIẾP TỤC</div>
                        </BentoBlock>
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
                    <BentoBlock onClick={() => onChangeView('lesson-list')} colorClass="border-cyan-400 hover:border-white shadow-[0_0_20px_rgba(34,211,238,0.3)]" className="aspect-[2/1] md:aspect-square flex flex-col items-center justify-center gap-2 group p-4 bg-slate-900/40 backdrop-blur-md">
                        <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center mb-1 group-hover:bg-cyan-500/30 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                            <i className="fas fa-map-signs text-2xl md:text-3xl text-cyan-400 group-hover:scale-110 transition"></i>
                        </div>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest text-center">Lộ trình</span>
                    </BentoBlock>
                    <BentoBlock onClick={() => onChangeView('kanji-explorer')} colorClass="border-amber-500 hover:border-white shadow-[0_0_20px_rgba(245,158,11,0.3)]" className="aspect-[2/1] md:aspect-square flex flex-col items-center justify-center gap-2 group p-4 bg-slate-900/40 backdrop-blur-md">
                        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-1 group-hover:bg-amber-500/30 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                            <i className="fas fa-th text-2xl md:text-3xl text-amber-500 group-hover:scale-110 transition"></i>
                        </div>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest text-center">Kho Kanji</span>
                    </BentoBlock>
                    <BentoBlock onClick={onOpenFav} colorClass="border-pink-500 hover:border-white shadow-[0_0_20px_rgba(236,72,153,0.3)]" className="aspect-[2/1] md:aspect-square flex flex-col items-center justify-center gap-2 group p-4 bg-slate-900/40 backdrop-blur-md">
                        <div className="w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center mb-1 group-hover:bg-pink-500/30 transition-all shadow-[0_0_15px_rgba(236,72,153,0.2)]">
                            <i className="fas fa-heart text-2xl md:text-3xl text-pink-500 group-hover:scale-110 transition"></i>
                        </div>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest text-center">Yêu thích</span>
                    </BentoBlock>
                    <BentoBlock onClick={() => onChangeView('data-factory')} colorClass="border-fuchsia-500 hover:border-white shadow-[0_0_20px_rgba(217,70,239,0.3)]" className="aspect-[2/1] md:aspect-square flex flex-col items-center justify-center gap-2 group p-4 bg-slate-900/40 backdrop-blur-md">
                        <div className="w-12 h-12 rounded-full bg-fuchsia-500/10 flex items-center justify-center mb-1 group-hover:bg-fuchsia-500/30 transition-all shadow-[0_0_15px_rgba(217,70,239,0.2)]">
                            <i className="fas fa-database text-2xl md:text-3xl text-fuchsia-500 group-hover:scale-110 transition"></i>
                        </div>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest text-center">Dữ liệu</span>
                    </BentoBlock>
                </div>
            </div>

            {/* CALENDAR MODAL */}
            {showCalendar && (
                <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-slide-up" onClick={() => setShowCalendar(false)}>
                    <div className="max-w-md w-full bg-slate-900 border-2 border-neon-amber rounded-3xl p-6 shadow-[0_0_50px_rgba(255,170,0,0.3)] relative" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b border-neon-amber/30 pb-3 mb-3">
                            <button onClick={() => changeMonth(-1)} className="text-slate-400 hover:text-white px-2"><i className="fas fa-chevron-left text-xs"></i></button>
                            <h2 className="text-lg font-black text-neon-amber uppercase tracking-widest">
                                <i className="fas fa-calendar-alt mr-2"></i> {monthNames[calendarData.month]} {calendarData.year}
                            </h2>
                            <button onClick={() => changeMonth(1)} className="text-slate-400 hover:text-white px-2"><i className="fas fa-chevron-right text-xs"></i></button>
                        </div>
                        
                        {/* CHECK-IN BUTTON */}
                        <div className="mb-4">
                            {lastStudyDate === new Date().toISOString().split('T')[0] ? (
                                <div className="w-full py-3 bg-emerald-900/30 border border-emerald-500/50 rounded-xl flex items-center justify-center gap-2 text-emerald-400 font-black uppercase text-xs">
                                    <i className="fas fa-check-circle"></i> Đã điểm danh hôm nay
                                </div>
                            ) : (
                                <button 
                                    onClick={() => { onCheckIn?.(); }}
                                    className="w-full py-3 bg-neon-amber text-black font-black uppercase text-xs rounded-xl shadow-[0_0_20px_rgba(255,170,0,0.5)] hover:scale-[1.02] active:scale-95 transition flex items-center justify-center gap-2 animate-pulse"
                                >
                                    <i className="fas fa-fingerprint"></i> Điểm danh ngay (+50 XP)
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-7 gap-2 mb-4">
                             {['CN','T2','T3','T4','T5','T6','T7'].map(d => (
                                 <div key={d} className="text-center text-[9px] font-black text-slate-500 uppercase">{d}</div>
                             ))}
                             {calendarData.days.map((d, i) => {
                                 if (!d) return <div key={i}></div>;
                                 return (
                                     <div 
                                        key={i} 
                                        className={`
                                            aspect-square rounded-md flex flex-col items-center justify-center border-2 transition-all hover:scale-110 relative overflow-hidden
                                            ${d.isToday 
                                                ? 'bg-white border-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.5)]' 
                                                : d.count > 0 
                                                    ? 'bg-black border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                                                    : 'bg-black border-red-500 text-white opacity-80'
                                            }
                                        `}
                                        title={`${d.iso}: ${d.count} bài học`}
                                    >
                                         {d.count > 0 && !d.isToday && (
                                             <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                                                 <i className="fas fa-check text-2xl text-emerald-500"></i>
                                             </div>
                                         )}
                                         <span className={`text-[10px] font-black ${d.isToday ? 'text-black' : 'text-white'}`}>{d.dayNum}</span>
                                     </div>
                                 );
                             })}
                        </div>
                         
                        <div className="text-center text-[8px] text-slate-500 italic mt-2">
                             * Viền xanh: Ngày đã học • Viền xanh dương: Hôm nay
                        </div>
                        <button onClick={() => setShowCalendar(false)} className="w-full py-3 mt-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 font-black uppercase text-[10px] border border-slate-700">Đóng</button>
                    </div>
                </div>
            )}
        </section>
    );
};

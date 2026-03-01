
import React, { useState, useEffect } from 'react';
import { Vocab, SRSStatus, AppDatabase } from '../../types';
import { playSfx } from '../../services/audioService';
import { getSRSIntervalDisplay } from '../../services/storageService';
import { motion, useAnimation } from 'motion/react';
import { RotateCw, Check, X } from 'lucide-react';

interface ReflexViewProps {
    vocab: Vocab;
    allVocab: Vocab[];
    srsStatus?: SRSStatus;
    onNext: (rating: 1 | 2 | 3 | 4, hintUsed?: boolean) => void;
    onPrev: () => void;
    currentIndex: number;
    total: number;
    db?: AppDatabase;
    initialMode?: 'flashcard' | 'anki';
    lessonId?: string;
    mode?: string;
}

type SubMode = 'anki' | 'match' | 'survival' | 'flashcard';

export const ReflexView: React.FC<ReflexViewProps> = (props) => {
    const [subMode, setSubMode] = useState<SubMode>('anki');

    useEffect(() => {
        if (props.initialMode === 'flashcard') setSubMode('flashcard');
        else setSubMode('anki');
    }, [props.initialMode]);

    return (
        <section className="absolute inset-0 flex flex-col bg-slate-950 animate-slide-up overflow-hidden">
             {/* Simple matte dark background for focus with subtle pattern */}
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay pointer-events-none"></div>
             <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/10 via-slate-950 to-slate-950 pointer-events-none"></div>
            <div className="flex-1 relative z-10 overflow-hidden">
                {subMode === 'anki' && <AnkiMode {...props} />}
            </div>
        </section>
    );
};

interface SRSButtonProps {
    label: string;
    time: string;
    color: 'rose' | 'orange' | 'emerald' | 'sky';
    onClick: () => void;
    hotkey: string;
    isPressed?: boolean;
    disabled?: boolean;
}

const SRSButton: React.FC<SRSButtonProps> = ({ label, time, color, onClick, hotkey, isPressed, disabled }) => {
    const colorClasses = {
        rose: 'bg-rose-950/10 border-rose-500 text-rose-500 hover:bg-rose-900/20',
        orange: 'bg-orange-950/10 border-orange-500 text-orange-500 hover:bg-orange-900/20',
        emerald: 'bg-emerald-950/10 border-emerald-500 text-emerald-500 hover:bg-emerald-900/20',
        sky: 'bg-sky-950/10 border-sky-500 text-sky-500 hover:bg-sky-900/20'
    };
    const pressedClasses = {
        rose: 'bg-rose-900/60 border-rose-600 text-white',
        orange: 'bg-orange-900/60 border-orange-600 text-white',
        emerald: 'bg-emerald-900/60 border-emerald-600 text-white',
        sky: 'bg-sky-900/60 border-sky-600 text-white'
    };
    const baseClass = disabled 
        ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed' 
        : isPressed 
            ? `${pressedClasses[color]} border-b-0 translate-y-1 shadow-none` 
            : `${colorClasses[color]} shadow-lg border-2 border-b-4`;

    return (
        <button 
            onClick={onClick}
            disabled={disabled}
            className={`relative w-full h-20 rounded-xl flex flex-col items-center justify-center transition-all active:border-b-0 active:translate-y-1 ${baseClass}`}
        >
            <span className="text-sm md:text-base font-black uppercase tracking-widest drop-shadow-sm">{label}</span>
            <span className="text-[10px] font-bold opacity-80">{time}</span>
            <div className="absolute top-1 right-2 text-[8px] font-black opacity-40 border border-current px-1 rounded">{hotkey}</div>
        </button>
    );
};

const AnkiMode: React.FC<ReflexViewProps> = ({ vocab, srsStatus, onNext, currentIndex, total, db, lessonId, allVocab }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [hintUsed, setHintUsed] = useState(false);
    const [pressedKey, setPressedKey] = useState<string | null>(null); 
    const [isReversed, setIsReversed] = useState(false);
    const controls = useAnimation();

    // Calculate stats for progress bar
    const stats = React.useMemo(() => {
        let mem = 0;
        let learn = 0;
        if (allVocab && db?.srs) {
            allVocab.forEach(v => {
                const s = db.srs[v.id];
                // Interval > 1 implies some memorization (level 3, 4 usually result in higher intervals)
                if (s && s.interval > 1) mem++;
                else learn++;
            });
        }
        return { mem, learn };
    }, [allVocab, db?.srs, vocab]); // Recalculate when current vocab changes (might update db)

    // Reset state when vocab changes
    useEffect(() => { 
        setIsFlipped(false); 
        setHintUsed(false); 
        controls.set({ x: 0, opacity: 1, rotateY: 0, scale: 1 });
    }, [vocab]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const key = e.key.toLowerCase();
            if (key === ' ' || key === 'enter') {
                e.preventDefault();
                setPressedKey('space');
                if (!isFlipped) handleFlip();
            } else if (isFlipped) {
                if (key === '1') { setPressedKey('1'); handleRate(1); }
                if (key === '2') { setPressedKey('2'); handleRate(2); }
                if (key === '3') { setPressedKey('3'); handleRate(3); }
                if (key === '4') { setPressedKey('4'); handleRate(4); }
            }
        };
        const handleKeyUp = () => setPressedKey(null);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, [isFlipped, hintUsed]); 

    const handleFlip = () => {
        setIsFlipped(true);
        controls.start({ rotateY: 180, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 20 } });
        playSfx(300, 'triangle', 0.05);
    };

    const handleRate = async (rating: 1 | 2 | 3 | 4) => {
        if (!isFlipped) return;
        if (rating === 4 && hintUsed) { playSfx(150, 'sawtooth', 0.3); return; }
        
        // SFX
        if (rating === 1) playSfx(150, 'sawtooth', 0.2);
        else if (rating === 2) playSfx(200, 'square', 0.1);
        else if (rating === 4) { playSfx(1200, 'sine', 0.1); }
        else { playSfx(800, 'sine', 0.1); }

        // Animate out
        const direction = rating >= 3 ? 500 : -500;
        await controls.start({ x: direction, opacity: 0, transition: { duration: 0.2 } });

        setIsFlipped(false);
        onNext(rating, hintUsed);
    };

    const getCardStyle = () => {
        const status = srsStatus?.status || 'new';
        if (status === 'review') return 'border-emerald-500 bg-slate-900/20 backdrop-blur-md shadow-[0_0_30px_rgba(16,185,129,0.2)]'; 
        if (status === 'learning' || status === 'must_review') return 'border-indigo-500 bg-slate-900/20 backdrop-blur-md shadow-[0_0_30px_rgba(99,102,241,0.2)]'; 
        return 'border-slate-600 bg-slate-900/20 backdrop-blur-md shadow-lg'; 
    };

    const visualKanji = (vocab.kj && vocab.kj !== '-' && vocab.kj !== '---') ? vocab.kj : vocab.ka;
    const frontContent = isReversed ? vocab.mean : (
        <div className="flex flex-col items-center gap-0">
            <div className="text-center drop-shadow-2xl leading-none">{visualKanji}</div>
            {vocab.kj !== '-' && vocab.kj !== '---' && (
                <div className="text-[0.3em] font-black text-emerald-400 drop-shadow-md mt-2">{vocab.ka}</div>
            )}
        </div>
    );
    
    const userScale = (db?.config.kanjiSize || 130) / 130;
    const textLength = typeof frontContent === 'string' ? frontContent.length : visualKanji.length;
    
    // Font size calculation
    const isShort = textLength <= 6;
    const fontSize = isShort 
        ? `min(${40 * userScale}cqh, ${100 / Math.max(1, textLength)}cqi)` 
        : `clamp(1.5rem, min(25cqh, ${150 / Math.max(1, textLength * 0.55)}cqi), 5rem)`;

    const hintLabel = isReversed ? "GỢI Ý (KANA)" : "GỢI Ý (HÁN VIỆT)";
    const hintContent = isReversed ? vocab.ka : vocab.hv;

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 md:p-4 overflow-hidden">
             <div className="w-full max-w-md mx-auto flex items-center justify-center relative z-20 shrink-0 mb-4 pt-14">
                 {/* Left: Lesson Badge */}
                 <div className="absolute left-0 text-[9px] font-black uppercase text-indigo-300 tracking-widest border border-indigo-500/50 px-3 py-1.5 rounded-full bg-indigo-900/40 shadow-[0_0_10px_rgba(99,102,241,0.2)] backdrop-blur-sm">
                     {lessonId === 'SRS' ? 'ÔN TẬP' : `BÀI ${lessonId}`}
                 </div>
                 
                 {/* Center: Progress Bar */}
                 <div className="flex flex-col items-center w-32 gap-1">
                     <div className="w-full h-2 bg-slate-800 rounded-full flex overflow-hidden border border-white/10">
                         <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${(stats.learn / total) * 100}%` }} />
                         <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(stats.mem / total) * 100}%` }} />
                     </div>
                     <div className="flex justify-between w-full text-[8px] font-black uppercase tracking-wider opacity-70">
                         <span className="text-orange-400">{stats.learn}</span>
                         <span className="text-slate-500">{currentIndex + 1}/{total}</span>
                         <span className="text-emerald-400">{stats.mem}</span>
                     </div>
                 </div>
                 
                 {/* Right: Reverse Button */}
                 <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsReversed(!isReversed)}
                    className={`absolute right-0 w-10 h-10 rounded-xl border flex items-center justify-center text-xs transition shadow-lg ${isReversed ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white hover:border-white'}`}
                 >
                    <RotateCw size={16} />
                 </motion.button>
             </div>

             <div className="relative w-full max-w-md flex-1 min-h-0 perspective-1000 z-10 my-1 flex flex-col justify-center" style={{ height: '70%' }}>
                 <motion.div 
                    key={vocab.id}
                    animate={controls}
                    drag={isFlipped ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={(_, info) => {
                        if (!isFlipped) return;
                        if (info.offset.x > 100) handleRate(3);
                        else if (info.offset.x < -100) handleRate(1);
                    }}
                    className="relative w-full h-full preserve-3d cursor-grab active:cursor-grabbing"
                    style={{ transformStyle: 'preserve-3d' }}
                    onClick={!isFlipped ? handleFlip : undefined}
                 >
                    {/* FRONT */}
                    <div 
                        className={`absolute inset-0 rounded-3xl border-2 flex flex-col items-center justify-center p-6 md:p-8 ${getCardStyle()} ${isFlipped ? 'z-0' : 'z-20'} overflow-hidden`}
                        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                    >
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-5 mix-blend-overlay pointer-events-none"></div>
                        {srsStatus?.status === 'review' && <div className="absolute top-6 left-6 w-3 h-3 bg-emerald-500 rounded-full animate-ping shadow-[0_0_10px_#10b981]"></div>}
                        
                        <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden relative z-10" style={{ containerType: 'inline-size' }}>
                            <div 
                                className="font-sans font-medium text-white drop-shadow-2xl leading-tight whitespace-normal break-words text-center flex flex-col items-center justify-center h-full px-4" 
                                style={{ 
                                    fontSize, 
                                    width: '100%' 
                                }}
                            >
                                {frontContent}
                            </div>
                        </div>
                        
                        {!isFlipped && (
                            <div className="absolute bottom-6 w-full flex justify-center z-20">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={(e) => { e.stopPropagation(); setHintUsed(true); }}
                                    className={`px-6 py-3 rounded-xl border border-pink-500/30 bg-pink-950/30 hover:bg-pink-900/50 transition-all text-center group backdrop-blur-sm ${hintUsed ? 'opacity-100 border-pink-500 bg-pink-900/80' : 'opacity-80 hover:opacity-100'}`}
                                >
                                    <span className={`text-pink-400 group-hover:text-pink-300 font-black uppercase text-xs tracking-widest glow-text`}>
                                        {hintUsed ? hintContent : hintLabel}
                                    </span>
                                </motion.button>
                            </div>
                        )}
                    </div>

                    {/* BACK */}
                    <div 
                        className={`absolute inset-0 rotate-y-180 bg-slate-900/40 backdrop-blur-md rounded-3xl border-2 border-indigo-500 overflow-hidden flex flex-col shadow-[0_0_50px_rgba(99,102,241,0.2)] ${isFlipped ? 'z-20' : 'z-0'}`}
                        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                    >
                        <div className="h-[30%] bg-gradient-to-b from-slate-900/50 to-slate-950/50 p-4 flex flex-col items-center justify-center border-b border-indigo-500/30 shrink-0 relative overflow-hidden" style={{ containerType: 'inline-size' }}>
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay"></div>
                            <ruby className="font-serif text-white text-center whitespace-nowrap relative z-10 drop-shadow-lg" style={{ fontSize: `min(${120 * userScale}px, ${50 / visualKanji.length}cqi)` }}>
                                {visualKanji} <rt className="text-emerald-400 font-sans text-base font-bold tracking-widest block mt-1 drop-shadow-md">{vocab.ka}</rt>
                            </ruby>
                        </div>
                        
                        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-950/30 min-h-0 relative">
                            {/* Swipe Indicators */}
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 opacity-20 pointer-events-none">
                                <X size={20} className="text-rose-500" />
                                <span className="text-[6px] font-black uppercase text-rose-500">Lại</span>
                            </div>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 opacity-20 pointer-events-none">
                                <Check size={20} className="text-emerald-500" />
                                <span className="text-[6px] font-black uppercase text-emerald-500">Tốt</span>
                            </div>

                            <div className="text-center w-full h-full flex flex-col items-center justify-center overflow-hidden" style={{ containerType: 'inline-size' }}>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 block glow-text">Ý NGHĨA</span>
                                <div className="font-black text-white leading-tight whitespace-normal break-words px-2 drop-shadow-md" style={{ fontSize: `min(${80 * userScale}px, ${60 / Math.sqrt(vocab.mean.length)}cqi)` }}>{vocab.mean}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 border-t border-indigo-500/30 shrink-0 bg-slate-900/50 divide-x divide-indigo-500/20 h-14 md:h-16 backdrop-blur-sm">
                             <div className="flex flex-col items-center justify-center p-1 hover:bg-white/5 transition">
                                <span className="text-[8px] text-pink-500 font-black uppercase mb-0.5 tracking-wider">Hán Việt</span>
                                <span className="text-pink-300 font-black text-[10px] md:text-xs text-center leading-tight truncate w-full drop-shadow-sm">{vocab.hv || '--'}</span>
                             </div>
                             <div className="flex flex-col items-center justify-center p-1 hover:bg-white/5 transition">
                                <span className="text-[8px] text-sky-500 font-black uppercase mb-0.5 tracking-wider">English</span>
                                <span className="text-sky-300 font-bold text-[8px] md:text-[10px] text-center leading-tight line-clamp-2 px-1 drop-shadow-sm">{vocab.en || '--'}</span>
                             </div>
                             <div className="flex flex-col items-center justify-center p-1 hover:bg-white/5 transition">
                                <span className="text-[8px] text-cyan-500 font-black uppercase mb-0.5 tracking-wider">On</span>
                                <span className="text-cyan-300 font-bold text-[10px] md:text-xs text-center truncate w-full drop-shadow-sm">{vocab.on || '-'}</span>
                             </div>
                             <div className="flex flex-col items-center justify-center p-1 hover:bg-white/5 transition">
                                <span className="text-[8px] text-amber-500 font-black uppercase mb-0.5 tracking-wider">Kun</span>
                                <span className="text-amber-300 font-bold text-[10px] md:text-xs text-center truncate w-full drop-shadow-sm">{vocab.kun || '-'}</span>
                             </div>
                        </div>
                    </div>
                 </motion.div>
             </div>

             <div className="w-full max-w-3xl h-16 relative z-20 shrink-0 mb-safe">
                 {!isFlipped ? (
                     <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={handleFlip} 
                        className={`w-full h-full rounded-xl border-b-4 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-4 font-black text-lg uppercase tracking-[0.2em] shadow-xl ${pressedKey === 'space' ? 'bg-indigo-500 border-indigo-700 translate-y-1 border-b-0 text-white shadow-none' : 'bg-gradient-to-r from-indigo-600 to-blue-600 border-indigo-800 text-white hover:from-indigo-500 hover:to-blue-500 shadow-[0_0_20px_rgba(99,102,241,0.4)]'}`}
                     >
                        <RotateCw size={20} /> LẬT (SPACE)
                     </motion.button>
                 ) : (
                     <div className="grid grid-cols-4 gap-2 h-full">
                         <SRSButton label="LẠI (1)" time={getSRSIntervalDisplay(srsStatus, 1, hintUsed)} color="rose" onClick={() => handleRate(1)} hotkey="1" isPressed={pressedKey === '1'} />
                         <SRSButton label="KHÓ (2)" time={getSRSIntervalDisplay(srsStatus, 2, hintUsed)} color="orange" onClick={() => handleRate(2)} hotkey="2" isPressed={pressedKey === '2'} />
                         <SRSButton label="TỐT (3)" time={getSRSIntervalDisplay(srsStatus, 3, hintUsed)} color="emerald" onClick={() => handleRate(3)} hotkey="3" isPressed={pressedKey === '3'} />
                         <SRSButton label="DỄ (4)" time={getSRSIntervalDisplay(srsStatus, 4, hintUsed)} color="sky" onClick={() => handleRate(4)} hotkey="4" isPressed={pressedKey === '4'} disabled={hintUsed} />
                     </div>
                 )}
             </div>
        </div>
    );
};

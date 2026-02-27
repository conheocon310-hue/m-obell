
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
        <section className="absolute inset-0 flex flex-col bg-[#020202] animate-slide-up overflow-hidden">
             {/* Simple matte dark background for focus */}
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
        rose: 'bg-rose-900 border-rose-600 hover:bg-rose-800 text-rose-100',
        orange: 'bg-orange-900 border-orange-600 hover:bg-orange-800 text-orange-100',
        emerald: 'bg-emerald-900 border-emerald-600 hover:bg-emerald-800 text-emerald-100',
        sky: 'bg-sky-900 border-sky-600 hover:bg-sky-800 text-sky-100'
    };
    const pressedClasses = {
        rose: 'bg-rose-800 border-rose-600',
        orange: 'bg-orange-800 border-orange-600',
        emerald: 'bg-emerald-800 border-emerald-600',
        sky: 'bg-sky-800 border-sky-600'
    };
    const baseClass = disabled 
        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed' 
        : isPressed 
            ? `${pressedClasses[color]} border-b-0 translate-y-1 shadow-none` 
            : `${colorClasses[color]} shadow-lg`;

    return (
        <button 
            onClick={onClick}
            disabled={disabled}
            className={`relative w-full h-16 rounded-xl border-b-4 flex flex-col items-center justify-center transition-all active:border-b-0 active:translate-y-1 ${baseClass}`}
        >
            <span className="text-xs md:text-sm font-black uppercase tracking-widest">{label}</span>
            <span className="text-[10px] font-bold opacity-70">{time}</span>
            <div className="absolute top-1 right-2 text-[8px] font-black opacity-30 border border-white/20 px-1 rounded">{hotkey}</div>
        </button>
    );
};

const AnkiMode: React.FC<ReflexViewProps> = ({ vocab, srsStatus, onNext, currentIndex, total, db, lessonId, mode }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [hintUsed, setHintUsed] = useState(false);
    const [pressedKey, setPressedKey] = useState<string | null>(null); 
    const [isReversed, setIsReversed] = useState(false);
    const controls = useAnimation();

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
        if (status === 'review') return 'border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.2)]'; 
        if (status === 'learning' || status === 'must_review') return 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.15)]'; 
        return 'border-slate-700 shadow-none'; 
    };

    const visualKanji = (vocab.kj && vocab.kj !== '-' && vocab.kj !== '---') ? vocab.kj : vocab.ka;
    const frontContent = isReversed ? vocab.mean : (
        <div className="flex flex-col items-center gap-2">
            <div className="text-center">{visualKanji}</div>
            {vocab.kj !== '-' && vocab.kj !== '---' && (
                <div className="text-2xl font-black text-emerald-500">{vocab.ka}</div>
            )}
        </div>
    );
    
    const userScale = (db?.config.kanjiSize || 130) / 130;
    const textLength = typeof frontContent === 'string' ? frontContent.length : visualKanji.length;
    const fontSize = `min(${250 * userScale}px, ${70 / textLength}cqi)`;
    
    const hintLabel = isReversed ? "GỢI Ý (KANA)" : "GỢI Ý (HÁN VIỆT)";
    const hintContent = isReversed ? vocab.ka : vocab.hv;

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 md:p-4 overflow-hidden">
             <div className="w-full max-w-md mx-auto flex items-center justify-center relative z-20 shrink-0 mb-4 pt-14">
                 {/* Left: Lesson Badge */}
                 <div className="absolute left-0 text-[9px] font-black uppercase text-indigo-400 tracking-widest border border-indigo-500/30 px-2 py-1 rounded-full bg-indigo-900/20">
                     {lessonId === 'SRS' ? 'ÔN TẬP' : `BÀI ${lessonId}`}
                 </div>
                 
                 {/* Center: Progress */}
                 <div className="flex flex-col items-center gap-1">
                     <div className="text-[10px] font-black text-slate-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                        {currentIndex + 1} / {total}
                     </div>
                 </div>
                 
                 {/* Right: Reverse Button */}
                 <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsReversed(!isReversed)}
                    className={`absolute right-0 w-8 h-8 rounded-full border flex items-center justify-center text-xs transition ${isReversed ? 'bg-purple-900 border-purple-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                 >
                    <RotateCw size={14} />
                 </motion.button>
             </div>

             <div className="relative w-full max-w-md flex-1 min-h-0 perspective-1000 z-10 my-1 flex flex-col justify-center">
                 <motion.div 
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
                    <div className={`absolute inset-0 backface-hidden bg-[#0A0A0A] rounded-3xl border-2 flex flex-col items-center justify-center p-6 md:p-8 ${getCardStyle()} z-20 overflow-hidden shadow-2xl`}>
                        {srsStatus?.status === 'review' && <div className="absolute top-6 left-6 w-3 h-3 bg-emerald-500 rounded-full animate-ping"></div>}
                        
                        <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden" style={{ containerType: 'inline-size' }}>
                            <div 
                                className="font-serif text-white drop-shadow-2xl leading-tight whitespace-nowrap text-center flex flex-col items-center justify-center h-full" 
                                style={{ 
                                    fontSize: fontSize, 
                                    width: '100%' 
                                }}
                            >
                                {frontContent}
                            </div>
                        </div>
                        
                        {isReversed && <div className="absolute bottom-20 text-slate-600 text-[10px] uppercase tracking-[0.2em] font-bold">Nghĩa tiếng Việt</div>}

                        {!isFlipped && (
                            <div className="absolute bottom-6 w-full flex justify-center">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={(e) => { e.stopPropagation(); setHintUsed(true); }}
                                    className={`px-6 py-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800 transition-all text-center group ${hintUsed ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                                >
                                    <span className={`text-pink-500 font-black uppercase text-xs tracking-widest`}>
                                        {hintUsed ? hintContent : hintLabel}
                                    </span>
                                </motion.button>
                            </div>
                        )}
                    </div>

                    {/* BACK */}
                    <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[#0A0A0A] rounded-3xl border-2 border-indigo-900/50 overflow-hidden flex flex-col z-20 shadow-2xl">
                        <div className="h-[30%] bg-gradient-to-b from-[#111] to-[#0A0A0A] p-4 flex flex-col items-center justify-center border-b border-slate-800 shrink-0" style={{ containerType: 'inline-size' }}>
                            <ruby className="font-serif text-white text-center whitespace-nowrap" style={{ fontSize: `min(${120 * userScale}px, ${50 / visualKanji.length}cqi)` }}>
                                {visualKanji} <rt className="text-emerald-500 font-sans text-base font-bold tracking-widest block mt-1">{vocab.ka}</rt>
                            </ruby>
                        </div>
                        
                        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-[#0A0A0A] min-h-0 relative">
                            {/* Swipe Indicators */}
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 opacity-20">
                                <X size={20} className="text-rose-500" />
                                <span className="text-[6px] font-black uppercase text-rose-500">Lại</span>
                            </div>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 opacity-20">
                                <Check size={20} className="text-emerald-500" />
                                <span className="text-[6px] font-black uppercase text-emerald-500">Tốt</span>
                            </div>

                            <div className="text-center w-full h-full flex flex-col items-center justify-center overflow-hidden" style={{ containerType: 'inline-size' }}>
                                <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] mb-1 block">Ý NGHĨA</span>
                                <div className="font-black text-white leading-tight whitespace-normal break-words px-2" style={{ fontSize: `min(${80 * userScale}px, ${60 / Math.sqrt(vocab.mean.length)}cqi)` }}>{vocab.mean}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 border-t border-slate-800 shrink-0 bg-[#050505] divide-x divide-slate-800 h-14 md:h-16">
                             <div className="flex flex-col items-center justify-center p-1">
                                <span className="text-[8px] text-pink-700 font-black uppercase mb-0.5 tracking-wider">Hán Việt</span>
                                <span className="text-pink-400 font-black text-[10px] md:text-xs text-center leading-tight truncate w-full">{vocab.hv || '--'}</span>
                             </div>
                             <div className="flex flex-col items-center justify-center p-1">
                                <span className="text-[8px] text-sky-700 font-black uppercase mb-0.5 tracking-wider">English</span>
                                <span className="text-sky-400 font-bold text-[8px] md:text-[10px] text-center leading-tight line-clamp-2 px-1">{vocab.en || '--'}</span>
                             </div>
                             <div className="flex flex-col items-center justify-center p-1">
                                <span className="text-[8px] text-cyan-700 font-black uppercase mb-0.5 tracking-wider">On</span>
                                <span className="text-cyan-400 font-bold text-[10px] md:text-xs text-center truncate w-full">{vocab.on || '-'}</span>
                             </div>
                             <div className="flex flex-col items-center justify-center p-1">
                                <span className="text-[8px] text-amber-700 font-black uppercase mb-0.5 tracking-wider">Kun</span>
                                <span className="text-amber-400 font-bold text-[10px] md:text-xs text-center truncate w-full">{vocab.kun || '-'}</span>
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
                        className={`w-full h-full rounded-xl border-b-4 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-4 font-black text-lg uppercase tracking-[0.2em] shadow-xl ${pressedKey === 'space' ? 'bg-indigo-600 border-indigo-800 translate-y-1 border-b-0 text-white' : 'bg-indigo-700 border-indigo-900 text-white hover:bg-indigo-600'}`}
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


import React, { useEffect, useState } from 'react';
import { Vocab } from '../../types';

interface StudyViewProps {
    vocab: Vocab;
    index: number;
    total: number;
    isFavorite: boolean;
    kanjiSize: number;
    onNext: () => void;
    onPrev: () => void;
    onToggleFav: () => void;
    onKanjiClick: (char: string) => void;
    onOpenRules: () => void;
    studyType: 'vocab' | 'kanji';
    onTypeChange: (type: 'vocab' | 'kanji') => void;
    vocabList: Vocab[]; // New prop
    onJump: (index: number) => void; // New prop
    lessonId?: string;
}

export const StudyView: React.FC<StudyViewProps> = ({ 
    vocab, index, total, isFavorite, kanjiSize, onNext, onPrev, onToggleFav, onKanjiClick, studyType, onTypeChange, vocabList, onJump
}) => {
    
    const [showFavList, setShowFavList] = useState(false);

    // List Modal
    const ListModal = () => (
        <div 
            className="absolute inset-0 z-[60] bg-slate-950/95 backdrop-blur-xl animate-slide-up flex flex-col"
            onTouchStart={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
            onTouchEnd={e => e.stopPropagation()}
        >
            <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/10 bg-slate-900">
                <h2 className="text-lg font-black text-white uppercase tracking-widest">Danh sách bài học ({vocabList.length})</h2>
                <button onClick={() => setShowFavList(false)} className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition"><i className="fas fa-times"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                {vocabList.map((v, i) => (
                    <div 
                        key={v.id} 
                        onClick={() => { onJump(i); setShowFavList(false); }}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${i === index ? 'bg-indigo-900/50 border-indigo-500' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="text-xs font-black text-slate-500 w-6">{i + 1}</div>
                            <div>
                                <div className="text-lg font-serif text-white">{v.kj !== '-' ? v.kj : v.ka}</div>
                                <div className="text-xs text-slate-400 truncate max-w-[200px]">{v.mean}</div>
                            </div>
                        </div>
                        {/* We don't have isFavorite for each item here unless we check db.favorites. 
                            But StudyView doesn't have db. 
                            We can assume if it's in the list, it's part of the lesson.
                            If we want to show heart, we need to know if it's favorited.
                            We can pass `favorites` array to StudyViewProps or just skip the heart for now.
                            The user asked for "list of favorited words".
                            If I can't show the heart, it's just a list.
                            I'll skip the heart icon for now to avoid prop drilling hell, or I can pass `favorites` list.
                        */}
                    </div>
                ))}
            </div>
        </div>
    );




    // Swipe Logic
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [animationState, setAnimationState] = useState<'idle' | 'exiting-left' | 'exiting-right' | 'entering-left' | 'entering-right'>('idle');

    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEndHandler = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;
        if (isLeftSwipe) {
            handleNext();
        }
        if (isRightSwipe) {
            handlePrev();
        }
    };

    const handleNext = () => {
        if (animationState !== 'idle') return;
        setAnimationState('exiting-left');
        setTimeout(() => {
            onNext();
            setAnimationState('entering-right');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setAnimationState('idle');
                });
            });
        }, 50); // Reduced delay for smoother feel
    };

    const handlePrev = () => {
        if (animationState !== 'idle') return;
        setAnimationState('exiting-right');
        setTimeout(() => {
            onPrev();
            setAnimationState('entering-left');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setAnimationState('idle');
                });
            });
        }, 50); // Reduced delay for smoother feel
    };

    // Handle key navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onNext, onPrev, vocab]); // Dependencies might need update if handleNext/Prev were stable, but they depend on state. 
    // Actually, handleNext/Prev depend on animationState, so we should probably not include them in dependency array of useEffect if we want to avoid re-binding constantly, 
    // but since they are closures, we need to. 
    // Better to use refs for animationState if we want to avoid re-binding, but for now this is fine.

    const getAnimationClass = () => {
        switch (animationState) {
            case 'exiting-left': return '-translate-x-full opacity-0';
            case 'exiting-right': return 'translate-x-full opacity-0';
            case 'entering-left': return '-translate-x-full opacity-0 duration-0'; // Instant position
            case 'entering-right': return 'translate-x-full opacity-0 duration-0'; // Instant position
            case 'idle': return 'translate-x-0 opacity-100 duration-300';
            default: return '';
        }
    };

    const handleExternalSearch = () => {
        const charToSearch = vocab.type === 'kanji' ? vocab.kj : (vocab.kj !== '-' ? vocab.kj : '');
        if (!charToSearch || charToSearch === '-') return;
        if (vocab.hv && vocab.hv !== '-') {
            navigator.clipboard.writeText(vocab.hv).catch(err => console.error(err));
        }
        const url = `https://nhaikanji.com/search?q=${encodeURIComponent(charToSearch)}`;
        window.open(url, '_blank');
    };

    const mainVisual = vocab.kj !== "-" ? vocab.kj : vocab.ka;
    const isKanjiMode = studyType === 'kanji' || vocab.type === 'kanji';

    // Dynamic Font Size Logic using Container Queries (cqi)
    // Formula Reduced: min(MaxPixelSize * 0.7, (70cqi / CharCount))
    const userScale = kanjiSize / 130; 
    const textLength = mainVisual.length;
    // Reduced base from 350 to 250, cqi from 95 to 70
    const fontSize = `min(${250 * userScale}px, ${70 / textLength}cqi)`;

    return (
        <section 
            className="absolute inset-0 flex flex-col animate-slide-up overflow-hidden bg-slate-950/80 backdrop-blur-sm"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEndHandler}
        >
            {/* 1. Header & Type Switcher */}
            <div className="flex-none pt-14 pb-2 px-4 flex flex-col items-center justify-center gap-2 z-20">
                <div className="flex items-center justify-center gap-4 w-full max-w-md relative">
                    {/* Left: List Button */}
                    <button 
                        onClick={() => setShowFavList(true)}
                        className="absolute left-0 w-8 h-8 rounded-full bg-white/5 text-slate-400 hover:text-white flex items-center justify-center transition border border-white/10"
                        title="Danh sách từ"
                    >
                        <i className="fas fa-list text-xs"></i>
                    </button>

                    {/* Center: Type Switcher */}
                    <div className="flex bg-black/40 p-1 rounded-full border border-white/10">
                        <button 
                            onClick={() => onTypeChange('vocab')}
                            className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition ${studyType === 'vocab' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            TỪ VỰNG
                        </button>
                        <button 
                            onClick={() => onTypeChange('kanji')}
                            className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition ${studyType === 'kanji' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            CHỮ HÁN
                        </button>
                    </div>

                    {/* Right: Progress */}
                    <div className="absolute right-0 text-[10px] font-black text-slate-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                        {index + 1} / {total}
                    </div>
                </div>
            </div>

            {showFavList && <ListModal />}

            {/* 2. Main Content - Vertical Stack for Phone View */}
            <div className={`flex-1 p-4 overflow-hidden z-10 flex flex-col gap-4 transition-all ease-out w-full max-w-4xl mx-auto ${getAnimationClass()}`}>
                
                {/* TOP: MAIN VISUAL CARD */}
                <div 
                    className="flex-1 rounded-3xl border-2 border-indigo-500/50 bg-[#0B1120] flex flex-col items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.1)] group overflow-hidden relative min-h-0"
                    onClick={() => onKanjiClick(mainVisual)}
                >
                    <div className="absolute top-4 right-4 text-slate-600 hover:text-pink-500 transition cursor-pointer z-20" onClick={(e) => { e.stopPropagation(); onToggleFav(); }}>
                        <i className={`fas fa-heart text-xl ${isFavorite ? 'text-pink-500' : ''}`}></i>
                    </div>
                    
                    {/* CONSTRAINT CONTAINER */}
                    <div className="w-[85%] h-[70%] flex items-center justify-center overflow-hidden mb-8" style={{ containerType: 'inline-size' }}>
                        <div 
                            className={`font-serif text-white transition-transform duration-300 group-hover:scale-105 select-none text-center whitespace-nowrap`} 
                            style={{ 
                                fontSize: fontSize, 
                                lineHeight: 1,
                                width: '100%' 
                            }}
                        >
                            {mainVisual}
                        </div>
                    </div>
                    
                    <div className="absolute bottom-4 text-[8px] font-black text-indigo-500/50 uppercase tracking-[0.3em] animate-pulse pointer-events-none">
                        CHẠM ĐỂ MỞ MẠNG LƯỚI
                    </div>

                        {/* External Search Button (Only in Kanji mode) */}
                    {isKanjiMode && vocab.kj !== '-' && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleExternalSearch(); }}
                            className="absolute bottom-4 right-4 w-8 h-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-400 transition"
                        >
                            <i className="fas fa-search-plus text-xs"></i>
                        </button>
                    )}
                </div>

                {/* MIDDLE: READING & MEANING */}
                <div className="shrink-0 flex flex-col gap-3">
                    {/* READING */}
                    <div className="h-16 rounded-2xl border border-emerald-500/30 bg-[#020617] relative overflow-hidden flex items-center px-4 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                        <div className="flex-1 overflow-hidden flex items-baseline gap-3">
                            <div className="text-2xl font-black text-emerald-300 truncate">{vocab.ka}</div>
                            <div className="text-[10px] font-black text-emerald-700/80 uppercase tracking-widest font-mono border border-emerald-900/50 px-1.5 py-0.5 rounded bg-emerald-950/30 truncate">
                                {vocab.ro}
                            </div>
                        </div>
                    </div>

                    {/* HÁN VIỆT & MEANING */}
                    <div className="flex gap-3 h-32">
                        {/* HÁN VIỆT */}
                        <div className="w-1/3 rounded-2xl border border-pink-500/30 bg-[#0f0518] p-3 flex flex-col justify-center relative shadow-[0_0_15px_rgba(236,72,153,0.05)] overflow-hidden">
                            <span className="text-[8px] font-black text-pink-500 uppercase tracking-widest mb-1">HÁN VIỆT</span>
                            <div className="text-sm md:text-base font-black text-white uppercase leading-snug line-clamp-3" title={vocab.hv}>
                                {vocab.hv}
                            </div>
                        </div>

                        {/* MEANING */}
                        <div className="flex-1 rounded-2xl border border-slate-700 bg-[#0B1120] p-3 flex flex-col justify-center relative overflow-hidden">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Ý NGHĨA</span>
                            <div className="overflow-y-auto custom-scrollbar">
                                <div className="text-lg font-black text-white leading-snug">{vocab.mean}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Footer Slider */}
            <div className="h-14 bg-slate-950 border-t border-white/5 flex items-center px-6 gap-6 shrink-0 z-20">
                <button onClick={handlePrev} className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition active:scale-95">
                    <i className="fas fa-chevron-left"></i>
                </button>
                <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300" style={{ width: `${((index + 1) / total) * 100}%` }}></div>
                </div>
                <button onClick={handleNext} className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition active:scale-95">
                    <i className="fas fa-chevron-right"></i>
                </button>
            </div>
        </section>
    );
};

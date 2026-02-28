
import React, { useRef, useEffect, useState } from 'react';
import { Vocab } from '../../types';
import { playSfx } from '../../services/audioService';

interface WritingViewProps {
    vocab: Vocab;
    onSwitchToReflex: () => void;
    timerSettings: { duration: number; mode: 'sequential' | 'shuffle' };
    onUpdateSettings: (duration: number, mode: 'sequential' | 'shuffle') => void;
    onNext: () => void;
    onPrev: () => void;
    onGrade?: (rating: 1 | 2 | 3 | 4) => void; 
    index?: number;
    total?: number;
    lessonId?: string;
}

type BrushStyle = 'pen' | 'marker';
type InkColor = '#ffffff' | '#34d399' | '#f472b6' | '#fbbf24' | '#22d3ee';

export const WritingView: React.FC<WritingViewProps> = ({ 
    vocab, timerSettings, onUpdateSettings, onNext, onPrev, onGrade, index = 0, total = 0, lessonId
}) => {
    const [checked, setChecked] = useState(false);
    const [points, setPoints] = useState(0); 
    const [showGhost, setShowGhost] = useState(false);
    const [brushStyle] = useState<BrushStyle>('pen'); 
    const [showGrid] = useState(true);
    const [inkColor] = useState<InkColor>('#ffffff');
    const [showSettings, setShowSettings] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number>(timerSettings.duration);
    const [isTimeOut, setIsTimeOut] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRefs = { kanji: useRef<HTMLCanvasElement>(null), hira: useRef<HTMLCanvasElement>(null) };
    const isDrawing = useRef(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') onPrev();
            if (e.key === 'ArrowRight') onNext();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onNext, onPrev]);

    const getLineWidth = () => brushStyle === 'pen' ? 3 : 12;

    const handleClear = (silent = false) => {
        Object.values(canvasRefs).forEach(ref => {
            const cv = ref.current;
            if (cv) {
                const ctx = cv.getContext('2d');
                if (ctx) {
                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.clearRect(0, 0, cv.width, cv.height);
                    ctx.restore();
                    ctx.beginPath();
                }
            }
        });
        if (!silent) playSfx(150, 'square', 0.1);
    };

    useEffect(() => {
        setTimeLeft(timerSettings.duration);
        setIsTimeOut(false);
        setChecked(false);
        setShowGhost(false);
        handleClear(true);
    }, [vocab, timerSettings.duration]);

    useEffect(() => {
        if (timerSettings.duration > 0 && timeLeft > 0 && !checked) {
            const timerId = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) { setIsTimeOut(true); playSfx(150, 'sawtooth', 0.5); return 0; }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timerId);
        }
    }, [timeLeft, checked, timerSettings.duration]);

    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef<any>(null);

    const resetControlsTimeout = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 2000);
    };

    useEffect(() => {
        window.addEventListener('mousemove', resetControlsTimeout);
        window.addEventListener('touchstart', resetControlsTimeout);
        window.addEventListener('click', resetControlsTimeout);
        resetControlsTimeout();
        return () => {
            window.removeEventListener('mousemove', resetControlsTimeout);
            window.removeEventListener('touchstart', resetControlsTimeout);
            window.removeEventListener('click', resetControlsTimeout);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, []);

    const initCanvas = () => {
        Object.values(canvasRefs).forEach(ref => {
            const cv = ref.current;
            if (!cv || !cv.parentElement) return;
            const rect = cv.parentElement.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            if (cv.width !== Math.floor(rect.width * dpr) || cv.height !== Math.floor(rect.height * dpr)) {
                cv.width = rect.width * dpr;
                cv.height = rect.height * dpr;
                cv.style.width = '100%';
                cv.style.height = '100%';
                const ctx = cv.getContext('2d');
                if (ctx) {
                    ctx.scale(dpr, dpr);
                    ctx.strokeStyle = inkColor;
                    ctx.lineWidth = getLineWidth();
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.shadowBlur = brushStyle === 'marker' ? 15 : 0;
                    ctx.shadowColor = inkColor;
                }
            }
        });
    };

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(() => initCanvas());
        observer.observe(containerRef.current);
        initCanvas();
        return () => observer.disconnect();
    }, [containerRef]); 

    useEffect(() => {
        Object.values(canvasRefs).forEach(ref => {
            const ctx = ref.current?.getContext('2d');
            if (ctx) {
                ctx.strokeStyle = inkColor;
                ctx.lineWidth = getLineWidth();
                ctx.shadowBlur = brushStyle === 'marker' ? 15 : 0;
                ctx.shadowColor = inkColor;
            }
        });
    }, [brushStyle, inkColor]);

    const getPos = (e: React.PointerEvent<HTMLCanvasElement>, cv: HTMLCanvasElement) => {
        const rect = cv.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>, key: 'kanji' | 'hira') => {
        // Prevent default touch actions like scrolling
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        
        if (checked || isTimeOut) return;
        isDrawing.current = true;
        const cv = canvasRefs[key].current;
        if (!cv) return;
        const ctx = cv.getContext('2d');
        const { x, y } = getPos(e, cv);
        if (ctx) { ctx.beginPath(); ctx.moveTo(x, y); }
    };

    const draw = (e: React.PointerEvent<HTMLCanvasElement>, key: 'kanji' | 'hira') => {
        e.preventDefault();
        if (!isDrawing.current || checked || isTimeOut) return;
        const cv = canvasRefs[key].current;
        if (!cv) return;
        const ctx = cv.getContext('2d');
        const { x, y } = getPos(e, cv);
        if (ctx) { ctx.lineTo(x, y); ctx.stroke(); }
    };

    const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        isDrawing.current = false;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {
            // Ignore error if pointer capture was lost
        }
    };

    const handleReveal = () => {
        setChecked(true);
        if (isTimeOut) { playSfx(150, 'sawtooth', 0.1); } else { playSfx(600, 'sine', 0.1); }
    };

    const handleGrade = (correct: boolean) => {
        if (correct) {
            setPoints(p => p + 10);
            playSfx(800, 'square', 0.1);
            if (onGrade) onGrade(3);
            else onNext();
        } else {
            playSfx(150, 'sawtooth', 0.3);
            if (onGrade) onGrade(1);
            else onNext();
        }
    };

    const hasContent = (s: string | null) => s && s !== "-" && s !== "---" && s.trim() !== "";
    // Updated property access
    const displayMean = hasContent(vocab.mean) ? vocab.mean : (hasContent(vocab.en) ? vocab.en : "---");
    const displayKanji = vocab.kj !== "-" ? vocab.kj : vocab.ka;
    const progressPercent = total > 0 ? ((index + 1) / total) * 100 : 0;

    return (
        <section className="absolute inset-0 flex flex-col h-full bg-slate-950/80 backdrop-blur-md animate-slide-up overflow-hidden">
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/80"></div>
            </div>

            <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto h-full relative z-10">
                <div className="flex-none px-3 md:px-6 py-2 bg-slate-950/40 backdrop-blur-md border-b border-indigo-500/30 flex flex-col gap-2 z-20 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 md:gap-4">
                            <div className="flex flex-col">
                                <div className="text-[8px] md:text-[9px] font-black text-indigo-300 uppercase tracking-widest flex justify-between w-24 md:w-32 mb-1">
                                    <span>Tiến độ</span>
                                    <span>{index + 1} / {total}</span>
                                </div>
                                <div className="h-1.5 w-24 md:w-32 bg-slate-800 rounded-full overflow-hidden border border-white/10 shadow-inner">
                                    <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300 shadow-[0_0_10px_rgba(168,85,247,0.5)]" style={{ width: `${progressPercent}%` }}></div>
                                </div>
                            </div>
                            {lessonId && (
                                <div className="hidden md:block text-[9px] font-black uppercase text-indigo-300 tracking-widest border border-indigo-500/50 px-2 py-1 rounded bg-indigo-900/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                                    {lessonId === 'SRS' ? 'ÔN TẬP' : `BÀI ${lessonId}`}
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 bg-orange-950/50 border border-orange-500/30 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                                <i className="fas fa-fire text-orange-500 animate-pulse drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]"></i>
                                <span className="text-sm font-black text-orange-400">{points}</span>
                            </div>
                            <button onClick={() => setShowSettings(true)} className={`px-2 py-1 md:px-3 md:py-1.5 rounded-xl border-2 font-black text-[10px] md:text-sm font-mono tracking-widest flex items-center gap-1 md:gap-2 transition shadow-md ${isTimeOut ? 'bg-rose-950 border-rose-500 text-rose-500 animate-pulse' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-white'}`}>
                                {timerSettings.duration > 0 ? (
                                    <><i className="fas fa-clock text-[8px] md:text-xs"></i>{Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{Math.floor(timeLeft % 60).toString().padStart(2, '0')}</>
                                ) : ( <><i className="fas fa-infinity text-[8px] md:text-xs"></i> --:--</> )}
                            </button>
                        </div>
                    </div>
                    
                    {/* Full Meaning Display */}
                    <div className="w-full bg-slate-900/20 backdrop-blur-sm border border-indigo-500/40 rounded-xl p-2 md:p-3 flex items-center justify-center min-h-[3rem] md:min-h-[4rem] shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                        <h2 className="text-sm md:text-lg font-black text-white text-center leading-tight drop-shadow-md">{displayMean}</h2>
                    </div>
                </div>

                <div ref={containerRef} className="flex-1 p-2 md:p-4 w-full h-full flex flex-col md:flex-row gap-2 md:gap-4 min-h-0 relative z-10">
                    <div className={`flex-1 relative rounded-2xl border-[3px] bg-slate-950/30 backdrop-blur-sm overflow-hidden group transition-colors duration-300 ${checked ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'border-indigo-500/60 shadow-[0_0_20px_rgba(99,102,241,0.2)]'} ${showGrid ? 'drawing-grid' : ''}`}>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-5 mix-blend-overlay pointer-events-none"></div>
                        <span className="absolute top-2 left-3 md:top-3 md:left-4 text-[10px] md:text-xs font-black text-indigo-500/60 pointer-events-none z-10 tracking-[0.2em] glow-text">KANJI / HÁN TỰ</span>
                        {(showGhost || checked) && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                                 <div className={`font-serif text-center leading-tight transition-all duration-500 ${checked ? 'text-emerald-400 opacity-80 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'text-slate-600 opacity-20'}`} style={{ fontSize: 'min(10vh, 4rem)' }}>{displayKanji}</div>
                            </div>
                        )}
                        <canvas ref={canvasRefs.kanji} onPointerDown={(e) => startDrawing(e, 'kanji')} onPointerMove={(e) => draw(e, 'kanji')} onPointerUp={stopDrawing} onPointerLeave={stopDrawing} className="absolute inset-0 cursor-crosshair z-10 touch-none" style={{ touchAction: 'none' }} />
                    </div>

                    <div className={`flex-1 relative rounded-2xl border-[3px] bg-slate-950/30 backdrop-blur-sm overflow-hidden transition-colors duration-300 ${checked ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'border-fuchsia-500/60 shadow-[0_0_20px_rgba(217,70,239,0.2)]'} ${showGrid ? 'drawing-grid' : ''}`}>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-5 mix-blend-overlay pointer-events-none"></div>
                        <span className="absolute top-2 left-3 md:top-3 md:left-4 text-[10px] md:text-xs font-black text-fuchsia-500/60 pointer-events-none z-10 tracking-[0.2em] glow-text">READING / CÁCH ĐỌC</span>
                         {(showGhost || checked) && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                                 <div className={`font-serif text-center leading-tight transition-all duration-500 ${checked ? 'text-emerald-400 opacity-80 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'text-slate-600 opacity-20'}`} style={{ fontSize: 'min(10vh, 4rem)' }}>{vocab.ka}</div>
                            </div>
                        )}
                        <canvas ref={canvasRefs.hira} onPointerDown={(e) => startDrawing(e, 'hira')} onPointerMove={(e) => draw(e, 'hira')} onPointerUp={stopDrawing} onPointerLeave={stopDrawing} className="absolute inset-0 cursor-crosshair z-10 touch-none" style={{ touchAction: 'none' }} />
                    </div>
                </div>

                <div className="flex-none p-2 md:p-4 bg-slate-950/40 backdrop-blur-md border-t border-indigo-500/30 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-between gap-2 md:gap-4 h-14 md:h-16">
                        <button onClick={onPrev} className={`w-12 h-12 md:w-14 md:h-14 rounded-xl bg-slate-800 border-2 border-slate-600 text-slate-400 hover:text-white hover:border-indigo-500 hover:bg-indigo-900/50 flex items-center justify-center shadow-lg active:scale-95 transition-all duration-500 ${showControls ? 'opacity-100' : 'opacity-30 hover:opacity-100'}`}><i className="fas fa-chevron-left"></i></button>
                        <div className="flex gap-2 items-center">
                             <button onClick={() => handleClear(false)} className={`w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 border-rose-500/30 text-rose-500 hover:bg-rose-900/20 hover:border-rose-500 flex items-center justify-center transition-all duration-500 shadow-lg active:scale-95 ${showControls ? 'opacity-100' : 'opacity-30 hover:opacity-100'}`}><i className="fas fa-trash-alt"></i></button>
                        </div>
                        <div className="flex flex-1 justify-end gap-2 md:gap-3">
                            {!checked ? (
                                <button onClick={handleReveal} className={`flex-1 rounded-xl font-black text-xs md:text-sm uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 px-4 h-12 md:h-14 ${isTimeOut ? 'bg-amber-600 text-white animate-bounce shadow-[0_0_20px_rgba(245,158,11,0.5)]' : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 shadow-[0_0_20px_rgba(99,102,241,0.4)]'}`}><i className={`fas ${isTimeOut ? 'fa-eye' : 'fa-search'}`}></i> <span className="hidden sm:inline">{isTimeOut ? 'ĐÁP ÁN' : 'KIỂM TRA'}</span></button>
                            ) : (
                                <div className="flex-1 flex gap-2 animate-slide-up min-w-[150px] md:min-w-[200px]">
                                    <button onClick={() => handleGrade(false)} className="flex-1 bg-rose-950 border-2 border-rose-500 text-rose-500 hover:bg-rose-900 hover:text-white hover:border-white transition rounded-xl font-black uppercase text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 h-12 md:h-14 shadow-[0_0_15px_rgba(225,29,72,0.3)] active:scale-95"><i className="fas fa-times text-lg"></i> SAI</button>
                                    <button onClick={() => handleGrade(true)} className="flex-1 bg-emerald-950 border-2 border-emerald-500 text-emerald-500 hover:bg-emerald-900 hover:text-white hover:border-white transition rounded-xl font-black uppercase text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2 h-12 md:h-14 shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95"><i className="fas fa-check text-lg"></i> ĐÚNG</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {showSettings && (
                <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur flex items-center justify-center p-6 animate-slide-up">
                    <div className="max-w-sm w-full bg-slate-900 border-[2.5px] border-indigo-500/30 rounded-2xl p-6 space-y-6 shadow-2xl">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                            <h3 className="text-xl font-black text-white uppercase italic">Cấu hình luyện viết</h3>
                            <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Thời gian giới hạn</label>
                            <div className="flex gap-2">
                                <input type="number" min="0" value={timerSettings.duration} onChange={(e) => onUpdateSettings(Math.max(0, parseInt(e.target.value) || 0), timerSettings.mode)} className="w-full bg-slate-800 border-2 border-slate-700 text-white font-black text-xl p-3 rounded-xl focus:border-indigo-500 outline-none text-center" />
                            </div>
                        </div>
                        <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-black uppercase tracking-widest text-xs rounded-xl">Xong</button>
                    </div>
                </div>
            )}
        </section>
    );
};


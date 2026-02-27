
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

    const getPos = (e: React.MouseEvent | React.TouchEvent, cv: HTMLCanvasElement) => {
        const rect = cv.getBoundingClientRect();
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent, key: 'kanji' | 'hira') => {
        if (e.cancelable) e.preventDefault();
        if (checked || isTimeOut) return;
        isDrawing.current = true;
        const cv = canvasRefs[key].current;
        if (!cv) return;
        const ctx = cv.getContext('2d');
        const { x, y } = getPos(e, cv);
        if (ctx) { ctx.beginPath(); ctx.moveTo(x, y); }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent, key: 'kanji' | 'hira') => {
        if (e.cancelable) e.preventDefault();
        if (!isDrawing.current || checked || isTimeOut) return;
        const cv = canvasRefs[key].current;
        if (!cv) return;
        const ctx = cv.getContext('2d');
        const { x, y } = getPos(e, cv);
        if (ctx) { ctx.lineTo(x, y); ctx.stroke(); }
    };

    const stopDrawing = () => { isDrawing.current = false; };

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
                <div className="flex-none h-14 md:h-20 px-3 md:px-6 bg-slate-900/50 backdrop-blur border-b border-white/10 flex items-center justify-between z-20">
                <div className="flex items-center gap-2 md:gap-4">
                    <div className="flex flex-col">
                        <div className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest flex justify-between w-24 md:w-32 mb-1">
                            <span>Tiến độ</span>
                            <span>{index + 1} / {total}</span>
                        </div>
                        <div className="h-1.5 w-24 md:w-32 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                    </div>
                    {lessonId && (
                        <div className="hidden md:block text-[9px] font-black uppercase text-indigo-400 tracking-widest border border-indigo-500/30 px-2 py-1 rounded bg-indigo-900/20">
                            {lessonId === 'SRS' ? 'ÔN TẬP' : `BÀI ${lessonId}`}
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-center">
                    <h2 className="text-lg md:text-2xl font-black uppercase tracking-widest text-white truncate max-w-[120px] md:max-w-md text-center">{displayMean}</h2>
                    <div className="text-[10px] md:text-xs font-black text-emerald-500">Điểm: {points}</div>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                    <button onClick={() => setShowSettings(true)} className={`px-2 py-1 md:px-3 md:py-1.5 rounded-xl border-2 font-black text-[10px] md:text-sm font-mono tracking-widest flex items-center gap-1 md:gap-2 transition ${isTimeOut ? 'bg-rose-900 border-rose-500 text-rose-500 animate-pulse' : 'bg-black/40 border-slate-700 text-slate-300 hover:border-indigo-500'}`}>
                        {timerSettings.duration > 0 ? (
                            <><i className="fas fa-clock text-[8px] md:text-xs"></i>{Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{Math.floor(timeLeft % 60).toString().padStart(2, '0')}</>
                        ) : ( <><i className="fas fa-infinity text-[8px] md:text-xs"></i> --:--</> )}
                    </button>
                </div>
            </div>

            <div ref={containerRef} className="flex-1 p-2 md:p-4 w-full h-full flex flex-col md:flex-row gap-2 md:gap-4 min-h-0 relative z-10">
                <div className={`flex-1 relative rounded-2xl border-[3px] bg-[#0B1120] overflow-hidden group transition-colors duration-300 ${checked ? 'border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'border-indigo-500/30'} ${showGrid ? 'drawing-grid' : ''}`}>
                    <span className="absolute top-2 left-3 md:top-3 md:left-4 text-[10px] md:text-xs font-black text-indigo-500/40 pointer-events-none z-0 tracking-[0.2em]">KANJI / HÁN TỰ</span>
                    {(showGhost || checked) && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                             <div className={`font-serif text-center leading-tight transition-all duration-500 ${checked ? 'text-emerald-400 opacity-80' : 'text-slate-600 opacity-20'}`} style={{ fontSize: '15vh' }}>{displayKanji}</div>
                        </div>
                    )}
                    <canvas ref={canvasRefs.kanji} onMouseDown={(e) => startDrawing(e, 'kanji')} onMouseMove={(e) => draw(e, 'kanji')} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={(e) => startDrawing(e, 'kanji')} onTouchMove={(e) => draw(e, 'kanji')} onTouchEnd={stopDrawing} className="absolute inset-0 cursor-crosshair z-10 touch-none" />
                </div>

                <div className={`flex-1 relative rounded-2xl border-[3px] bg-[#0B1120] overflow-hidden transition-colors duration-300 ${checked ? 'border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'border-fuchsia-500/30'} ${showGrid ? 'drawing-grid' : ''}`}>
                    <span className="absolute top-2 left-3 md:top-3 md:left-4 text-[10px] md:text-xs font-black text-fuchsia-500/40 pointer-events-none z-0 tracking-[0.2em]">READING / CÁCH ĐỌC</span>
                     {(showGhost || checked) && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                             <div className={`font-serif text-center leading-tight transition-all duration-500 ${checked ? 'text-emerald-400 opacity-80' : 'text-slate-600 opacity-20'}`} style={{ fontSize: '15vh' }}>{vocab.ka}</div>
                        </div>
                    )}
                    <canvas ref={canvasRefs.hira} onMouseDown={(e) => startDrawing(e, 'hira')} onMouseMove={(e) => draw(e, 'hira')} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={(e) => startDrawing(e, 'hira')} onTouchMove={(e) => draw(e, 'hira')} onTouchEnd={stopDrawing} className="absolute inset-0 cursor-crosshair z-10 touch-none" />
                </div>
            </div>

            <div className="flex-none p-2 md:p-4 bg-slate-900/50 backdrop-blur border-t border-white/10 z-20">
                <div className="flex items-center justify-between gap-2 md:gap-4 h-14 md:h-16">
                    <button onClick={onPrev} className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-800 border-2 border-slate-600 text-slate-400 hover:text-white transition flex items-center justify-center"><i className="fas fa-chevron-left"></i></button>
                    <div className="flex gap-2 items-center">
                         <button onClick={() => handleClear(false)} className="w-10 h-10 md:w-12 md:h-12 rounded-xl border-2 border-rose-500/30 text-rose-500 hover:bg-rose-900/20 hover:border-rose-500 flex items-center justify-center transition"><i className="fas fa-trash-alt"></i></button>
                    </div>
                    <div className="flex flex-1 justify-end gap-2 md:gap-3">
                        {!checked ? (
                            <button onClick={handleReveal} className={`flex-1 rounded-xl font-black text-xs md:text-sm uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 px-4 ${isTimeOut ? 'bg-amber-600 text-white animate-bounce' : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white'}`}><i className={`fas ${isTimeOut ? 'fa-eye' : 'fa-search'}`}></i> <span className="hidden sm:inline">{isTimeOut ? 'ĐÁP ÁN' : 'KIỂM TRA'}</span></button>
                        ) : (
                            <div className="flex-1 flex gap-2 animate-slide-up min-w-[150px] md:min-w-[200px]">
                                <button onClick={() => handleGrade(false)} className="flex-1 bg-rose-950 border-2 border-rose-500 text-rose-500 rounded-xl font-black uppercase text-[10px] md:text-xs flex items-center justify-center gap-1 md:gap-2"><i className="fas fa-times"></i> SAI</button>
                                <button onClick={() => handleGrade(true)} className="flex-1 bg-emerald-950 border-2 border-emerald-500 text-emerald-500 rounded-xl font-black uppercase text-[10px] md:text-xs flex items-center justify-center gap-1 md:gap-2"><i className="fas fa-check"></i> ĐÚNG</button>
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



import React, { useMemo, useRef, useState, useEffect } from 'react';
import { AppDatabase, Vocab } from '../../types';
import { getRelatedVocab, getPhoneticFamily, getVocabStatus } from '../../services/storageService';
import { playSfx } from '../../services/audioService';

interface KanjiNetworkViewProps {
    char: string;
    db: AppDatabase;
    onClose: () => void;
    onOpenRules: () => void;
}

type ToolType = 'pen' | 'highlighter' | 'eraser' | 'text';
type ColorType = string;

export const KanjiNetworkView: React.FC<KanjiNetworkViewProps> = ({ char, db, onClose, onOpenRules }) => {
    const contextVocab = useMemo(() => {
        return db.vocab.find(v => v.kj === char) || db.vocab.find(v => v.kj && v.kj.includes(char));
    }, [db, char]);

    const exactHV = useMemo(() => {
        if (!contextVocab || !contextVocab.hv || !contextVocab.kj) return "";
        if (contextVocab.kj === char) return contextVocab.hv;
        const idx = contextVocab.kj.indexOf(char);
        const hvParts = contextVocab.hv.split(' ');
        if (idx >= 0 && idx < hvParts.length) return hvParts[idx];
        return hvParts[0] || "";
    }, [contextVocab, char]);

    const relatedWords = useMemo(() => getRelatedVocab(db, char).map(v => getVocabStatus(db, v)), [db, char]);
    const phoneticFamily = useMemo(() => getPhoneticFamily(db, exactHV).map(v => getVocabStatus(db, v)), [db, exactHV]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [tool, setTool] = useState<ToolType>('pen');
    const [color, setColor] = useState<ColorType>('#ffffff');
    const [blindMode, setBlindMode] = useState(true); 
    const [autoSave, setAutoSave] = useState(true); // Default autosave to true
    const [zoomItem, setZoomItem] = useState<Vocab | null>(null);
    const [textInput, setTextInput] = useState<{x: number, y: number, text: string} | null>(null);
    const isDrawing = useRef(false);

    const PALETTE = ['#ffffff', '#94a3b8', '#ef4444', '#f97316', '#eab308', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#a855f7'];

    // Canvas Logic
    const initCanvas = () => {
        const cv = canvasRef.current;
        const container = containerRef.current;
        if (!cv || !container) return;
        
        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const dpr = window.devicePixelRatio || 1;
        
        // Only resize if dimensions changed to avoid clearing content unnecessarily
        if (cv.width !== rect.width * dpr || cv.height !== rect.height * dpr) {
            cv.width = rect.width * dpr;
            cv.height = rect.height * dpr;
            
            const ctx = cv.getContext('2d');
            if (ctx) {
                ctx.scale(dpr, dpr);
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // Restore context settings
                ctx.strokeStyle = tool === 'eraser' ? '#0B1120' : color;
                ctx.lineWidth = tool === 'highlighter' ? 15 : tool === 'pen' ? 2 : 20;
                ctx.globalAlpha = tool === 'highlighter' ? 0.3 : 1;
                if (tool === 'eraser') ctx.globalAlpha = 1;

                // ALWAYS try to load saved draft, regardless of autosave setting
                const saved = localStorage.getItem(`draft_${char}`);
                if (saved) {
                    const img = new Image();
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0, rect.width, rect.height);
                    };
                    img.src = saved;
                }
            }
        }
    };

    useEffect(() => {
        initCanvas();
        const resizeObserver = new ResizeObserver(() => initCanvas());
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [char, tool, color]); // Re-init when char or tools change to ensure context is correct

    const saveDraft = () => {
        const cv = canvasRef.current;
        if (cv) {
            localStorage.setItem(`draft_${char}`, cv.toDataURL());
            if (!autoSave) playSfx(800, 'sine', 0.1); // feedback
        }
    };

    const clearCanvas = () => {
        const cv = canvasRef.current;
        const ctx = cv?.getContext('2d');
        if (cv && ctx) {
            ctx.clearRect(0, 0, cv.width, cv.height);
            saveDraft();
        }
    };

    const getPos = (e: any) => {
        const cv = canvasRef.current;
        if (!cv) return { x: 0, y: 0 };
        const rect = cv.getBoundingClientRect();
        
        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        return { 
            x: clientX - rect.left, 
            y: clientY - rect.top 
        };
    };

    const startDrawing = (e: any) => {
        if (e.cancelable && (e.type === 'touchstart' || e.type === 'touchmove')) e.preventDefault(); // Prevent scrolling on touch
        
        if (tool === 'text') {
            const { x, y } = getPos(e);
            setTextInput({ x, y, text: '' });
            return;
        }

        isDrawing.current = true;
        const { x, y } = getPos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            // Ensure context settings are current
            ctx.strokeStyle = tool === 'eraser' ? '#0B1120' : color;
            ctx.lineWidth = tool === 'highlighter' ? 15 : tool === 'pen' ? 2 : 20;
            ctx.globalAlpha = tool === 'highlighter' ? 0.3 : 1;
            if (tool === 'eraser') ctx.globalAlpha = 1;
        }
    };

    const draw = (e: any) => {
        if (e.cancelable && (e.type === 'touchstart' || e.type === 'touchmove')) e.preventDefault(); // Prevent scrolling on touch
        
        if (!isDrawing.current || tool === 'text') return;
        const { x, y } = getPos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    };

    const stopDrawing = () => {
        isDrawing.current = false;
        if (autoSave && tool !== 'text') saveDraft();
    };

    const commitText = () => {
        if (!textInput || !textInput.text.trim()) {
            setTextInput(null);
            return;
        }
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.font = 'bold 20px "Plus Jakarta Sans"';
            ctx.fillStyle = color;
            ctx.fillText(textInput.text, textInput.x, textInput.y + 20);
            if (autoSave) saveDraft();
        }
        setTextInput(null);
    };

    return (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl z-50 animate-slide-up flex flex-col overflow-hidden">
            {/* Header */}
            <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/10 bg-slate-900/50">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center"><i className="fas fa-arrow-left"></i></button>
                    <span className="text-neon-purple font-black uppercase tracking-widest text-xs">NHÁP</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={onOpenRules} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[8px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition">
                        <i className="fas fa-table mr-2 text-indigo-400"></i> Bảng quy tắc
                    </button>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl border border-white/10 hover:bg-white/5 text-slate-400 flex items-center justify-center transition"><i className="fas fa-times"></i></button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 flex min-h-0">
                
                {/* LEFT: CANVAS AREA */}
                <div className="flex-[3] relative flex flex-col bg-[#0B1120] border-r border-white/10" ref={containerRef}>
                    {/* Info Overlay */}
                    <div className="absolute top-4 left-0 w-full z-10 pointer-events-none flex justify-center items-start gap-12">
                         <div className="flex flex-col items-center">
                            <span className="text-[8px] text-pink-500 font-black uppercase tracking-widest bg-black/50 px-2 rounded backdrop-blur border border-pink-500/20">Hán Việt</span>
                            <span className="text-3xl font-black text-pink-400 drop-shadow-md mt-1">{exactHV || "---"}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[8px] text-emerald-500 font-black uppercase tracking-widest bg-black/50 px-2 rounded backdrop-blur border border-emerald-500/20">Ý Nghĩa</span>
                            <span className="text-xl font-bold text-white mt-1 drop-shadow-md">{contextVocab?.mean || "---"}</span>
                        </div>
                         {/* Removed English Box as requested */}
                    </div>

                    {/* Canvas & Blind Mode */}
                    <div className="absolute inset-0">
                         {/* Watermark/Ghost Kanji */}
                        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-500 ${!blindMode ? 'opacity-20' : 'opacity-0'}`}>
                            <span className="font-serif text-[clamp(150px,40vh,300px)] text-white select-none">{char}</span>
                        </div>
                        {/* Blind Mode Icon Indicator */}
                        {blindMode && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5"><i className="fas fa-eye-slash text-7xl"></i></div>}
                        
                        <canvas 
                            ref={canvasRef} 
                            className={`absolute inset-0 w-full h-full touch-none z-20 ${tool === 'text' ? 'cursor-text' : 'cursor-crosshair'}`}
                            onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                        />
                         <div className="absolute inset-0 pointer-events-none drawing-grid opacity-20 z-0"></div>

                         {/* Text Input Overlay */}
                         {textInput && (
                             <input
                                autoFocus
                                className="absolute bg-transparent border-b border-white text-white font-bold outline-none z-30 min-w-[100px]"
                                style={{ left: textInput.x, top: textInput.y, color: color, fontSize: '16px' }}
                                value={textInput.text}
                                onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
                                onBlur={commitText}
                                onKeyDown={(e) => { if (e.key === 'Enter') commitText(); }}
                             />
                         )}
                    </div>

                    {/* Bottom Toolbar */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-wrap justify-center items-center gap-2 p-2 rounded-2xl bg-slate-900/95 border border-slate-600 backdrop-blur shadow-[0_0_30px_rgba(0,0,0,0.8)] w-[95%] max-w-max">
                        <button onClick={() => setBlindMode(!blindMode)} className={`px-3 h-8 rounded-xl flex items-center justify-center gap-2 border transition font-black text-[10px] uppercase tracking-widest ${!blindMode ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-slate-800 text-slate-400 border-slate-600'}`}>
                             <i className={`fas ${!blindMode ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                             <span className="hidden sm:inline">{!blindMode ? 'ẨN ĐÁP ÁN' : 'HIỆN ĐÁP ÁN'}</span>
                             <span className="sm:hidden">ĐÁP ÁN</span>
                        </button>
                        <div className="w-[1px] h-6 bg-slate-700 mx-1"></div>
                        <button onClick={() => setAutoSave(!autoSave)} className={`flex items-center gap-2 px-3 h-8 rounded-xl border transition text-[8px] font-black uppercase ${autoSave ? 'bg-emerald-900/50 text-emerald-400 border-emerald-500' : 'bg-slate-800 text-slate-500 border-slate-600'}`}>
                            <i className="fas fa-save"></i> {autoSave ? 'Auto' : 'Manual'}
                        </button>
                        <div className="w-[1px] h-6 bg-slate-700 mx-1"></div>
                        
                        <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-slate-700">
                             {PALETTE.slice(0, 5).map(c => (
                                 <button key={c} onClick={() => setColor(c)} className={`w-5 h-5 rounded-full border-2 transition hover:scale-110 ${color === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }}></button>
                             ))}
                        </div>

                        <div className="w-[1px] h-6 bg-slate-700 mx-1"></div>
                        
                        <button onClick={() => setTool('pen')} className={`w-8 h-8 rounded-xl flex items-center justify-center border transition ${tool === 'pen' ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800'}`}><i className="fas fa-pen text-xs"></i></button>
                        <button onClick={() => setTool('text')} className={`w-8 h-8 rounded-xl flex items-center justify-center border transition ${tool === 'text' ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800'}`}><i className="fas fa-font text-xs"></i></button>
                        <button onClick={() => setTool('highlighter')} className={`w-8 h-8 rounded-xl flex items-center justify-center border transition ${tool === 'highlighter' ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800'}`}><i className="fas fa-highlighter text-xs"></i></button>
                        <button onClick={() => setTool('eraser')} className={`w-8 h-8 rounded-xl flex items-center justify-center border transition ${tool === 'eraser' ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800'}`}><i className="fas fa-eraser text-xs"></i></button>
                        <button onClick={clearCanvas} className="w-8 h-8 rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-900/30 transition"><i className="fas fa-trash text-xs"></i></button>
                        
                        {autoSave ? null : (
                            <button onClick={saveDraft} className="w-10 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition ml-2"><i className="fas fa-check"></i></button>
                        )}
                    </div>
                </div>

                {/* RIGHT: SIDEBAR (Reference Data) */}
                <div className="hidden md:flex w-72 flex-col bg-slate-950/80 border-l border-white/10">
                     <div className="p-4 border-b border-white/10 bg-slate-900/50">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dữ liệu tham chiếu</h3>
                     </div>
                     <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-8">
                        {/* Sound Family */}
                         <div className="space-y-3">
                            <div className="text-[8px] font-black text-amber-500 uppercase tracking-widest border-b border-amber-500/20 pb-1">Họ hàng âm (Sound Family)</div>
                            {phoneticFamily.length === 0 ? <div className="text-[10px] text-slate-500 italic">Không có dữ liệu</div> : 
                                phoneticFamily.map((item, idx) => (
                                    <div key={idx} onClick={() => setZoomItem(item.vocab)} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-white/10 hover:border-amber-500/50 hover:bg-slate-800 cursor-pointer transition group">
                                        <span className="text-2xl font-serif text-white group-hover:text-amber-400 transition">{item.vocab.kj}</span>
                                        <div>
                                            <div className="text-[10px] font-black text-amber-500">{item.vocab.hv}</div>
                                            <div className="text-[8px] text-slate-500 uppercase">{item.vocab.ka}</div>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>

                        {/* Related Vocab */}
                        <div className="space-y-3">
                            <div className="text-[8px] font-black text-emerald-500 uppercase tracking-widest border-b border-emerald-500/20 pb-1">Từ vựng liên quan ({relatedWords.length})</div>
                             {relatedWords.length === 0 ? <div className="text-[10px] text-slate-500 italic">Không có từ vựng liên quan</div> :
                                relatedWords.slice(0, 10).map((item, idx) => (
                                    <div key={idx} onClick={() => setZoomItem(item.vocab)} className="block p-3 rounded-xl bg-slate-900/50 border border-white/10 hover:border-emerald-500 transition group cursor-pointer hover:bg-slate-800">
                                        <div className="flex justify-between items-start">
                                             <span className="text-lg font-serif text-white group-hover:text-emerald-300 transition">{item.vocab.kj}</span>
                                             <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${item.status === 'graduated' ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-950 text-slate-600'}`}>{item.status}</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-300 mt-1">{item.vocab.ka}</div>
                                        <div className="text-[8px] text-slate-500 truncate mt-0.5">{item.vocab.mean}</div>
                                    </div>
                                ))
                             }
                        </div>
                     </div>
                </div>
            </div>

            {/* Popup Zoom Item */}
            {zoomItem && (
                <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-slide-up" onClick={() => setZoomItem(null)}>
                    <div className="max-w-md w-full bg-slate-900 border-[3px] border-indigo-500 rounded-3xl p-6 flex flex-col items-center gap-4 relative shadow-2xl" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setZoomItem(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
                        <div className="text-center">
                            <div className="text-6xl font-serif text-white mb-2">{zoomItem.kj || zoomItem.ka}</div>
                            <div className="text-xl font-black text-emerald-400">{zoomItem.ka}</div>
                            <div className="text-base font-black font-mono text-slate-500 uppercase tracking-widest mb-4">{zoomItem.ro}</div>
                            <div className="bg-slate-950 rounded-xl p-4 w-full border border-slate-800">
                                <div className="text-xs font-black text-pink-400 uppercase tracking-widest mb-1">Hán Việt: {zoomItem.hv}</div>
                                <div className="text-lg font-bold text-white">{zoomItem.mean}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

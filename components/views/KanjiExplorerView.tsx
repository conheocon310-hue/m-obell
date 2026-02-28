
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppDatabase, Vocab } from '../../types';
import { getDueVocab } from '../../services/storageService';

interface KanjiExplorerViewProps {
    db: AppDatabase;
    onClose: () => void;
    onReviewLesson: (lessonId: string) => void;
    onReviewDueKanji: () => void;
}

type FilterType = 'all' | 'mastered' | 'learning';

export const KanjiExplorerView: React.FC<KanjiExplorerViewProps> = ({ db, onClose, onReviewLesson, onReviewDueKanji }) => {
    const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<FilterType>('all');
    const [popupVocab, setPopupVocab] = useState<Vocab | null>(null);
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [selectedDuplicate, setSelectedDuplicate] = useState<{ char: string, words: Vocab[] } | null>(null);

    const dueKanjiCount = useMemo(() => getDueVocab(db, 'kanji').length, [db]);

    const toggleLesson = (lessonId: string) => {
        const newSet = new Set(expandedLessons);
        if (newSet.has(lessonId)) newSet.delete(lessonId);
        else newSet.add(lessonId);
        setExpandedLessons(newSet);
    };

    // LOGIC FOR DUPLICATE KANJI
    const duplicateKanjiData = useMemo(() => {
        if (!showDuplicates) return [];
        const counts: Record<string, { count: number, words: Vocab[], firstLesson: number }> = {};
        
        db.vocab.forEach(v => {
            if (!v.kj || v.kj === '-' || v.kj === '---') return;
            
            // Extract unique Kanji characters from the word
            const chars = Array.from(new Set(v.kj.split('')));
            chars.forEach(char => {
                // Check if it is a Kanji (Common CJK Unified Ideographs range)
                if (char.match(/[\u4e00-\u9faf]/)) {
                    if (!counts[char]) {
                        counts[char] = { count: 0, words: [], firstLesson: 9999 };
                    }
                    counts[char].count++;
                    counts[char].words.push(v);
                    const lessonNum = parseInt(v.lesson);
                    if (lessonNum < counts[char].firstLesson) {
                        counts[char].firstLesson = lessonNum;
                    }
                }
            });
        });

        // Group by ranges: 2-4, 5-10, 11-15, ...
        // Range size logic: 
        // Group 1: 2-4 (size 3)
        // Group 2: 5-10 (size 6) - Wait, user said "groups separated by 4 units". 
        // Let's assume standard buckets: 2-4, 5-9, 10-14, 15-19... (size 5 starting from 5?)
        // Or strictly follow the user's example: 2-4, 5-10, 11-15.
        // 2-4 is range [2, 4].
        // 5-10 is range [5, 10].
        // 11-15 is range [11, 15].
        // It seems the user wants specific ranges. Let's implement dynamic grouping.
        // Let's use: 2-4, 5-9, 10-14, 15-19, 20+ to be consistent with "4 units" separation (5,6,7,8,9 is 5 units).
        // Actually "cách nhau 4 đơn vị" usually means step is 5 (e.g. 0, 5, 10).
        // Let's stick to the user's explicit examples: 2-4, 5-10, 11-15.
        // Then maybe 16-20, 21-25?
        
        const groups: Record<string, typeof counts[string][]> = {};
        
        Object.entries(counts).forEach(([char, data]) => {
            if (data.count < 2) return;
            
            let groupKey = '';
            if (data.count <= 4) groupKey = '2 - 4 lần';
            else if (data.count <= 10) groupKey = '5 - 10 lần';
            else if (data.count <= 15) groupKey = '11 - 15 lần';
            else if (data.count <= 20) groupKey = '16 - 20 lần';
            else groupKey = 'Trên 20 lần';

            if (!groups[groupKey]) groups[groupKey] = [];
            // Add char to data for sorting
            groups[groupKey].push({ ...data, char } as any);
        });

        // Sort items within groups
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count;
                return a.firstLesson - b.firstLesson;
            });
        });

        // Return array of [groupLabel, items]
        // Define order of keys
        const order = ['Trên 20 lần', '16 - 20 lần', '11 - 15 lần', '5 - 10 lần', '2 - 4 lần'];
        return order.map(key => ({ key, items: groups[key] || [] })).filter(g => g.items.length > 0);
    }, [db.vocab, showDuplicates]);

    const groupedData = useMemo(() => {
        const groups: Record<string, { kanjis: Vocab[], words: Vocab[] }> = {};
        db.vocab.forEach(v => {
            if (v.kj && v.kj !== '-' && v.kj !== '---') {
                const status = db.srs[v.id]?.status || 'new';
                const isMastered = status === 'review';
                if (filter === 'mastered' && !isMastered) return;
                if (filter === 'learning' && isMastered) return;
                if (!groups[v.lesson]) groups[v.lesson] = { kanjis: [], words: [] };
                
                if (v.type === 'kanji') {
                    groups[v.lesson].kanjis.push(v);
                } else {
                    groups[v.lesson].words.push(v);
                }
            }
        });
        return Object.entries(groups).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    }, [db.vocab, db.srs, filter]);

    const getStatusColor = (vId: string) => {
        const status = db.srs[vId]?.status || 'new';
        if (status === 'review') return 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'; 
        if (status === 'learning') return 'border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]'; 
        return 'border-slate-700 opacity-60'; 
    };

    const MiniCanvas = ({ char }: { char: string }) => {
        const cvRef = useRef<HTMLCanvasElement>(null);
        const containerRef = useRef<HTMLDivElement>(null);
        const isDrawing = useRef(false);
        const [showGhost, setShowGhost] = useState(false);
        const [inkColor, setInkColor] = useState('#ffffff');
        const [brushStyle, setBrushStyle] = useState<'pen' | 'marker'>('pen');

        const updateContext = () => {
            const cv = cvRef.current;
            const ctx = cv?.getContext('2d');
            if(ctx) {
                ctx.strokeStyle = inkColor; 
                ctx.lineWidth = brushStyle === 'pen' ? 4 : 12; 
                ctx.lineCap = 'round'; 
                ctx.lineJoin = 'round'; 
                ctx.shadowBlur = brushStyle === 'marker' ? 15 : 0;
                ctx.shadowColor = inkColor;
            }
        };

        const initCanvas = () => {
            const cv = cvRef.current;
            const container = containerRef.current;
            if(!cv || !container) return;
            
            const rect = container.getBoundingClientRect();
            if(rect.width === 0 || rect.height === 0) return;

            // Only resize if dimensions changed to avoid clearing content unnecessarily
            if (cv.width !== rect.width || cv.height !== rect.height) {
                cv.width = rect.width;
                cv.height = rect.height;
                updateContext();
            }
        };

        useEffect(() => {
            updateContext();
        }, [inkColor, brushStyle]);

        useEffect(() => {
            initCanvas();
            const resizeObserver = new ResizeObserver(() => initCanvas());
            if (containerRef.current) resizeObserver.observe(containerRef.current);
            return () => resizeObserver.disconnect();
        }, []);

        const getPos = (e: React.MouseEvent | React.TouchEvent) => {
            const cv = cvRef.current;
            if (!cv) return { x: 0, y: 0 };
            const rect = cv.getBoundingClientRect();
            let clientX, clientY;
            
            if ('touches' in e) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = (e as React.MouseEvent).clientX;
                clientY = (e as React.MouseEvent).clientY;
            }
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const start = (e: React.MouseEvent | React.TouchEvent) => {
            if (e.cancelable && 'touches' in e) e.preventDefault();
            isDrawing.current = true;
            const ctx = cvRef.current?.getContext('2d');
            const { x, y } = getPos(e);
            if(ctx) { ctx.beginPath(); ctx.moveTo(x, y); }
        };

        const move = (e: React.MouseEvent | React.TouchEvent) => {
            if (e.cancelable && 'touches' in e) e.preventDefault();
            if(!isDrawing.current) return;
            const ctx = cvRef.current?.getContext('2d');
            const { x, y } = getPos(e);
            if(ctx) { ctx.lineTo(x, y); ctx.stroke(); }
        };

        const end = () => { isDrawing.current = false; };
        
        const clear = () => { 
            const cv = cvRef.current; 
            const ctx = cv?.getContext('2d'); 
            if(cv && ctx) {
                ctx.clearRect(0,0,cv.width, cv.height);
                ctx.beginPath();
            }
        };

        return (
            <div className="w-full flex flex-col gap-2">
                <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Luyện viết nhanh</span>
                    <div className="flex gap-1">
                        <button onClick={() => setBrushStyle('pen')} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] ${brushStyle === 'pen' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}><i className="fas fa-pen"></i></button>
                        <button onClick={() => setBrushStyle('marker')} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] ${brushStyle === 'marker' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}><i className="fas fa-highlighter"></i></button>
                        <button onClick={() => setShowGhost(!showGhost)} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] ${showGhost ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'}`} title="Hiện đáp án"><i className="fas fa-eye"></i></button>
                        <button onClick={clear} className="w-6 h-6 rounded flex items-center justify-center text-[10px] bg-rose-900/50 text-rose-400 hover:bg-rose-600 hover:text-white" title="Xóa"><i className="fas fa-eraser"></i></button>
                    </div>
                </div>
                <div className="flex gap-1 justify-center mb-1">
                    {['#ffffff', '#34d399', '#f472b6', '#fbbf24', '#22d3ee'].map(c => (
                        <button key={c} onClick={() => setInkColor(c)} className={`w-5 h-5 rounded-full border-2 ${inkColor === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }}></button>
                    ))}
                </div>
                <div ref={containerRef} className="w-full aspect-square bg-slate-950 border-2 border-indigo-500/50 rounded-xl relative overflow-hidden group touch-none">
                     {showGhost && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20"><span className="font-serif text-[120px] text-white">{char}</span></div>}
                     <canvas 
                        ref={cvRef} 
                        className="absolute inset-0 cursor-crosshair touch-none w-full h-full" 
                        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} 
                        onTouchStart={start} onTouchMove={move} onTouchEnd={end} 
                    />
                </div>
            </div>
        );
    };

    return (
        <section className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl animate-slide-up flex flex-col overflow-hidden z-50">
            <div className="h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-white/10 bg-slate-900">
                <h2 className="text-xl font-black text-white uppercase tracking-widest italic">KHO BÁU KANJI</h2>
                <div className="flex gap-2">
                    {dueKanjiCount > 0 && (
                        <button onClick={onReviewDueKanji} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-lg animate-pulse transition">
                            <i className="fas fa-fire mr-2"></i> Ôn tập ({dueKanjiCount})
                        </button>
                    )}
                </div>
            </div>
            <div className="flex p-4 gap-2 bg-slate-900/50 border-b border-slate-800 overflow-x-auto shrink-0">
                {[{ id: 'all', label: 'Tất cả', icon: 'fa-layer-group', color: 'bg-indigo-600' }, { id: 'mastered', label: 'Đã thuộc', icon: 'fa-check-circle', color: 'bg-emerald-600' }, { id: 'learning', label: 'Đang học', icon: 'fa-brain', color: 'bg-orange-600' }].map((item) => (
                    <button key={item.id} onClick={() => { setFilter(item.id as FilterType); setShowDuplicates(false); }} className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${!showDuplicates && filter === item.id ? `${item.color} border-transparent text-white shadow-lg` : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                        <i className={`fas ${item.icon}`}></i> {item.label}
                    </button>
                ))}
                <div className="w-px h-6 bg-slate-700 mx-2"></div>
                <button 
                    onClick={() => setShowDuplicates(true)} 
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${showDuplicates ? 'bg-pink-600 border-transparent text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                >
                    <i className="fas fa-clone"></i> Kanji Trùng
                </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {showDuplicates ? (
                    <div className="space-y-8">
                        {duplicateKanjiData.map(({ key, items }) => (
                            <div key={key}>
                                <div className="text-xs font-black text-pink-500 uppercase tracking-widest mb-3 border-b border-pink-500/20 pb-1 sticky top-0 bg-slate-950/95 backdrop-blur z-20 py-2">
                                    Nhóm {key} ({items.length})
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-3">
                                    {items.map((data: any) => (
                                        <div 
                                            key={data.char} 
                                            onClick={() => setSelectedDuplicate({ char: data.char, words: data.words })}
                                            className="aspect-square bg-slate-900 border border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800 hover:border-pink-500 hover:scale-105 transition group relative overflow-hidden"
                                        >
                                            <div className="text-4xl font-serif text-white mb-1">{data.char}</div>
                                            <div className="text-[10px] font-black text-pink-500 bg-pink-900/20 px-2 py-0.5 rounded-full border border-pink-500/30">
                                                {data.count} lần
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {duplicateKanjiData.length === 0 && (
                            <div className="col-span-full text-center py-20 text-slate-500 font-bold uppercase tracking-widest">
                                Không có Kanji nào xuất hiện trên 2 lần.
                            </div>
                        )}
                    </div>
                ) : groupedData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500"><i className="fas fa-search text-4xl mb-4 opacity-50"></i><p className="font-bold uppercase tracking-widest">Không tìm thấy Kanji phù hợp</p></div>
                ) : (
                    groupedData.map(([lessonId, { kanjis, words }]) => {
                        const isOpen = expandedLessons.has(lessonId);
                        const totalItems = kanjis.length + words.length;
                        const masteredCount = [...kanjis, ...words].filter(v => db.srs[v.id]?.status === 'review').length;
                        
                        return (
                            <div key={lessonId} className="rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden transition-all duration-300">
                                <div className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition ${isOpen ? 'bg-slate-800 border-b border-slate-700' : ''}`} onClick={() => toggleLesson(lessonId)}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center font-black text-indigo-400">{lessonId}</div>
                                        <div><div className="text-sm font-black text-white uppercase tracking-wider">Bài {lessonId}</div><div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5"><span className="text-emerald-500">{masteredCount} thuộc</span> / {totalItems} Mục</div></div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={(e) => { e.stopPropagation(); onReviewLesson(lessonId); }} className="hidden sm:flex px-3 py-1.5 bg-indigo-900/50 hover:bg-indigo-600 border border-indigo-500/30 rounded text-[9px] font-black text-indigo-300 hover:text-white uppercase tracking-widest transition items-center gap-2"><i className="fas fa-play"></i> Ôn tập</button>
                                        <i className={`fas fa-chevron-down text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
                                    </div>
                                </div>
                                {isOpen && (
                                    <div className="p-4 space-y-6 animate-slide-up">
                                        {/* GROUP 1: ISOLATED KANJI */}
                                        {kanjis.length > 0 && (
                                            <div>
                                                <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3 border-b border-emerald-500/20 pb-1">Kanji Đơn ({kanjis.length})</div>
                                                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-3">
                                                    {kanjis.map(v => (
                                                        <div key={v.id} onClick={() => setPopupVocab(v)} className={`group relative aspect-square rounded-xl bg-slate-950 border-2 flex items-center justify-center cursor-pointer overflow-hidden transition-all hover:scale-105 hover:z-10 ${getStatusColor(String(v.id))}`}>
                                                            <span className="text-3xl sm:text-4xl font-serif text-white group-hover:opacity-10 transition-opacity duration-200">{v.kj}</span>
                                                            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 text-center backdrop-blur-sm">
                                                                <div className="text-[9px] font-black text-pink-500 uppercase tracking-wider mb-1 line-clamp-1">{v.hv}</div>
                                                                <div className="text-[10px] font-bold text-emerald-400 leading-tight line-clamp-2">{v.mean}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* GROUP 2: VOCABULARY */}
                                        {words.length > 0 && (
                                            <div>
                                                <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3 border-b border-indigo-500/20 pb-1">Từ Vựng Chứa Kanji ({words.length})</div>
                                                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-3">
                                                    {words.map(v => (
                                                        <div key={v.id} onClick={() => setPopupVocab(v)} className={`group relative aspect-square rounded-xl bg-slate-950 border-2 flex items-center justify-center cursor-pointer overflow-hidden transition-all hover:scale-105 hover:z-10 ${getStatusColor(String(v.id))}`}>
                                                            <span className="text-xl sm:text-2xl font-serif text-white group-hover:opacity-10 transition-opacity duration-200">{v.kj}</span>
                                                            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 text-center backdrop-blur-sm">
                                                                <div className="text-[9px] font-black text-indigo-400 uppercase tracking-wider mb-1 line-clamp-1">{v.ro}</div>
                                                                <div className="text-[10px] font-bold text-slate-300 leading-tight line-clamp-2">{v.mean}</div>
                                                            </div>
                                                            {v.kj && v.kj.length > 1 && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-600"></div>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="col-span-3 sm:hidden mt-2"><button onClick={() => onReviewLesson(lessonId)} className="w-full py-3 bg-indigo-900/50 border border-indigo-500/30 rounded-xl text-indigo-300 text-xs font-black uppercase tracking-widest hover:bg-indigo-900 transition">Ôn tập bài này</button></div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
            
            {/* DUPLICATE KANJI DETAILS MODAL */}
            {selectedDuplicate && (
                <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-slide-up" onClick={() => setSelectedDuplicate(null)}>
                    <div className="max-w-md w-full bg-slate-900 border-[3px] border-pink-500 rounded-3xl p-6 flex flex-col gap-4 relative shadow-2xl max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedDuplicate(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
                        
                        <div className="text-center w-full border-b border-white/10 pb-4">
                            <div className="text-sm font-black text-pink-400 uppercase tracking-widest mb-1">KANJI TRÙNG LẶP</div>
                            <div className="text-6xl font-serif text-white leading-tight my-2">{selectedDuplicate.char}</div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Xuất hiện trong {selectedDuplicate.words.length} từ vựng</div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                            {selectedDuplicate.words.map((v, i) => (
                                <div 
                                    key={v.id} 
                                    onClick={() => setPopupVocab(v)}
                                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between hover:border-pink-500/50 hover:bg-slate-800 cursor-pointer transition group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-xs font-black text-slate-500 border border-slate-800 group-hover:text-white group-hover:border-pink-500 transition">{i + 1}</div>
                                        <div>
                                            <div className="text-lg font-serif text-white leading-none mb-1">{v.kj}</div>
                                            <div className="text-[10px] font-bold text-slate-400 line-clamp-1">{v.mean}</div>
                                        </div>
                                    </div>
                                    <div className="text-[9px] font-black text-indigo-400 bg-indigo-900/20 px-2 py-1 rounded border border-indigo-500/30">
                                        BÀI {v.lesson}
                                    </div>
                                </div>
                            ))}
                        </div>
                         <div className="text-[10px] text-slate-500 italic text-center w-full pt-2">Bấm vào từ để xem chi tiết</div>
                    </div>
                </div>
            )}

            {popupVocab && (
                <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-slide-up" onClick={() => setPopupVocab(null)}>
                    <div className="max-w-sm w-full bg-slate-900 border-[3px] border-indigo-500 rounded-3xl p-6 flex flex-col items-center gap-4 relative shadow-2xl" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setPopupVocab(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
                        <div className="text-center w-full border-b border-white/10 pb-4">
                            <div className="text-sm font-black text-pink-400 uppercase tracking-widest mb-1">{popupVocab.hv}</div>
                            <div className="text-xl font-bold text-white leading-tight">{popupVocab.mean}</div>
                        </div>
                        <div className="w-full">
                            <MiniCanvas char={popupVocab.kj || popupVocab.ka} />
                        </div>
                         <div className="text-[10px] text-slate-500 italic text-center w-full">Nhấn ra ngoài để đóng</div>
                    </div>
                </div>
            )}
        </section>
    );
};

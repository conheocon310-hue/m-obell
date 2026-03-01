
import { useState, useEffect, useMemo } from 'react';
import { Layout } from './components/Layout';
import { DashboardView } from './components/views/DashboardView';
import { DataFactoryView } from './components/views/DataFactoryView';
import { LessonListView } from './components/views/LessonListView';
import { StudyView } from './components/views/StudyView';
import { WritingView } from './components/views/WritingView';
import { ReflexView } from './components/views/ReflexView';
import { BlitzGameView } from './components/views/BlitzGameView';
import { CramModeView } from './components/views/CramModeView';
import { KanjiNetworkView } from './components/views/KanjiNetworkView'; 
import { RuleExplorerView } from './components/views/RuleExplorerView';
import { KanjiExplorerView } from './components/views/KanjiExplorerView';
import { TypingModeView } from './components/views/TypingModeView';
import { loadDB, saveDB, updateStats, calculateSRS, getDueVocab, exportVocabData, resetLessonStats } from './services/storageService';
import { AppDatabase, ViewName, ModeName, Vocab } from './types';

interface ConfirmModalProps {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    confirmColor?: string;
}

function App() {
    const [db, setDb] = useState<AppDatabase>(loadDB());
    const [view, setView] = useState<ViewName>('dashboard');
    const [viewHistory, setViewHistory] = useState<ViewName[]>([]);

    const changeView = (newView: ViewName) => {
        if (newView === view) return;
        setViewHistory(prev => [...prev, view]);
        setView(newView);
    };

    const handleBack = () => {
        if (viewHistory.length === 0) {
            if (view !== 'dashboard') setView('dashboard');
            return;
        }
        const prevView = viewHistory[viewHistory.length - 1];
        setViewHistory(prev => prev.slice(0, -1));
        setView(prevView);
    };

    const [lessonId, setLessonId] = useState<string | null>(null);
    const [mode, setMode] = useState<ModeName>('study');
    const [studyType, setStudyType] = useState<'vocab' | 'kanji'>('vocab'); // Global Toggle
    
    const [reflexInitialMode, setReflexInitialMode] = useState<'flashcard' | 'anki'>('anki');
    const [srsQueue, setSrsQueue] = useState<Vocab[]>([]);
    const [networkChar, setNetworkChar] = useState<string | null>(null);
    const [showRules, setShowRules] = useState(false);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
    const [showFireworks, setShowFireworks] = useState(false);
    const [newRecordMsg, setNewRecordMsg] = useState<string | null>(null);

    // Modal States
    const [confirmModal, setConfirmModal] = useState<ConfirmModalProps | null>(null);
    const [showResetSelector, setShowResetSelector] = useState(false);
    const [showFavModal, setShowFavModal] = useState(false);
    
    // NEW: Export Selector State
    const [showExportSelector, setShowExportSelector] = useState(false);
    const [exportLessonTarget, setExportLessonTarget] = useState("");

    const [sessionMistakesMap, setSessionMistakesMap] = useState<Record<string, number>>({});
    const [sessionMistakes, setSessionMistakes] = useState<Set<string>>(new Set());
    const [isReviewSession, setIsReviewSession] = useState(false);

    // ... (keep useEffects for highscore, lastLessonId, toasts same) ...
    useEffect(() => {
        const handleNewHighscore = (e: any) => {
            const { score, mode } = e.detail;
            setShowFireworks(true);
            setNewRecordMsg(`KỶ LỤC MỚI: ${score} ĐIỂM (${mode.toUpperCase()})`);
            setTimeout(() => { setShowFireworks(false); setNewRecordMsg(null); }, 5000);
            setDb(loadDB()); 
        };
        window.addEventListener('new-highscore', handleNewHighscore);
        return () => window.removeEventListener('new-highscore', handleNewHighscore);
    }, []);

    // Reset session mistakes when starting a new lesson/mode
    useEffect(() => {
        setSessionMistakes(new Set());
        setSessionMistakesMap({});
        setIsReviewSession(false);
    }, [lessonId, mode, studyType]);

    useEffect(() => {
        if (lessonId && lessonId !== 'FAV' && lessonId !== 'SRS') {
            setDb(prev => {
                const newDb = { ...prev, config: { ...prev.config, lastLessonId: lessonId } };
                saveDB(newDb);
                return newDb;
            });
        }
    }, [lessonId]);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    // MERGE LOGIC for Import
    const handleImport = (newItems: Vocab[]) => {
        if (newItems.length === 0) return;
        setDb(prev => {
            const updatedVocab = [...prev.vocab];
            let added = 0;
            let updated = 0;
            const affectedLessons = new Set<string>();

            newItems.forEach(item => {
                const idx = updatedVocab.findIndex(v => v.id === item.id);
                if (idx >= 0) {
                    updatedVocab[idx] = item;
                    updated++;
                } else {
                    updatedVocab.push(item);
                    added++;
                }
                affectedLessons.add(item.lesson);
            });

            const newDb = { ...prev, vocab: updatedVocab };
            saveDB(newDb);
            const lessonSummary = Array.from(affectedLessons).join(', ');
            showToast(`Đã nạp ${newItems.length} từ vào BÀI [${lessonSummary}] (Thêm: ${added}, Cập nhật: ${updated})`, 'success');
            return newDb;
        });
    };

    // ACTIVE VOCAB CALCULATION
    const activeVocab = useMemo(() => {
        if (lessonId === 'SRS') return srsQueue;
        // Also use srsQueue if we are in Reflex mode and queue is populated
        if (mode === 'reflex' && srsQueue.length > 0) return srsQueue;

        if (!lessonId) return [];
        
        let list = db.vocab.filter(v => {
            if (lessonId === 'FAV') return db.favorites.includes(String(v.id));
            
            // Allow studyType to filter for ALL lesson-based modes
            // This enables Reflex, Blitz, Writing for Kanji
            return v.lesson === lessonId && v.type === studyType;
        });

        // SHUFFLE LOGIC
        if (db.config.writingMode === 'shuffle' && list.length > 0) {
            return [...list].sort(() => Math.random() - 0.5);
        }
        return list;
    }, [db.vocab, db.favorites, lessonId, db.config.writingMode, srsQueue, studyType, mode]);

    const historyKey = `${lessonId}-${mode}-${studyType}`;
    // If using queue (SRS or Reflex with queue), index is always 0 (head of queue)
    const isQueueMode = lessonId === 'SRS' || (mode === 'reflex' && srsQueue.length > 0);
    const currentIndex = isQueueMode ? 0 : (db.history[historyKey] || 0);

    const updateIndex = (newIndex: number) => {
        if (isQueueMode) return;
        setDb(prev => {
            const newDb = { ...prev, history: { ...prev.history, [historyKey]: Math.max(0, newIndex) } };
            saveDB(newDb);
            return newDb;
        });
    };

    const handleStudyNext = () => {
        if (isQueueMode) return;
        setDb(prev => {
            const today = new Date().toISOString().split('T')[0];
            const newStudyLog = { ...prev.studyLog };
            newStudyLog[today] = (newStudyLog[today] || 0) + 1;
            const newDb = { 
                ...prev, 
                studyLog: newStudyLog,
                history: { ...prev.history, [historyKey]: Math.max(0, currentIndex + 1) } 
            };
            saveDB(newDb);
            return newDb;
        });
    };

    const handleResult = (rating: 1 | 2 | 3 | 4, hintUsed: boolean = false) => {
        const v = activeVocab[currentIndex];
        if (!v) return;

        // If it's a review session, just move next without updating SRS
        if (isReviewSession) {
            updateIndex(currentIndex + 1);
            return;
        }

        // Track mistakes for this session
        if (rating <= 2) {
            setSessionMistakes(prev => new Set(prev).add(String(v.id)));
        }

        // Track session mistakes count for Must Review logic
        let newSessionMistakesMap = { ...sessionMistakesMap };
        if (rating === 1) {
            const currentCount = newSessionMistakesMap[v.id] || 0;
            newSessionMistakesMap[v.id] = currentCount + 1;
            setSessionMistakesMap(newSessionMistakesMap);
        }

        // Check if should move to Must Review (3 strikes in session)
        let forceMustReview = false;
        if ((newSessionMistakesMap[v.id] || 0) >= 3) {
            forceMustReview = true;
        }

        setDb(prev => {
            let newSRS = calculateSRS(prev.srs[v.id], rating, hintUsed);
            
            // Override status if forced to Must Review
            if (forceMustReview && newSRS.status !== 'must_review') {
                newSRS.status = 'must_review';
                newSRS.mustReviewConsecutiveCorrect = 0;
                newSRS.nextReview = Date.now() + 60000; // Review soon
            }

            const newStats = updateStats(prev, rating >= 3 ? 10 : 1);
            
            // Fix studyLog update here
            const today = new Date().toISOString().split('T')[0];
            const newStudyLog = { ...prev.studyLog };
            newStudyLog[today] = (newStudyLog[today] || 0) + 1;

            const newDb = { ...prev, srs: { ...prev.srs, [v.id]: newSRS }, stats: newStats, studyLog: newStudyLog };
            saveDB(newDb);
            return newDb;
        });

        // Queue Manipulation
        if (isQueueMode) {
            if (rating === 1) {
                 // Re-insert into queue at 7-12 position
                 setSrsQueue(prev => {
                     const currentItem = prev[0];
                     const remaining = prev.slice(1);
                     // If remaining is empty, just keep it? No, slice(1) is empty.
                     // If remaining has items:
                     const insertIndex = Math.min(remaining.length, 7 + Math.floor(Math.random() * 6)); // 7 to 12
                     const newQueue = [...remaining];
                     newQueue.splice(insertIndex, 0, currentItem);
                     return newQueue;
                 });
            } else {
                 // Remove from queue
                 if (srsQueue.length === 1) {
                     showToast("Bạn đã hoàn thành danh sách ôn tập!", "success");
                 }
                 setSrsQueue(prev => prev.slice(1));
            }
        } else {
            if (currentIndex + 1 >= activeVocab.length) {
                showToast("Bạn đã hoàn thành danh sách!", "success");
            }
            updateIndex(currentIndex + 1);
        }
    };

    const handleUpdateWritingSettings = (d: number, m: 'sequential'|'shuffle') => { 
        setDb(prev => { const n = {...prev, config:{...prev.config, writingTimer:d, writingMode:m}}; saveDB(n); return n; }); 
    };
    
    // Toggle Shuffle Mode Global
    const toggleShuffleMode = () => {
        const newMode = db.config.writingMode === 'shuffle' ? 'sequential' : 'shuffle';
        handleUpdateWritingSettings(db.config.writingTimer, newMode);
        showToast(newMode === 'shuffle' ? "Đã bật chế độ Trộn Ngẫu Nhiên" : "Đã bật chế độ Tuần Tự", 'info');
    };

    // Handle Reset Lesson Logic
    const confirmResetLesson = (type?: 'vocab' | 'kanji') => {
        if (!lessonId) return;
        
        const typeLabel = type === 'vocab' ? 'TỪ VỰNG' : type === 'kanji' ? 'KANJI' : 'TOÀN BỘ';
        
        setConfirmModal({
            title: `Học lại ${typeLabel} Bài ${lessonId}?`,
            message: `Tất cả tiến độ SRS của ${typeLabel} trong bài này sẽ bị xóa. Các thẻ sẽ quay về trạng thái "Mới".`,
            confirmLabel: 'XÁC NHẬN RESET',
            confirmColor: 'bg-rose-600',
            onConfirm: () => {
                setDb(prev => {
                    let newDb = resetLessonStats(prev, lessonId, type);
                    
                    // Reset history index
                    const newHistory = { ...prev.history };
                    Object.keys(newHistory).forEach(k => {
                        // Reset history if it matches lesson and (type if specific)
                        // If resetting ALL, reset all modes. 
                        // If resetting Kanji, only reset keys ending in -kanji
                        if (k.startsWith(`${lessonId}-`)) {
                            if (!type || k.endsWith(`-${type}`)) {
                                delete newHistory[k];
                            }
                        }
                    });
                    newDb.history = newHistory;
                    
                    // Also reset cram session if exists for this lesson
                    if (newDb.cramSession?.lessonId === lessonId) {
                        newDb.cramSession = undefined;
                    }

                    saveDB(newDb);
                    return newDb;
                });
                showToast(`Đã reset ${typeLabel} Bài ${lessonId}`, 'success');
                setConfirmModal(null);
                setShowResetSelector(false);
            },
            onCancel: () => setConfirmModal(null)
        });
    };

    const handleSwitchToReflex = () => { setMode('reflex'); setReflexInitialMode('anki'); setView('reflex'); };
    
    // Settings Logic
    const updateKanjiSize = (size: number) => {
        setDb(prev => {
            const newDb = { ...prev, config: { ...prev.config, kanjiSize: size } };
            saveDB(newDb);
            return newDb;
        });
    };

    const handleUpdateDb = (newDb: AppDatabase) => {
        setDb(newDb);
        saveDB(newDb);
    };

    // ... Fireworks component ...
    const Fireworks = () => (
        <div className="absolute inset-0 z-[200] pointer-events-none flex items-center justify-center overflow-hidden">
            {[...Array(30)].map((_, i) => (
                <div key={i} className="firework bg-indigo-500" style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100}%`, animation: `ping-slow ${0.5 + Math.random()}s infinite` }}></div>
            ))}
            {newRecordMsg && (
                <div className="bg-slate-950/90 p-8 rounded-3xl border-4 border-indigo-500 shadow-2xl animate-slide-up text-center z-50">
                    <h2 className="text-3xl font-black text-white italic">{newRecordMsg}</h2>
                </div>
            )}
        </div>
    );

    const getTitle = () => "KOTOBA MASTER PRO";

    // --- COMPLETION SCREEN COMPONENT ---
    const CompletionScreen = () => {
        const mistakesCount = sessionMistakes.size;

        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 z-50 p-6 animate-slide-up backdrop-blur-xl">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 pointer-events-none"></div>
                <div className="max-w-md w-full text-center space-y-8 relative z-10">
                    <div>
                        <div className="w-24 h-24 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-bounce">
                            <i className="fas fa-flag-checkered text-6xl text-emerald-500"></i>
                        </div>
                        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500 italic uppercase tracking-tighter drop-shadow-lg">HOÀN THÀNH</h2>
                        <p className="text-slate-400 font-bold uppercase tracking-widest mt-2">Bạn đã học hết danh sách hiện tại</p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                         <button 
                            onClick={() => {
                                setIsReviewSession(true);
                                updateIndex(0);
                            }}
                            className="py-4 bg-gradient-to-r from-slate-800 to-slate-700 border-2 border-slate-600 rounded-xl text-white font-black uppercase hover:from-slate-700 hover:to-slate-600 hover:border-white transition shadow-lg active:scale-95 group"
                        >
                            <i className="fas fa-redo-alt mr-2 text-slate-400 group-hover:text-white transition-colors"></i> Ôn lại toàn bộ (Không lưu SRS)
                        </button>
                        
                        {mistakesCount > 0 && (
                            <button 
                                onClick={() => {
                                    // Filter activeVocab to only mistakes
                                    const mistakeItems = activeVocab.filter(v => sessionMistakes.has(String(v.id)));
                                    setSrsQueue(mistakeItems);
                                    setLessonId('SRS'); // Use SRS queue mode
                                    setIsReviewSession(false); // Enable SRS saving for hard words review
                                    setMode('reflex'); // Force reflex mode for review
                                    setView('reflex');
                                }}
                                className="py-4 bg-gradient-to-r from-amber-900/80 to-orange-900/80 border-2 border-amber-600 rounded-xl text-amber-500 font-black uppercase hover:from-amber-800 hover:to-orange-800 hover:text-white hover:border-white transition shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95 group"
                            >
                                <i className="fas fa-dumbbell mr-2 text-amber-600 group-hover:text-white transition-colors"></i> Ôn lại từ sai ({mistakesCount}) (Lưu SRS)
                            </button>
                        )}

                        <button 
                            onClick={() => setView('dashboard')}
                            className="py-4 bg-gradient-to-r from-indigo-600 to-blue-600 border-2 border-indigo-400 rounded-xl text-white font-black uppercase hover:from-indigo-500 hover:to-blue-500 hover:border-white transition shadow-[0_0_20px_rgba(99,102,241,0.4)] active:scale-95"
                        >
                            <i className="fas fa-home mr-2"></i> Trang chủ
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // --- RESET SELECTOR MODAL ---
    const ResetSelectorModal = () => (
        <div className="absolute inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-slide-up" onClick={() => setShowResetSelector(false)}>
            <div className="bg-slate-900 border-[3px] border-indigo-500 rounded-3xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(99,102,241,0.3)] space-y-6" onClick={e => e.stopPropagation()}>
                <div className="text-center">
                    <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Tùy chọn học lại</h3>
                    <p className="text-slate-400 text-xs font-bold">Bạn muốn ôn tập lại bài này như thế nào?</p>
                </div>
                
                <div className="space-y-3">
                    {/* SOFT RESET */}
                    <button onClick={() => { updateIndex(0); setShowResetSelector(false); showToast("Đã về đầu danh sách", "success"); }} className="w-full py-4 bg-indigo-900/50 border border-indigo-500 hover:bg-indigo-800 rounded-xl text-white font-black uppercase tracking-widest transition flex items-center justify-between px-6 group">
                        <span>Ôn lại từ đầu (Giữ SRS)</span>
                        <i className="fas fa-redo text-indigo-400 group-hover:text-white"></i>
                    </button>

                    <div className="h-px bg-slate-700 my-2"></div>

                    {/* HARD RESET OPTIONS */}
                    <button onClick={() => confirmResetLesson('vocab')} className="w-full py-4 bg-slate-800 border border-slate-600 hover:border-rose-500 hover:bg-rose-900/20 rounded-xl text-slate-300 hover:text-rose-400 font-black uppercase tracking-widest transition flex items-center justify-between px-6 group">
                        <span>Xóa SRS Từ vựng</span>
                        <i className="fas fa-language text-slate-500 group-hover:text-rose-400"></i>
                    </button>
                    <button onClick={() => confirmResetLesson('kanji')} className="w-full py-4 bg-slate-800 border border-slate-600 hover:border-rose-500 hover:bg-rose-900/20 rounded-xl text-slate-300 hover:text-rose-400 font-black uppercase tracking-widest transition flex items-center justify-between px-6 group">
                        <span>Xóa SRS Kanji</span>
                        <i className="fas fa-seedling text-slate-500 group-hover:text-rose-400"></i>
                    </button>
                    <button onClick={() => confirmResetLesson()} className="w-full py-4 bg-rose-950/30 border border-rose-900 hover:bg-rose-900 hover:border-rose-500 rounded-xl text-rose-700 hover:text-white font-black uppercase tracking-widest transition flex items-center justify-between px-6">
                        <span>RESET TOÀN BỘ BÀI</span>
                        <i className="fas fa-bomb"></i>
                    </button>
                </div>
                
                <button onClick={() => setShowResetSelector(false)} className="w-full py-3 text-slate-500 font-bold uppercase text-xs hover:text-white transition">Hủy bỏ</button>
            </div>
        </div>
    );
    
    // --- EXPORT SELECTOR MODAL ---
    const ExportSelectorModal = () => (
         <div className="absolute inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-slide-up" onClick={() => setShowExportSelector(false)}>
            <div className="bg-slate-900 border-[3px] border-emerald-600 rounded-3xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(16,185,129,0.3)] space-y-6" onClick={e => e.stopPropagation()}>
                <div className="text-center">
                    <h3 className="text-2xl font-black text-emerald-500 uppercase tracking-widest mb-2">Xuất dữ liệu</h3>
                    <p className="text-slate-400 text-xs font-bold">Lựa chọn phạm vi dữ liệu muốn xuất ra file JSON.</p>
                </div>

                <div className="space-y-4">
                     {/* OPTION 1: ALL */}
                     <button onClick={() => { exportVocabData(db); setShowExportSelector(false); }} className="w-full py-4 bg-slate-800 border border-slate-600 hover:border-emerald-500 hover:bg-emerald-900/50 rounded-xl text-white font-black uppercase tracking-widest transition flex items-center justify-between px-6 group">
                        <span>TOÀN BỘ APP</span>
                        <i className="fas fa-database text-slate-500 group-hover:text-emerald-400"></i>
                    </button>

                    {/* OPTION 2: BY LESSON */}
                    <div className="bg-slate-800 border border-slate-600 rounded-xl p-4 space-y-3">
                         <div className="text-xs font-black text-slate-400 uppercase">Xuất theo bài học:</div>
                         <div className="flex gap-2">
                             <input 
                                type="number" 
                                placeholder="Số bài" 
                                className="w-20 bg-black/50 border border-slate-500 rounded-lg p-2 text-center text-white font-bold outline-none focus:border-emerald-500"
                                value={exportLessonTarget}
                                onChange={(e) => setExportLessonTarget(e.target.value)}
                             />
                             <button 
                                onClick={() => { 
                                    if(exportLessonTarget) { exportVocabData(db, exportLessonTarget); setShowExportSelector(false); } 
                                    else { showToast("Vui lòng nhập số bài", "error"); }
                                }} 
                                className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs uppercase"
                             >
                                Xuất Ngay
                             </button>
                         </div>
                    </div>
                </div>

                <button onClick={() => setShowExportSelector(false)} className="w-full py-3 text-slate-500 font-bold uppercase text-xs hover:text-white transition">Đóng</button>
            </div>
         </div>
    );

    // --- FAVORITES LIST MODAL ---
    const FavoritesListModal = () => {
        const [tab, setTab] = useState<'vocab' | 'kanji'>('vocab');
        const favItems = db.vocab.filter(v => db.favorites.includes(String(v.id)));
        const list = favItems.filter(v => v.type === tab);

        return (
            <div className="absolute inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-slide-up" onClick={() => setShowFavModal(false)}>
                <div className="bg-slate-900 border-[3px] border-pink-600 rounded-3xl p-6 max-w-2xl w-full h-[80vh] shadow-[0_0_50px_rgba(219,39,119,0.3)] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6 shrink-0">
                        <div>
                            <h3 className="text-2xl font-black text-pink-500 uppercase tracking-widest">Yêu thích</h3>
                            <p className="text-slate-400 text-xs font-bold">Danh sách các từ đã lưu</p>
                        </div>
                        <button onClick={() => setShowFavModal(false)} className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition"><i className="fas fa-times"></i></button>
                    </div>

                    <div className="flex gap-2 mb-4 shrink-0">
                        <button onClick={() => setTab('vocab')} className={`flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition ${tab === 'vocab' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-white'}`}>Từ Vựng ({favItems.filter(v => v.type === 'vocab').length})</button>
                        <button onClick={() => setTab('kanji')} className={`flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition ${tab === 'kanji' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-white'}`}>Kanji ({favItems.filter(v => v.type === 'kanji').length})</button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                        {list.length === 0 ? (
                            <div className="text-center text-slate-500 py-10 font-bold uppercase text-xs">Chưa có từ nào</div>
                        ) : (
                            list.map(v => (
                                <div key={v.id} className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center justify-between group hover:border-pink-500/50 transition">
                                    <div className="flex items-center gap-4">
                                        <div className="text-2xl font-serif text-white w-16 text-center">{v.kj !== '-' ? v.kj : v.ka}</div>
                                        <div>
                                            <div className="text-emerald-400 font-bold text-sm">{v.ka}</div>
                                            <div className="text-slate-400 text-xs truncate max-w-[200px]">{v.mean}</div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setDb(prev => {
                                                const newFavs = prev.favorites.filter(id => id !== String(v.id));
                                                const newDb = { ...prev, favorites: newFavs };
                                                saveDB(newDb);
                                                return newDb;
                                            });
                                        }}
                                        className="w-8 h-8 rounded-lg bg-rose-900/20 text-rose-500 hover:bg-rose-600 hover:text-white flex items-center justify-center transition"
                                    >
                                        <i className="fas fa-trash-alt text-xs"></i>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // --- CONFIRM MODAL ---
    const ConfirmModal = () => {
        if (!confirmModal) return null;
        return (
            <div className="absolute inset-0 z-[80] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-slide-up">
                <div className="bg-slate-900 border-2 border-white/20 rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6 text-center">
                    <h3 className="text-xl font-black text-white uppercase leading-tight">{confirmModal.title}</h3>
                    <p className="text-slate-400 text-sm font-medium">{confirmModal.message}</p>
                    <div className="flex gap-3 pt-2">
                        <button onClick={confirmModal.onCancel} className="flex-1 py-3 bg-slate-800 rounded-xl text-slate-400 font-black uppercase text-xs hover:bg-slate-700 transition">Hủy</button>
                        <button onClick={confirmModal.onConfirm} className={`flex-1 py-3 rounded-xl text-white font-black uppercase text-xs shadow-lg active:scale-95 transition ${confirmModal.confirmColor || 'bg-indigo-600'}`}>{confirmModal.confirmLabel || 'Đồng ý'}</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (view) {
            case 'dashboard':
                return <DashboardView 
                    db={db} 
                    onChangeView={changeView} 
                    onStartLesson={(lid) => {
                        setLessonId(lid);
                        if (lid === 'SRS') {
                            const due = getDueVocab(db);
                            if (due.length === 0) { showToast("Không có từ cần ôn!", 'success'); return; }
                            setSrsQueue(due);
                            setMode('reflex');
                            changeView('reflex');
                        } else {
                            changeView('reflex-selector');
                        }
                    }}
                    onCheckIn={handleCheckIn}
                    onOpenFav={() => setShowFavModal(true)}
                />;
            case 'data-factory':
                return <DataFactoryView onImport={handleImport} onClose={handleBack} onNotify={showToast} />;
            case 'lesson-list':
                return <LessonListView db={db} onSelect={(id) => { setLessonId(id); changeView('reflex-selector'); }} />;
            case 'settings':
                return (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-6 animate-slide-up">
                        <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-8">
                            <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                                <h2 className="text-xl font-black text-white uppercase tracking-widest">Cài đặt</h2>
                                <button onClick={handleBack} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
                            </div>

                            {/* Font Size */}
                            <div className="space-y-3">
                                <label className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    <span>Cỡ chữ hiển thị (Hira/Kata/Kanji)</span>
                                    <span className="text-indigo-400">{db.config.kanjiSize}</span>
                                </label>
                                <input 
                                    type="range" min="80" max="300" step="10" 
                                    value={db.config.kanjiSize} 
                                    onChange={(e) => updateKanjiSize(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                                <div className="h-24 flex items-center justify-center bg-black/30 rounded-xl border border-slate-800">
                                    <span className="font-serif text-white transition-all duration-200" style={{ fontSize: `${db.config.kanjiSize / 3}px` }}>永</span>
                                </div>
                            </div>

                            {/* Export Data */}
                            <div className="space-y-3 pt-4 border-t border-slate-800">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Xuất dữ liệu</div>
                                <button onClick={() => setShowExportSelector(true)} className="w-full py-4 bg-sky-900/50 border border-sky-600/50 rounded-xl text-sky-400 font-bold text-xs uppercase hover:bg-sky-800 transition flex items-center justify-center gap-2">
                                    <i className="fas fa-file-export"></i> Mở Menu Xuất
                                </button>
                            </div>

                            {/* Deleted Reset Data Button as requested */}
                        </div>
                    </div>
                );
            case 'study':
                if (activeVocab.length === 0) return <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 font-black uppercase p-6 text-center gap-4">
                    <div>CHƯA CÓ DỮ LIỆU {studyType === 'vocab' ? 'TỪ VỰNG' : 'KANJI'}</div>
                    <button onClick={handleBack} className="px-6 py-2 bg-slate-800 rounded-lg text-white text-xs uppercase">Quay lại</button>
                </div>;
                if (currentIndex >= activeVocab.length) return <CompletionScreen />;
                return <StudyView 
                    vocab={activeVocab[currentIndex]} 
                    index={currentIndex} 
                    total={activeVocab.length} 
                    isFavorite={db.favorites.includes(String(activeVocab[currentIndex].id))} 
                    kanjiSize={db.config.kanjiSize} 
                    onNext={handleStudyNext} 
                    onPrev={() => updateIndex(currentIndex - 1)} 
                    onToggleFav={() => {
                        const v = activeVocab[currentIndex];
                        setDb(prev => {
                            const newFavs = prev.favorites.includes(String(v.id)) 
                                ? prev.favorites.filter(id => id !== String(v.id))
                                : [...prev.favorites, String(v.id)];
                            const newDb = { ...prev, favorites: newFavs };
                            saveDB(newDb);
                            return newDb;
                        });
                    }} 
                    onKanjiClick={(c) => { setNetworkChar(c); changeView('kanji-network'); }} 
                    onOpenRules={() => setShowRules(true)}
                    studyType={studyType}
                    onTypeChange={setStudyType}
                    vocabList={activeVocab}
                    onJump={updateIndex}
                    lessonId={lessonId || ''}
                />;
            case 'reflex-selector':
                return (
                    <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-xl animate-slide-up z-50">
                        <div className="flex flex-col md:flex-row gap-4 md:gap-6 max-w-4xl w-full h-full md:h-auto max-h-[90vh]">
                            {/* LEFT PANEL: INFO */}
                            <div className="flex-1 bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-indigo-500 rounded-3xl p-4 md:p-8 relative overflow-hidden flex flex-col justify-center shadow-[0_0_40px_rgba(99,102,241,0.3)] shrink-0 min-h-[250px]">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                                
                                {/* RESET BUTTON - TOP LEFT */}
                                <button 
                                    onClick={() => setShowResetSelector(true)}
                                    className="absolute top-3 left-3 md:top-4 md:left-4 z-[60] px-3 py-1.5 md:px-4 md:py-2 bg-rose-950/90 border border-rose-500 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest text-rose-400 hover:bg-rose-600 hover:text-white hover:border-white transition-all shadow-xl active:scale-95"
                                >
                                    <i className="fas fa-undo-alt mr-2"></i> Học lại
                                </button>

                                {/* SHUFFLE ICON - TOP RIGHT OR NEAR TITLE */}
                                <button
                                    onClick={toggleShuffleMode}
                                    className={`absolute top-3 right-3 md:top-4 md:right-4 z-[60] w-8 h-8 md:w-10 md:h-10 rounded-xl border flex items-center justify-center transition-all ${db.config.writingMode === 'shuffle' ? 'bg-sky-500 text-white border-sky-400 shadow-[0_0_15px_#0ea5e9]' : 'bg-slate-800 text-slate-500 border-slate-600 hover:border-sky-500 hover:text-sky-400'}`}
                                    title="Chế độ Trộn từ"
                                >
                                    <i className="fas fa-shuffle text-xs md:text-sm"></i>
                                </button>

                                <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl md:text-9xl text-white font-black italic">#{lessonId}</div>
                                <div className="relative z-10 mt-4 md:mt-8">
                                    <div className="text-xs md:text-sm font-black text-indigo-400 uppercase tracking-widest mb-1 md:mb-2">Đang chọn</div>
                                    <h2 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter mb-4 md:mb-6 drop-shadow-lg">BÀI {lessonId}</h2>
                                    
                                    <div className="space-y-3 md:space-y-4">
                                         {/* TYPE TOGGLE */}
                                        <div className="flex bg-slate-950/50 p-1.5 md:p-2 rounded-xl border border-white/10 backdrop-blur-sm">
                                            <button 
                                                onClick={() => setStudyType('vocab')}
                                                className={`flex-1 py-2 md:py-3 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition ${studyType === 'vocab' ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg border border-white/20' : 'text-slate-500 hover:text-white'}`}
                                            >
                                                Từ Vựng
                                            </button>
                                            <button 
                                                onClick={() => setStudyType('kanji')}
                                                className={`flex-1 py-2 md:py-3 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition ${studyType === 'kanji' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg border border-white/20' : 'text-slate-500 hover:text-white'}`}
                                            >
                                                Kanji
                                            </button>
                                        </div>
                                        <div className="text-[10px] md:text-xs text-slate-400 font-bold italic bg-black/20 p-2 rounded-lg border border-white/5">
                                            * Chọn chế độ để bắt đầu. <br/>
                                            {db.config.writingMode === 'shuffle' ? <span className="text-sky-400 glow-text">⚡ Đang bật chế độ Trộn Ngẫu Nhiên</span> : <span className="text-slate-300">⬇️ Đang bật chế độ Tuần Tự</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>



                            {/* RIGHT PANEL: ACTIONS */}
                            <div className="flex-1 space-y-2 md:space-y-3 flex flex-col justify-start overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                                {/* 1. LIST (Danh sách) */}
                                <button onClick={() => { setMode('study'); changeView('study'); }} className="w-full py-4 md:py-5 px-4 md:px-6 border-l-4 border-indigo-500 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-indigo-900/40 hover:to-slate-800 hover:translate-x-2 transition-all flex items-center gap-3 md:gap-4 group rounded-r-xl border-y border-r border-slate-700 hover:border-indigo-500/50 shrink-0 shadow-lg">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-400 group-hover:text-white group-hover:bg-indigo-600 transition shadow-[0_0_10px_rgba(99,102,241,0.3)]"><i className="fas fa-list text-xs md:text-base"></i></div>
                                    <div className="text-left">
                                        <div className="text-xs md:text-sm font-black text-white uppercase tracking-wider group-hover:text-indigo-300 transition-colors">Danh sách</div>
                                        <div className="text-[8px] md:text-[10px] text-slate-500 font-bold group-hover:text-slate-400">Xem toàn bộ từ vựng</div>
                                    </div>
                                </button>

                                {/* 2. FLASHCARD (Ôn tập thẻ Flashcard) */}
                                <button onClick={() => { 
                                    const list = db.vocab.filter(v => v.lesson === lessonId && v.type === studyType);
                                    let queue = [...list];
                                    if (db.config.writingMode === 'shuffle') queue.sort(() => Math.random() - 0.5);
                                    setSrsQueue(queue);

                                    setReflexInitialMode('anki'); 
                                    setMode('reflex'); 
                                    changeView('reflex'); 
                                }} className="w-full py-4 md:py-5 px-4 md:px-6 border-l-4 border-purple-500 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-purple-900/40 hover:to-slate-800 hover:translate-x-2 transition-all flex items-center gap-3 md:gap-4 group rounded-r-xl border-y border-r border-slate-700 hover:border-purple-500/50 shrink-0 shadow-lg">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-purple-900/50 flex items-center justify-center text-purple-400 group-hover:text-white group-hover:bg-purple-600 transition shadow-[0_0_10px_rgba(168,85,247,0.3)]"><i className="fas fa-clone text-xs md:text-base"></i></div>
                                    <div className="text-left">
                                        <div className="text-xs md:text-sm font-black text-white uppercase tracking-wider group-hover:text-purple-300 transition-colors">Ôn tập thẻ Flashcard</div>
                                        <div className="text-[8px] md:text-[10px] text-slate-500 font-bold group-hover:text-slate-400">Luyện tập với thẻ nhớ</div>
                                    </div>
                                </button>

                                {/* 3. TYPING (Luyện gõ) */}
                                <button onClick={() => { setMode('typing'); changeView('typing'); }} className="w-full py-4 md:py-5 px-4 md:px-6 border-l-4 border-cyan-500 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-cyan-900/40 hover:to-slate-800 hover:translate-x-2 transition-all flex items-center gap-3 md:gap-4 group rounded-r-xl border-y border-r border-slate-700 hover:border-cyan-500/50 shrink-0 shadow-lg">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-cyan-900/50 flex items-center justify-center text-cyan-400 group-hover:text-white group-hover:bg-cyan-600 transition shadow-[0_0_10px_rgba(6,182,212,0.3)]"><i className="fas fa-keyboard text-xs md:text-base"></i></div>
                                    <div className="text-left">
                                        <div className="text-xs md:text-sm font-black text-white uppercase tracking-wider group-hover:text-cyan-300 transition-colors">Luyện gõ</div>
                                        <div className="text-[8px] md:text-[10px] text-slate-500 font-bold group-hover:text-slate-400">Gõ từ vựng tốc độ cao</div>
                                    </div>
                                </button>

                                {/* 4. WRITING (Luyện viết) */}
                                <button onClick={() => { setMode('writing'); changeView('writing'); }} className="w-full py-4 md:py-5 px-4 md:px-6 border-l-4 border-blue-500 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-blue-900/40 hover:to-slate-800 hover:translate-x-2 transition-all flex items-center gap-3 md:gap-4 group rounded-r-xl border-y border-r border-slate-700 hover:border-blue-500/50 shrink-0 shadow-lg">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-400 group-hover:text-white group-hover:bg-blue-600 transition shadow-[0_0_10px_rgba(59,130,246,0.3)]"><i className="fas fa-pen-nib text-xs md:text-base"></i></div>
                                    <div className="text-left">
                                        <div className="text-xs md:text-sm font-black text-white uppercase tracking-wider group-hover:text-blue-300 transition-colors">Luyện viết</div>
                                        <div className="text-[8px] md:text-[10px] text-slate-500 font-bold group-hover:text-slate-400">Tập viết Kanji & Kana</div>
                                    </div>
                                </button>

                                {/* 5. CRAM (Nhồi nhét) */}
                                <button onClick={() => { setMode('cram'); changeView('cram'); }} className="w-full py-4 md:py-5 px-4 md:px-6 border-l-4 border-rose-600 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-rose-900/40 hover:to-slate-800 hover:translate-x-2 transition-all flex items-center gap-3 md:gap-4 group rounded-r-xl border-y border-r border-slate-700 hover:border-rose-600/50 shrink-0 shadow-lg">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-rose-900/50 flex items-center justify-center text-rose-500 group-hover:text-white group-hover:bg-rose-600 transition shadow-[0_0_10px_rgba(225,29,72,0.3)]"><i className="fas fa-biohazard text-xs md:text-base"></i></div>
                                    <div className="text-left">
                                        <div className="text-xs md:text-sm font-black text-white uppercase tracking-wider group-hover:text-rose-300 transition-colors">Nhồi nhét</div>
                                        <div className="text-[8px] md:text-[10px] text-slate-500 font-bold group-hover:text-slate-400">Kỷ luật thép</div>
                                    </div>
                                </button>

                                {/* 6. REFLEX (Phản xạ - Old Blitz) */}
                                <button onClick={() => { setMode('blitz'); changeView('blitz-game'); }} className="w-full py-4 md:py-5 px-4 md:px-6 border-l-4 border-amber-500 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-amber-900/40 hover:to-slate-800 hover:translate-x-2 transition-all flex items-center gap-3 md:gap-4 group rounded-r-xl border-y border-r border-slate-700 hover:border-amber-500/50 shrink-0 shadow-lg">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-amber-900/50 flex items-center justify-center text-amber-400 group-hover:text-white group-hover:bg-amber-600 transition shadow-[0_0_10px_rgba(245,158,11,0.3)]"><i className="fas fa-bolt text-xs md:text-base"></i></div>
                                    <div className="text-left">
                                        <div className="text-xs md:text-sm font-black text-white uppercase tracking-wider group-hover:text-amber-300 transition-colors">Phản xạ</div>
                                        <div className="text-[8px] md:text-[10px] text-slate-500 font-bold group-hover:text-slate-400">Trò chơi tốc độ cao</div>
                                    </div>
                                </button>
                                
                                <button onClick={handleBack} className="w-full py-3 mt-2 md:mt-4 text-[10px] md:text-xs font-black uppercase text-slate-500 hover:text-white transition bg-slate-900/50 rounded-lg border border-slate-700 hover:border-white/20 shrink-0">
                                    <i className="fas fa-times mr-2"></i> Đóng Menu
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case 'typing':
                if (activeVocab.length === 0) return <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500 font-black uppercase">
                    <div>CHƯA CÓ DỮ LIỆU {studyType.toUpperCase()}</div>
                    <button onClick={handleBack} className="px-4 py-2 bg-slate-800 rounded text-xs text-white">Quay lại</button>
                </div>;
                
                if (currentIndex >= activeVocab.length) return <CompletionScreen />;

                return <TypingModeView 
                    vocabList={activeVocab} 
                    currentIndex={currentIndex}
                    total={activeVocab.length}
                    onNext={(rating) => handleResult(rating)}
                    onPrev={() => updateIndex(currentIndex - 1)}
                    onClose={handleBack}
                />;
            case 'reflex':
                // Fix for SRS completion (Queue empty)
                if (lessonId === 'SRS' && activeVocab.length === 0) {
                     return (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 z-50 p-6 animate-slide-up backdrop-blur-xl">
                            <div className="max-w-md w-full text-center space-y-8">
                                <div>
                                    <i className="fas fa-check-circle text-6xl text-emerald-500 mb-4 animate-bounce"></i>
                                    <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">ĐÃ ÔN TẬP XONG</h2>
                                    <p className="text-slate-400 font-bold uppercase tracking-widest mt-2">Bạn đã hoàn thành danh sách ôn tập</p>
                                </div>
                                <button 
                                    onClick={() => changeView('dashboard')}
                                    className="w-full py-4 bg-indigo-600 border-2 border-indigo-400 rounded-xl text-white font-black uppercase hover:bg-indigo-500 hover:border-white transition shadow-lg active:scale-95"
                                >
                                    <i className="fas fa-home mr-2"></i> Về Trang chủ
                                </button>
                            </div>
                        </div>
                     );
                }

                if (activeVocab.length > 0 && currentIndex >= activeVocab.length) return <CompletionScreen />;

                if (activeVocab.length === 0 || !activeVocab[currentIndex]) return <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500 font-black uppercase">
                    <div>CHƯA CÓ DỮ LIỆU {studyType.toUpperCase()}</div>
                    <button onClick={handleBack} className="px-4 py-2 bg-slate-800 rounded text-xs text-white">Quay lại</button>
                </div>;
                
                return <ReflexView vocab={activeVocab[currentIndex]} allVocab={activeVocab} srsStatus={db.srs[activeVocab[currentIndex]?.id]} onNext={handleResult} onPrev={() => updateIndex(currentIndex - 1)} currentIndex={currentIndex} total={activeVocab.length} db={db} initialMode={reflexInitialMode} lessonId={lessonId || ''} mode={mode} />;
            case 'cram':
                if (activeVocab.length === 0) return <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500 font-black uppercase text-center p-4">
                    <div>CẦN DỮ LIỆU ĐỂ SỬ DỤNG TÍNH NĂNG NÀY<br/>(HIỆN CÓ {activeVocab.length} {studyType.toUpperCase()})</div>
                    <button onClick={handleBack} className="px-4 py-2 bg-slate-800 rounded text-xs text-white">Quay lại</button>
                </div>;
                return <CramModeView vocabList={activeVocab} lessonId={lessonId!} db={db} onUpdateDb={handleUpdateDb} onClose={handleBack} />;
            case 'writing':
                if (activeVocab.length > 0 && currentIndex >= activeVocab.length) return <CompletionScreen />;

                if (activeVocab.length === 0 || !activeVocab[currentIndex]) return <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500 font-black uppercase">
                    <div>CHƯA CÓ DỮ LIỆU {studyType.toUpperCase()}</div>
                    <button onClick={handleBack} className="px-4 py-2 bg-slate-800 rounded text-xs text-white">Quay lại</button>
                </div>;
                
                return <WritingView vocab={activeVocab[currentIndex]} onSwitchToReflex={handleSwitchToReflex} timerSettings={{ duration: db.config.writingTimer || 0, mode: db.config.writingMode || 'sequential' }} onUpdateSettings={handleUpdateWritingSettings} onNext={() => updateIndex(currentIndex + 1)} onPrev={() => updateIndex(currentIndex - 1)} onGrade={handleResult} index={currentIndex} total={activeVocab.length} lessonId={lessonId || ''} />;
            case 'blitz-game':
                if (activeVocab.length < 4) return <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500 font-black uppercase text-center p-4">
                    <div>CẦN TỐI THIỂU 4 TỪ ĐỂ CHƠI BLITZ<br/>(HIỆN CÓ {activeVocab.length} {studyType.toUpperCase()})</div>
                    <button onClick={handleBack} className="px-4 py-2 bg-slate-800 rounded text-xs text-white">Quay lại</button>
                </div>;
                return <BlitzGameView lessonId={lessonId!} vocabList={activeVocab} db={db} onClose={handleBack} onOpenRules={() => setShowRules(true)} />;
            case 'kanji-network':
                return <KanjiNetworkView char={networkChar || ''} db={db} onClose={handleBack} onOpenRules={() => setShowRules(true)} />;
            case 'kanji-explorer':
                return <KanjiExplorerView 
                    db={db} 
                    onClose={handleBack} 
                    onReviewLesson={(id) => { setLessonId(id); changeView('reflex-selector'); }} 
                    onReviewDueKanji={() => {
                        const due = getDueVocab(db, 'kanji');
                        if (due.length === 0) { showToast("Không có Kanji cần ôn!", 'success'); return; }
                        setSrsQueue(due);
                        setLessonId('SRS');
                        setStudyType('kanji');
                        setMode('reflex');
                        changeView('reflex');
                    }}
                />;
            case 'rule-explorer':
                return <RuleExplorerView db={db} onClose={handleBack} />;
            default: return null;
        }
    };

    const handleCheckIn = () => {
        setDb(prev => {
            const today = new Date().toISOString().split('T')[0];
            const checkIns = prev.stats.checkIns || [];
            if (checkIns.includes(today)) return prev;

            const newCheckIns = [...checkIns, today];
            
            // Check if yesterday was checked in to maintain streak
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            let newStreak = prev.stats.streak;
            if (checkIns.includes(yesterdayStr)) {
                newStreak += 1;
            } else if (newStreak === 0) {
                newStreak = 1;
            } else if (!checkIns.includes(yesterdayStr) && checkIns.length > 0) {
                // If they missed yesterday, reset streak to 1
                newStreak = 1;
            }

            // Add XP Bonus
            const newXP = prev.stats.xp + 50;
            const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1;

            const newDb = {
                ...prev,
                stats: {
                    ...prev.stats,
                    checkIns: newCheckIns,
                    streak: newStreak,
                    xp: newXP,
                    level: newLevel
                }
            };
            saveDB(newDb);
            showToast('Điểm danh thành công! (+50 XP) 🔥', 'success');
            return newDb;
        });
    };

    return (
        <Layout 
            db={db} 
            title={getTitle()} 
            onHome={() => changeView('dashboard')} 
            onBack={handleBack} 
            showBack={view !== 'dashboard'} 
            showHome={view !== 'blitz-game'} 
            onSettings={() => changeView('settings')} 
            onOpenRules={() => setShowRules(true)} 
            onCheckIn={handleCheckIn}
        >
            {renderContent()}
            {showResetSelector && <ResetSelectorModal />}
            {showExportSelector && <ExportSelectorModal />}
            {showFavModal && <FavoritesListModal />}
            {confirmModal && <ConfirmModal />}
            {showFireworks && <Fireworks />}
            {notification && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[100] animate-slide-up px-6 py-3 rounded-full border-2 bg-slate-900 border-indigo-500 text-white font-black uppercase text-xs shadow-2xl">
                    {notification.message}
                </div>
            )}
            {showRules && <RuleExplorerView onClose={() => setShowRules(false)} />}
        </Layout>
    );
}

export default App;

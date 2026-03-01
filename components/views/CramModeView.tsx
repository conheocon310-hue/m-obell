
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Vocab, AppDatabase, CramSession } from '../../types';
import { playSfx } from '../../services/audioService';
import { motion } from 'motion/react';

interface CramModeViewProps {
    vocabList: Vocab[]; // This is the "fresh" list from App (already sorted/shuffled by App)
    lessonId: string;
    db: AppDatabase;
    onUpdateDb: (newDb: AppDatabase) => void;
    onClose: () => void;
}

// CONSTANTS
const BUFFER_SIZE = 5;
const HITS_TO_GRADUATE = 3;
const JUMP_PENALTY = 5; // Positions to push back on error

// COLORS (High-Contrast Neon Palette)
const COLORS = {
    BG: '#020617',         // Onyx Deep Black
    AMBER: '#F59E0B',      // Warning/Focus (Amber-500)
    EMERALD: '#10B981',    // Success (Emerald-500)
    CRIMSON: '#E11D48',    // Punishment/Lock (Rose-600)
};

const CircularProgress = ({ progress }: { progress: number }) => {
    const size = 440; 
    const strokeWidth = 4;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;
    
    return (
        <svg width={size} height={size} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 transition-transform duration-500">
            <circle cx={size/2} cy={size/2} r={radius} stroke="#1e293b" strokeWidth={strokeWidth} fill="transparent" opacity={0.3} />
            <circle 
                cx={size/2} cy={size/2} r={radius} 
                stroke={COLORS.AMBER}
                strokeWidth={strokeWidth} 
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-100 linear drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]"
                transform={`rotate(-90 ${size/2} ${size/2})`}
            />
        </svg>
    );
};

export const CramModeView: React.FC<CramModeViewProps> = ({ vocabList, lessonId, db, onUpdateDb, onClose }) => {
    
    // --- LOCAL STATE (Derived from DB but kept for rendering speed) ---
    const [session, setSession] = useState<CramSession | null>(null);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [cardTimerMs, setCardTimerMs] = useState(5000);
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

    const cardIntervalRef = useRef<any>(null);

    // --- INITIALIZATION / RESUME ---
    useEffect(() => {
        // Check if we have a valid resumable session
        const existingSession = db.cramSession;
        
        if (existingSession && existingSession.lessonId === lessonId && (existingSession.queue.length > 0 || existingSession.buffer.length > 0 || existingSession.phase === 'finished')) {
            // RESUME
            setSession(existingSession);
        } else {
            // INIT NEW (Setup Phase)
            // We don't populate queue yet, waiting for user choice
            const newSession: CramSession = {
                lessonId,
                queue: [],
                buffer: [],
                progressMap: {},
                graduatedIds: [],
                lockStartTime: 0, 
                lockDuration: 0,
                phase: 'setup',
                mistakesInExitTest: 0,
                blitzSpeed: 5.0,
                testQueue: []
            };
            setSession(newSession);
            // We don't save to DB yet to avoid persisting empty session if they cancel immediately
        }
    }, [lessonId]);

    // Helper to update DB
    const updateSession = (newSession: CramSession) => {
        setSession(newSession);
        onUpdateDb({ ...db, cramSession: newSession });
    };

    // --- CARD TIMER LOGIC ---
    useEffect(() => {
        if (!session || (session.phase !== 'cramming' && session.phase !== 'exit_test') || isFlipped || feedback) {
            if (cardIntervalRef.current) clearInterval(cardIntervalRef.current);
            return;
        }

        const limit = session.blitzSpeed * 1000;
        setCardTimerMs(limit); 

        const step = 50;
        cardIntervalRef.current = setInterval(() => {
            setCardTimerMs(prev => {
                if (prev <= step) {
                    handleTimeout();
                    return 0;
                }
                return prev - step;
            });
        }, step);

        return () => clearInterval(cardIntervalRef.current);
    }, [session?.phase, currentCardIndex, isFlipped, feedback]);

    // --- GAMEPLAY ACTIONS ---

    const startSession = (mode: 'all' | 'hard') => {
        if (!session) return;

        let selectedVocab: Vocab[] = [];

        if (mode === 'all') {
            selectedVocab = [...vocabList];
        } else {
            // Filter "Hard" words: SRS status is learning, relearning, or must_review
            // "những từ đánh giá 1,2 ở SRS" -> usually corresponds to these statuses
            selectedVocab = vocabList.filter(v => {
                const s = db.srs[v.id];
                return s && (s.status === 'learning' || s.status === 'relearning' || s.status === 'must_review');
            });

            if (selectedVocab.length === 0) {
                alert("Không có từ vựng nào đang ở trạng thái 'Khó' (Learning/Relearning/Must Review) trong bài này.");
                return;
            }
        }

        // Shuffle
        selectedVocab.sort(() => Math.random() - 0.5);

        const initialQueue = [...selectedVocab]; 
        const initialBuffer = initialQueue.splice(0, BUFFER_SIZE);
        const pMap: Record<string, number> = {};
        [...initialQueue, ...initialBuffer].forEach(v => pMap[v.id] = 0);

        updateSession({
            ...session,
            queue: initialQueue,
            buffer: initialBuffer,
            progressMap: pMap,
            graduatedIds: [],
            phase: 'cramming',
        });
        playSfx(1000, 'square', 0.5);
    };

    const restartSession = () => {
        if (!session) return;
        
        // Re-use all items from the current session (graduated + queue + buffer + testQueue)
        // In 'finished' state, everything should be in graduatedIds usually, but let's be safe
        // Actually, we can just look at graduatedIds if we finished successfully.
        // But if we want to be robust, we can map graduatedIds back to Vocab objects using vocabList.
        
        const allIds = new Set([...session.graduatedIds, ...session.queue.map(v => String(v.id)), ...session.buffer.map(v => String(v.id))]);
        const itemsToRestart = vocabList.filter(v => allIds.has(String(v.id)));
        
        if (itemsToRestart.length === 0) {
            // Fallback to all if something went wrong
            startSession('all'); 
            return;
        }

        itemsToRestart.sort(() => Math.random() - 0.5);

        const initialQueue = [...itemsToRestart];
        const initialBuffer = initialQueue.splice(0, BUFFER_SIZE);
        const pMap: Record<string, number> = {};
        [...initialQueue, ...initialBuffer].forEach(v => pMap[v.id] = 0);

        updateSession({
            ...session,
            queue: initialQueue,
            buffer: initialBuffer,
            progressMap: pMap,
            graduatedIds: [],
            phase: 'cramming',
            testQueue: [],
            mistakesInExitTest: 0
        });
        playSfx(1000, 'square', 0.5);
    };

    const handleTimeout = () => {
        clearInterval(cardIntervalRef.current);
        setIsFlipped(true);
        handleGrading(false);
    };

    const getCurrentCard = () => {
        if (!session) return null;
        if (session.phase === 'exit_test') return session.testQueue[currentCardIndex];
        return session.buffer[currentCardIndex];
    };

    const handleFlip = useCallback(() => {
        if (isFlipped || feedback) return;
        setIsFlipped(true);
        playSfx(400, 'triangle', 0.1);
    }, [isFlipped, feedback, session, currentCardIndex]); 

    const handleGrading = useCallback((correct: boolean) => {
        if (!session || feedback) return;
        
        const currentVocab = getCurrentCard();
        if (!currentVocab) return;

        setFeedback(correct ? 'correct' : 'wrong');
        
        if (correct) {
            playSfx(1200, 'sine', 0.1);
        } else {
            playSfx(150, 'sawtooth', 0.3);
            if (navigator.vibrate) navigator.vibrate(200);
        }

        setTimeout(() => processResult(correct, currentVocab), 600);
    }, [session, feedback, currentCardIndex]);

    const processResult = (correct: boolean, vocab: Vocab) => {
        if (!session) return;
        setFeedback(null);
        setIsFlipped(false);

        // Wait for flip animation (300ms) before changing content
        setTimeout(() => {
            // --- EXIT TEST LOGIC ---
            if (session.phase === 'exit_test') {
                 if (correct) {
                     // Remove from test queue
                     const newTestQueue = [...session.testQueue];
                     newTestQueue.splice(currentCardIndex, 1);
                     
                     if (newTestQueue.length === 0) {
                         // Passed!
                         updateSession({ ...session, phase: 'finished', testQueue: [] });
                     } else {
                         // Next card
                         let nextIdx = currentCardIndex;
                         if (nextIdx >= newTestQueue.length) nextIdx = 0;
                         setCurrentCardIndex(nextIdx);
                         updateSession({ ...session, testQueue: newTestQueue });
                     }
                 } else {
                     // Wrong in exit test
                     const newMistakes = session.mistakesInExitTest + 1;
                     
                     // Shuffle it back
                     const newTestQueue = [...session.testQueue];
                     newTestQueue.splice(currentCardIndex, 1);
                     newTestQueue.push(vocab); // Move to end
                     updateSession({ ...session, testQueue: newTestQueue, mistakesInExitTest: newMistakes });
                     setCurrentCardIndex(0); // Restart index logic simply
                 }
                 return;
            }

            // --- CRAMMING LOGIC ---
            let { buffer, queue, progressMap, graduatedIds } = session;
            let newBuffer = [...buffer];
            let newQueue = [...queue];
            let newProgress = { ...progressMap };
            let nextIndex = currentCardIndex;

            if (correct) {
                 const hits = (newProgress[vocab.id] || 0) + 1;
                 newProgress[vocab.id] = hits;

                 if (hits >= HITS_TO_GRADUATE) {
                     // Graduate
                     playSfx(1500, 'square', 0.2);
                     graduatedIds = [...graduatedIds, String(vocab.id)];
                     
                     // Remove from buffer
                     newBuffer.splice(currentCardIndex, 1);
                     
                     // Fill from queue
                     if (newQueue.length > 0) {
                         newBuffer.push(newQueue.shift()!);
                     }

                     if (newBuffer.length === 0) {
                         updateSession({ ...session, phase: 'finished', buffer: [], queue: [], graduatedIds });
                         return;
                     }
                     
                     // Adjust index
                     if (nextIndex >= newBuffer.length) nextIndex = 0;
                 } else {
                     // Just Correct, not graduated
                     nextIndex = (currentCardIndex + 1) % newBuffer.length;
                 }
            } else {
                // Wrong -> Jump Rule
                newProgress[vocab.id] = 0; // Reset hits
                
                // Remove from buffer
                newBuffer.splice(currentCardIndex, 1);
                
                // Insert into Queue at +5 position (or end)
                const insertIdx = Math.min(newQueue.length, JUMP_PENALTY);
                newQueue.splice(insertIdx, 0, vocab);
                
                // Refill Buffer from top of Queue
                if (newQueue.length > 0) {
                    newBuffer.push(newQueue.shift()!);
                } else {
                    newBuffer.push(newQueue.shift()!); 
                }
                
                if (nextIndex >= newBuffer.length) nextIndex = 0;
            }

            updateSession({
                ...session,
                buffer: newBuffer,
                queue: newQueue,
                progressMap: newProgress,
                graduatedIds
            });
            setCurrentCardIndex(nextIndex);
        }, 300);
    };

    // --- KEYBOARD LISTENER ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!session) return;
            // Only active in cramming or exit_test phases
            if (session.phase !== 'cramming' && session.phase !== 'exit_test') return;

            // Space to flip
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent scrolling
                if (!isFlipped) handleFlip();
                return;
            }

            // Grading Keys (only when flipped)
            if (isFlipped && !feedback) {
                if (['ArrowLeft', 'Comma', 'KeyA'].includes(e.code)) {
                    handleGrading(false);
                }
                if (['ArrowRight', 'Period', 'KeyD'].includes(e.code)) {
                    handleGrading(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [session, isFlipped, feedback, handleFlip, handleGrading]);

    // --- EXIT LOGIC ---
    
    // --- RENDER ---

    if (!session) return null;

    if (session.phase === 'setup') {
        return (
            <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col items-center justify-center animate-slide-up">
                <div className="w-full max-w-md p-8 bg-slate-900/50 border border-slate-800 rounded-3xl backdrop-blur-xl text-center space-y-8 shadow-2xl relative overflow-hidden">
                    <div className="relative z-10">
                        <i className="fas fa-biohazard text-6xl text-rose-600 mb-4 animate-pulse drop-shadow-[0_0_15px_rgba(225,29,72,0.5)]"></i>
                        <h2 className="text-4xl font-black text-white uppercase tracking-widest">CRAM MODE</h2>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.3em] mt-2">Học tập trung cao độ</p>
                    </div>

                    <div className="space-y-4 text-left p-6 bg-[#0B1120] rounded-2xl border border-amber-500/30 relative z-10">
                        <label className="flex justify-between text-xs font-black text-amber-500 uppercase tracking-widest">
                            <span>Tốc độ Blitz</span>
                            <span className="text-white font-digital text-lg">{session.blitzSpeed.toFixed(1)}s</span>
                        </label>
                        <input 
                            type="range" min="3.0" max="8.0" step="0.5" 
                            value={session.blitzSpeed} 
                            onChange={(e) => updateSession({...session, blitzSpeed: parseFloat(e.target.value)})}
                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                    </div>

                    <div className="space-y-3 relative z-10">
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => startSession('all')} className="py-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase text-sm tracking-[0.1em] rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-transform active:scale-95 group relative overflow-hidden border border-emerald-500">
                                <span className="relative z-10 flex flex-col items-center justify-center">
                                    <i className="fas fa-layer-group mb-1 text-lg"></i>
                                    <span>HỌC TẤT CẢ</span>
                                </span>
                            </button>
                            <button onClick={() => startSession('hard')} className="py-5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black uppercase text-sm tracking-[0.1em] rounded-xl shadow-[0_0_20px_rgba(225,29,72,0.3)] transition-transform active:scale-95 group relative overflow-hidden border border-rose-500">
                                <span className="relative z-10 flex flex-col items-center justify-center">
                                    <i className="fas fa-skull mb-1 text-lg"></i>
                                    <span>HỌC TỪ KHÓ</span>
                                </span>
                            </button>
                        </div>
                        <button onClick={onClose} className="w-full py-3 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-white transition">Hủy bỏ</button>
                    </div>
                </div>
            </div>
        );
    }

    if (session.phase === 'finished') {
        return (
            <div className="fixed inset-0 z-[200] bg-emerald-950/90 flex flex-col items-center justify-center animate-slide-up backdrop-blur-xl">
                <i className="fas fa-trophy text-6xl text-yellow-400 mb-6 animate-bounce"></i>
                <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter">HOÀN THÀNH</h2>
                <p className="text-emerald-400 font-bold uppercase tracking-widest mt-2">Bạn đã nuốt trọn {session.graduatedIds.length} từ vựng</p>
                
                <div className="mt-12 flex flex-col gap-4 w-full max-w-xs">
                    <button onClick={restartSession} className="w-full py-4 bg-white text-emerald-900 font-black uppercase rounded-full shadow-2xl hover:scale-105 transition flex items-center justify-center gap-2">
                        <i className="fas fa-rotate-right"></i> Ôn lại danh sách này
                    </button>
                    <button onClick={onClose} className="w-full py-4 bg-emerald-900/50 border-2 border-emerald-500/30 text-emerald-200 font-black uppercase rounded-full hover:bg-emerald-900 hover:text-white transition">
                        Thoát ra
                    </button>
                </div>
            </div>
        );
    }

    const currentVocab = getCurrentCard();
    if (!currentVocab) return null; 

    const hits = session.progressMap[currentVocab.id] || 0;
    const progressPercent = (cardTimerMs / (session.blitzSpeed * 1000)) * 100;
    const mainText = currentVocab.kj !== '-' ? currentVocab.kj : currentVocab.ka;
    const subText = currentVocab.kj !== '-' ? currentVocab.ka : '';

    return (
        <div className="fixed inset-0 z-[200] flex flex-row overflow-hidden font-sans" style={{ backgroundColor: COLORS.BG }}>
            
            {/* ABSOLUTE HEADER - HIGH CONTRAST & VISIBILITY */}
            <div className="absolute top-0 left-0 w-full h-24 z-50 pointer-events-none bg-gradient-to-b from-black via-black/80 to-transparent">
                 <div className="w-full h-full flex justify-between items-start pt-6 px-6 max-w-4xl mx-auto">
                    
                    {/* LEFT: HOME BUTTON */}
                    <div className="pointer-events-auto relative">
                    </div>

                    {/* CENTER: REMOVED LOCK TIMER */}
                    <div></div>
                    
                    {/* RIGHT: STATS (QUEUE + MASTERED) */}
                    <div className="pointer-events-auto flex gap-3">
                        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-slate-800 border-2 border-slate-600 shadow-lg backdrop-blur-md">
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Q</div>
                            <div className="text-lg font-black text-white font-digital">{session.queue.length}</div>
                        </div>
                        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-emerald-950 border-2 border-emerald-600 shadow-lg backdrop-blur-md">
                            <div className="text-[8px] font-black text-emerald-400 uppercase tracking-wider mb-0.5"><i className="fas fa-check"></i></div>
                            <div className="text-lg font-black text-white font-digital">{session.graduatedIds.length}</div>
                        </div>
                    </div>
                 </div>
            </div>

            {/* MAIN AREA */}
            <div className="flex-1 relative flex flex-col pt-10">
                {/* CARD AREA */}
                <div className="flex-1 flex items-center justify-center relative">
                    
                    {/* FEEDBACK OVERLAY */}
                    {feedback && (
                        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                            <i className={`fas ${feedback === 'correct' ? 'fa-check text-emerald-500' : 'fa-times text-rose-600'} text-9xl drop-shadow-[0_0_50px_currentColor] animate-bounce`}></i>
                        </div>
                    )}

                    {/* MAIN CARD CONTAINER */}
                    <div 
                        className="relative w-[390px] h-[546px] perspective-1000 cursor-pointer active:scale-95 transition-transform"
                        onClick={handleFlip}
                    >
                        {/* Circular Timer - Amber */}
                        {!isFlipped && !feedback && <CircularProgress progress={progressPercent} />}

                        <motion.div 
                            className="relative w-full h-full preserve-3d"
                            initial={false}
                            animate={{ rotateY: isFlipped ? 180 : 0 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                            style={{ transformStyle: 'preserve-3d' }}
                        >
                            
                            {/* FRONT SIDE */}
                            <div className="absolute inset-0 backface-hidden bg-[#0A0A0A] border-[3px] border-amber-500/80 rounded-[2rem] flex flex-col items-center shadow-[0_0_30px_rgba(245,158,11,0.15)] overflow-hidden">
                                
                                {/* Top Progress Bars - Emerald */}
                                <div className="absolute top-6 w-full flex justify-center gap-1.5 z-10">
                                    {[0, 1, 2].map(i => (
                                        <div key={i} className={`w-8 h-1.5 rounded-full transition-all duration-300 ${i < hits ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-800'}`}></div>
                                    ))}
                                </div>

                                {/* CENTERED CONTENT */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pb-8 p-4" style={{ containerType: 'inline-size' }}>
                                    <div 
                                        className="font-serif text-white leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] text-center w-full break-words" 
                                        style={{ fontSize: `min(8rem, ${90 / Math.max(1, mainText.length)}cqi)` }}
                                    >
                                        {mainText}
                                    </div>
                                    {subText && (
                                        <div className="mt-4 text-2xl font-black text-slate-500 uppercase tracking-widest text-center">
                                            {subText}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="absolute bottom-6 text-[10px] font-black text-amber-600/50 uppercase tracking-[0.3em] animate-pulse">
                                    SPACE / CLICK ĐỂ LẬT
                                </div>
                            </div>

                            {/* BACK SIDE */}
                            <div className="absolute inset-0 backface-hidden bg-[#050505] border-[2px] border-emerald-500/50 rounded-[2rem] flex flex-col shadow-[0_0_30px_rgba(16,185,129,0.1)] overflow-hidden" style={{ transform: 'rotateY(180deg)' }}>
                                <div className="h-14 flex items-center justify-center gap-1.5 border-b border-white/5 bg-[#0A0A0A]">
                                    {[0, 1, 2].map(i => (
                                        <div key={i} className={`w-8 h-1.5 rounded-full ${i < hits ? 'bg-emerald-500' : 'bg-slate-800'}`}></div>
                                    ))}
                                </div>

                                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                                    <div className="text-2xl font-black text-white leading-tight mb-4 break-words max-w-full px-2 drop-shadow-md">{currentVocab.mean}</div>
                                    <div className="flex gap-2 items-center justify-center w-full opacity-80 mb-4">
                                        {currentVocab.hv && currentVocab.hv !== '-' && <span className="text-[10px] font-bold text-pink-400 uppercase border border-pink-900/50 px-3 py-1.5 rounded bg-pink-950/20 shadow-sm">{currentVocab.hv}</span>}
                                        {currentVocab.en && currentVocab.en !== '-' && <span className="text-[10px] font-bold text-sky-400 uppercase border border-sky-900/50 px-3 py-1.5 rounded bg-sky-950/20 max-w-[120px] truncate shadow-sm">{currentVocab.en}</span>}
                                    </div>
                                    
                                    {/* ON / KUN */}
                                    {(currentVocab.on !== '-' || currentVocab.kun !== '-') && (
                                        <div className="grid grid-cols-2 gap-2 w-full max-w-[200px]">
                                            {currentVocab.on !== '-' && (
                                                <div className="flex flex-col items-center bg-cyan-950/30 rounded p-1 border border-cyan-900/30">
                                                    <span className="text-[8px] text-cyan-500 uppercase">ON</span>
                                                    <span className="text-xs font-bold text-cyan-300">{currentVocab.on}</span>
                                                </div>
                                            )}
                                            {currentVocab.kun !== '-' && (
                                                <div className="flex flex-col items-center bg-amber-950/30 rounded p-1 border border-amber-900/30">
                                                    <span className="text-[8px] text-amber-500 uppercase">KUN</span>
                                                    <span className="text-xs font-bold text-amber-300">{currentVocab.kun}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="h-20 grid grid-cols-2 text-white font-black text-xs uppercase tracking-widest">
                                    <div 
                                        className="flex flex-col items-center justify-center bg-rose-950/20 border-t border-r border-rose-900/30 text-rose-500 cursor-pointer hover:bg-rose-900/30 active:bg-rose-900/50 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); handleGrading(false); }}
                                    >
                                        <i className="fas fa-chevron-left text-lg mb-1"></i>
                                        SAI (&lt;)
                                    </div>
                                    <div 
                                        className="flex flex-col items-center justify-center bg-emerald-950/20 border-t border-emerald-900/30 text-emerald-500 cursor-pointer hover:bg-emerald-900/30 active:bg-emerald-900/50 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); handleGrading(true); }}
                                    >
                                        <i className="fas fa-chevron-right text-lg mb-1"></i>
                                        ĐÚNG (&gt;)
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};

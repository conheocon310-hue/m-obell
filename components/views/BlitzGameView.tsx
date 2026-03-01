
import React, { useState, useEffect, useRef } from 'react';
import { Vocab, AppDatabase } from '../../types';
import { playSfx } from '../../services/audioService';

interface BlitzGameViewProps {
    lessonId: string;
    vocabList: Vocab[]; 
    db: AppDatabase;
    onClose: () => void;
    onOpenRules: () => void;
}

type GamePhase = 'setup' | 'playing' | 'gameover';
type GameMode = 'TRUE_FALSE' | 'SHADOW_SELECTION';

interface Question {
    mode: GameMode;
    target: Vocab;
    options: any[]; 
    correctAnswer: any; 
}

export const BlitzGameView: React.FC<BlitzGameViewProps> = ({ lessonId, vocabList, onClose, onOpenRules }) => {
    const [phase, setPhase] = useState<GamePhase>('setup');
    const [timeLimit, setTimeLimit] = useState(3000); 
    const [timeLeft, setTimeLeft] = useState(3000);
    const [lives, setLives] = useState(3);
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [visualFeedback, setVisualFeedback] = useState<'perfect' | 'hit' | 'miss' | null>(null);
    const timerRef = useRef<any>(null);

    // Setup input state for slider
    const [setupTime, setSetupTime] = useState(3); // seconds

    const generateQuestion = (): Question => {
        const mode: GameMode = Math.random() > 0.5 ? 'TRUE_FALSE' : 'SHADOW_SELECTION';
        const target = vocabList[Math.floor(Math.random() * vocabList.length)];
        
        if (mode === 'TRUE_FALSE') {
            const isCorrect = Math.random() > 0.5;
            const randomVocab = vocabList[Math.floor(Math.random() * vocabList.length)];
            const displayMean = isCorrect ? target.mean : randomVocab.mean;
            const actualIsCorrect = displayMean === target.mean;

            return {
                mode: 'TRUE_FALSE',
                target: target,
                options: [displayMean],
                correctAnswer: actualIsCorrect
            };
        } else {
            const numOptions = Math.min(vocabList.length, 3 + Math.floor(Math.random() * 3)); 
            const distractors = vocabList.filter(v => v.id !== target.id).sort(() => 0.5 - Math.random()).slice(0, numOptions - 1);
            const options = [target, ...distractors].sort(() => 0.5 - Math.random());
            const correctIndex = options.findIndex(v => v.id === target.id);

            return {
                mode: 'SHADOW_SELECTION',
                target: target,
                options: options, 
                correctAnswer: correctIndex
            };
        }
    };

    const startGame = (time: number) => {
        setTimeLimit(time);
        setLives(3);
        setPhase('playing');
        nextTurn();
    };

    const nextTurn = () => {
        const q = generateQuestion();
        setCurrentQuestion(q);
        setTimeLeft(timeLimit);
        setVisualFeedback(null);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 0) { handleAnswer(false, true); return 0; }
                return prev - 50;
            });
        }, 50);
    };

    const handleAnswer = (isCorrect: boolean, isTimeout = false) => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (isCorrect) {
            setVisualFeedback('hit');
            playSfx(800, 'square', 0.1);
            setTimeout(nextTurn, 500); 
        } else {
            setLives(l => { const newLives = l - 1; if (newLives <= 0) endGame(); return newLives; });
            setVisualFeedback('miss');
            playSfx(150, 'sawtooth', 0.4);
            if (!isTimeout && lives > 1) { setTimeout(nextTurn, 1000); }
        }
    };

    const endGame = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setPhase('gameover');
    };

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (phase !== 'playing' || !currentQuestion) return;
            if (currentQuestion.mode === 'TRUE_FALSE') {
                const leftKeys = ['ArrowLeft', ',', '<'];
                const rightKeys = ['ArrowRight', '.', '>'];
                if (leftKeys.includes(e.key)) handleAnswer(currentQuestion.correctAnswer === false);
                if (rightKeys.includes(e.key)) handleAnswer(currentQuestion.correctAnswer === true);
            } else if (currentQuestion.mode === 'SHADOW_SELECTION') {
                const num = parseInt(e.key);
                if (!isNaN(num) && num >= 1 && num <= currentQuestion.options.length) {
                    handleAnswer((num - 1) === currentQuestion.correctAnswer);
                }
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [phase, currentQuestion, timeLeft]); 

    useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

    const renderSetupScreen = () => (
        <div className="flex flex-col items-center justify-center h-full space-y-8 animate-slide-up relative z-20">
            <div className="text-center">
                <i className="fas fa-bolt text-5xl text-neon-amber mb-4 animate-pulse drop-shadow-[0_0_20px_#ffaa00]"></i>
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 italic uppercase tracking-tighter">BLITZ REFLEX <span className="text-neon-cyan text-sm align-top">2.0</span></h2>
                <p className="text-neon-cyan font-bold tracking-[0.3em] mt-2 uppercase text-xs">Bài {lessonId} • {vocabList.length} Mục</p>
            </div>
            
            <div className="w-full max-w-sm space-y-4">
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
                    <label className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        <span>Thời gian mỗi lượt</span>
                        <span className="text-neon-amber text-base font-digital">{setupTime}s</span>
                    </label>
                    <input 
                        type="range" 
                        min="3" 
                        max="10" 
                        step="1" 
                        value={setupTime} 
                        onChange={(e) => setSetupTime(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-neon-amber"
                    />
                    <div className="flex justify-between text-[8px] text-slate-600 mt-1 font-bold">
                        <span>3s (Khó)</span>
                        <span>10s (Dễ)</span>
                    </div>
                </div>

                <button onClick={() => startGame(setupTime * 1000)} className="w-full p-4 bg-gradient-to-r from-amber-600 to-orange-600 border border-amber-500 rounded-2xl hover:scale-105 transition flex justify-center items-center group shadow-lg">
                    <span className="font-black text-white text-base uppercase tracking-widest">BẮT ĐẦU NGAY</span>
                </button>
            </div>
            
            <div className="flex gap-8">
                <button onClick={onClose} className="text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] hover:text-white transition">Thoát</button>
                <button onClick={onOpenRules} className="text-indigo-500 font-black uppercase text-[10px] tracking-[0.2em] hover:text-white transition flex items-center gap-2">
                    <i className="fas fa-table"></i> Bảng quy tắc
                </button>
            </div>
        </div>
    );

    const renderGameOverScreen = () => (
        <div className="flex flex-col items-center justify-center h-full space-y-6 animate-slide-up relative z-20">
            <div className="text-center">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Kết quả</div>
                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 italic">HẾT GIỜ</div>
            </div>
            <div className="flex gap-4 w-full max-w-sm">
                <button onClick={() => setPhase('setup')} className="flex-1 py-4 bg-slate-800 rounded-xl font-black text-slate-300 uppercase text-[10px] hover:bg-slate-700 transition">Menu</button>
                <button onClick={() => startGame(timeLimit)} className="flex-1 py-4 bg-indigo-600 rounded-xl font-black text-white uppercase text-[10px] hover:scale-105 transition">Chơi lại</button>
            </div>
        </div>
    );

    if (phase === 'setup') return <div className="absolute inset-0 p-6">{renderSetupScreen()}</div>;
    if (phase === 'gameover') return <div className="absolute inset-0 p-6">{renderGameOverScreen()}</div>;
    if (!currentQuestion) return null;

    // Helper to display visual key
    const getVisual = (v: Vocab) => v.kj !== '-' ? v.kj : v.ka;

    return (
        <div className={`absolute inset-0 flex flex-col overflow-hidden transition-colors duration-200`}>
            <div className="h-16 flex justify-between items-end px-6 pb-2 shrink-0 z-20 relative">
                <div className="flex gap-2 mb-1">
                    {[1, 2, 3].map(i => <i key={i} className={`fas fa-heart text-lg transition-all drop-shadow-md ${i <= lives ? 'text-rose-500 animate-pulse' : 'text-slate-800'}`}></i>)}
                </div>
                <div className="absolute top-4 right-4 flex flex-col items-end">
                    <div className={`text-3xl font-digital font-bold tracking-widest ${timeLeft < 500 ? 'text-red-500 animate-shake glow-text' : 'text-neon-cyan glow-text'}`}>{(timeLeft / 1000).toFixed(1)}</div>
                </div>
            </div>

            <div className="flex-1 flex flex-col p-4 gap-4 min-h-0 relative z-10">
                {visualFeedback && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 pointer-events-none animate-slide-up">
                        <span className={`text-5xl md:text-7xl font-black italic uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(0,0,0,0.8)] stroke-black ${visualFeedback === 'hit' ? 'text-emerald-400' : 'text-rose-600'}`}>{visualFeedback === 'hit' ? 'TUYỆT!' : 'TRƯỢT!'}</span>
                    </div>
                )}

                {currentQuestion.mode === 'TRUE_FALSE' ? (
                    <>
                        <div className="flex-[2] bg-black/40 backdrop-blur-md border-2 border-neon-purple rounded-3xl flex items-center justify-center relative overflow-hidden shadow-[0_0_20px_rgba(188,19,254,0.2)]">
                            <span className="text-5xl md:text-7xl font-serif text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{getVisual(currentQuestion.target)}</span>
                            <div className="absolute top-4 left-4 text-[8px] font-black text-neon-purple uppercase tracking-[0.3em] border border-neon-purple/30 px-2 py-1 rounded bg-black/50">NHẬN DIỆN</div>
                        </div>
                        <div className="flex-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center p-4">
                            <span className="text-xl md:text-3xl font-black text-white text-center tracking-tight">{currentQuestion.options[0]}</span>
                        </div>
                        <div className="h-20 grid grid-cols-2 gap-4">
                            <button onClick={() => handleAnswer(currentQuestion.correctAnswer === false)} className="bg-rose-950/40 border-2 border-rose-600/50 hover:bg-rose-600 hover:border-rose-400 rounded-2xl flex flex-col items-center justify-center active:scale-95 transition group"><i className="fas fa-times text-2xl text-rose-500 group-hover:text-white mb-1 transition"></i><span className="text-[10px] font-black text-rose-300 group-hover:text-white uppercase tracking-widest">SAI (&lt;)</span></button>
                            <button onClick={() => handleAnswer(currentQuestion.correctAnswer === true)} className="bg-emerald-950/40 border-2 border-emerald-600/50 hover:bg-emerald-600 hover:border-emerald-400 rounded-2xl flex flex-col items-center justify-center active:scale-95 transition group"><i className="fas fa-check text-2xl text-emerald-500 group-hover:text-white mb-1 transition"></i><span className="text-[10px] font-black text-emerald-300 group-hover:text-white uppercase tracking-widest">ĐÚNG (&gt;)</span></button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex-1 bg-black/40 backdrop-blur-md border-2 border-neon-amber rounded-3xl flex items-center justify-center p-4 relative shadow-[0_0_20px_rgba(255,170,0,0.2)]">
                            <span className="text-2xl md:text-4xl font-black text-white text-center tracking-tight">{currentQuestion.target.mean}</span>
                            <div className="absolute top-4 left-4 text-[8px] font-black text-neon-amber uppercase tracking-[0.3em] border border-neon-amber/30 px-2 py-1 rounded bg-black/50">CHỌN KANJI</div>
                        </div>
                        <div className="flex-[2] grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {currentQuestion.options.map((opt: Vocab, idx: number) => (
                                <button key={idx} onClick={() => handleAnswer(idx === currentQuestion.correctAnswer)} className="bg-slate-900/80 border border-slate-700 hover:border-neon-cyan hover:shadow-[0_0_15px_rgba(0,243,255,0.5)] rounded-2xl flex flex-col items-center justify-center relative group active:scale-95 transition">
                                    <span className="text-3xl font-serif text-white group-hover:scale-110 transition">{getVisual(opt)}</span>
                                    <span className="absolute top-2 left-2 text-[8px] font-black text-slate-500 border border-slate-700 px-1.5 rounded bg-black group-hover:text-neon-cyan group-hover:border-neon-cyan font-digital">{idx + 1}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
            <div className="h-1.5 bg-slate-900 relative">
                <div className={`h-full transition-all linear duration-50 ${timeLeft < 1000 ? 'bg-red-500 shadow-[0_0_20px_red]' : 'bg-neon-cyan shadow-[0_0_15px_#00f3ff]'}`} style={{ width: `${(timeLeft / timeLimit) * 100}%` }}></div>
            </div>
        </div>
    );
};

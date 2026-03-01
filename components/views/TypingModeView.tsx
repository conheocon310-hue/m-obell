import React, { useState, useEffect, useRef } from 'react';
import { Vocab } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { playSfx } from '../../services/audioService';
import { Delete, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface TypingModeViewProps {
    vocabList: Vocab[];
    onClose: () => void;
    onNext: (rating: 1 | 2 | 3 | 4) => void;
    onPrev: () => void;
    currentIndex: number;
    total: number;
}

const KEYBOARD_LAYOUT = [
    ['あ', 'い', 'う', 'え', 'お'],
    ['か', 'き', 'く', 'け', 'こ'],
    ['さ', 'し', 'す', 'せ', 'そ'],
    ['た', 'ち', 'つ', 'て', 'と'],
    ['な', 'に', 'ぬ', 'ね', 'の'],
    ['は', 'ひ', 'ふ', 'へ', 'ほ'],
    ['ま', 'み', 'む', 'め', 'も'],
    ['や', '', 'ゆ', '', 'よ'],
    ['ら', 'り', 'る', 'れ', 'ろ'],
    ['わ', '', '', '', 'を'],
    ['ん', 'ー', '', '', '']
];

export const TypingModeView: React.FC<TypingModeViewProps> = ({ vocabList, onClose, onNext, onPrev, currentIndex, total }) => {
    const vocab = vocabList[currentIndex];
    
    const [inputs, setInputs] = useState({ kana: '', romaji: '', hanviet: '' });
    const [focusedInput, setFocusedInput] = useState<'kana' | 'romaji' | 'hanviet'>('romaji');
    const [status, setStatus] = useState<'typing' | 'correct' | 'wrong'>('typing');
    const [showKeyboardOverlay, setShowKeyboardOverlay] = useState(false);
    const [keyboardType, setKeyboardType] = useState<'hira' | 'kata'>('hira');
    const [countdown, setCountdown] = useState<number | null>(null);
    const [shake, setShake] = useState(false);
    
    const romajiInputRef = useRef<HTMLInputElement>(null);
    const hanvietInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setInputs({ kana: '', romaji: '', hanviet: '' });
        setStatus('typing');
        setFocusedInput('romaji');
        setShowKeyboardOverlay(false);
        setCountdown(null);
        setShake(false);
        
        setTimeout(() => {
            if (romajiInputRef.current) romajiInputRef.current.focus();
        }, 100);
    }, [vocab]);

    useEffect(() => {
        if (countdown === null) return;
        
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            onNext(status === 'correct' ? 3 : 1);
        }
    }, [countdown, status, onNext]);

    const handleConfirm = () => {
        if (status !== 'typing') return;

        const normalize = (str: string) => str.toLowerCase().replace(/[\s~?.,!]/g, '');
        const targetRomaji = normalize(vocab.ro || '');
        const currentRomaji = normalize(inputs.romaji);

        if (currentRomaji === targetRomaji) {
            setStatus('correct');
            playSfx(800, 'sine', 0.1);
        } else {
            setStatus('wrong');
            setShake(true);
            setTimeout(() => setShake(false), 500);
            playSfx(150, 'sawtooth', 0.2);
        }
        setShowKeyboardOverlay(false);
        setCountdown(5);
    };

    const handleVirtualKey = (char: string) => {
        if (status !== 'typing') return;
        setInputs(prev => ({ ...prev, kana: prev.kana + char }));
    };

    const handleBackspace = () => {
        if (status !== 'typing') return;
        setInputs(prev => ({ ...prev, kana: prev.kana.slice(0, -1) }));
    };

    const handleDakuten = () => {
        if (status !== 'typing') return;
        setInputs(prev => {
            const last = prev.kana.slice(-1);
            const rest = prev.kana.slice(0, -1);
            const map: {[key: string]: string} = {
                'か': 'が', 'き': 'ぎ', 'く': 'ぐ', 'け': 'げ', 'こ': 'ご',
                'さ': 'ざ', 'し': 'じ', 'す': 'ず', 'せ': 'ぜ', 'そ': 'ぞ',
                'た': 'だ', 'ち': 'ぢ', 'つ': 'づ', 'て': 'で', 'と': 'ど',
                'は': 'ば', 'ひ': 'び', 'ふ': 'ぶ', 'へ': 'べ', 'ほ': 'ぼ',
                'カ': 'ガ', 'キ': 'ギ', 'ク': 'グ', 'ケ': 'ゲ', 'コ': 'ゴ',
                'サ': 'ザ', 'シ': 'ジ', 'ス': 'ズ', 'セ': 'ゼ', 'ソ': 'ゾ',
                'タ': 'ダ', 'チ': 'ヂ', 'ツ': 'ヅ', 'テ': 'デ', 'ト': 'ド',
                'ハ': 'バ', 'ヒ': 'ビ', 'フ': 'ブ', 'ヘ': 'ベ', 'ホ': 'ボ',
                'う': 'ゔ', 'ウ': 'ヴ'
            };
            if (map[last]) return { ...prev, kana: rest + map[last] };
            return prev;
        });
    };

    const handleHandakuten = () => {
        if (status !== 'typing') return;
        setInputs(prev => {
            const last = prev.kana.slice(-1);
            const rest = prev.kana.slice(0, -1);
            const map: {[key: string]: string} = {
                'は': 'ぱ', 'ひ': 'ぴ', 'ふ': 'ぷ', 'へ': 'ぺ', 'ほ': 'ぽ',
                'ハ': 'パ', 'ヒ': 'ピ', 'フ': 'プ', 'ヘ': 'ペ', 'ホ': 'ポ'
            };
            if (map[last]) return { ...prev, kana: rest + map[last] };
            return prev;
        });
    };

    const handleSmall = () => {
        if (status !== 'typing') return;
        setInputs(prev => {
            const last = prev.kana.slice(-1);
            const rest = prev.kana.slice(0, -1);
            const map: {[key: string]: string} = {
                'あ': 'ぁ', 'い': 'ぃ', 'う': 'ぅ', 'え': 'ぇ', 'お': 'ぉ',
                'つ': 'っ', 'や': 'ゃ', 'ゆ': 'ゅ', 'よ': 'ょ', 'わ': 'ゎ',
                'ア': 'ァ', 'イ': 'ィ', 'ウ': 'ゥ', 'エ': 'ェ', 'オ': 'ォ',
                'ツ': 'ッ', 'ヤ': 'ャ', 'ユ': 'ュ', 'ヨ': 'ョ', 'ワ': 'ヮ',
                'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お',
                'っ': 'つ', 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'ゎ': 'わ',
                'ァ': 'ア', 'ィ': 'イ', 'ゥ': 'ウ', 'ェ': 'エ', 'ォ': 'オ',
                'ッ': 'ツ', 'ャ': 'ヤ', 'ュ': 'ユ', 'ョ': 'ヨ', 'ヮ': 'ワ'
            };
            if (map[last]) return { ...prev, kana: rest + map[last] };
            return prev;
        });
    };

    const toKatakana = (str: string) => {
        return str.split('').map(c => {
            if (c >= '\u3041' && c <= '\u3096') {
                return String.fromCharCode(c.charCodeAt(0) + 0x60);
            }
            return c;
        }).join('');
    };

    const getDisplayChar = (char: string) => {
        if (['ー'].includes(char)) return char;
        return keyboardType === 'kata' ? toKatakana(char) : char;
    };

    const getBorderColor = () => {
        if (status === 'correct') return 'border-[#10B981]';
        if (status === 'wrong') return 'border-[#F43F5E]';
        return 'border-transparent';
    };

    const progressPercentage = ((currentIndex + 1) / total) * 100;

    return (
        <div className={`fixed inset-0 flex flex-col overflow-hidden transition-colors duration-500 bg-[#0F172A] text-[#F8FAFC] border-4 ${getBorderColor()} box-border`}>
            
            {/* TOP NAVIGATION */}
            <div className="absolute top-4 left-4 z-20 flex items-center pointer-events-auto">
                <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition backdrop-blur-md font-bold text-sm uppercase tracking-widest">
                    Quay lại
                </button>
            </div>

            {/* LAYER 1: INFO (25%) - Sticky Header */}
            <div className="flex-none h-[25%] flex flex-col items-center justify-center relative z-10 p-4 pt-16">
                <div className="w-full max-w-2xl bg-[#1E293B]/70 backdrop-blur-[10px] rounded-2xl border border-white/10 shadow-xl p-4 flex flex-col items-center justify-center gap-2 h-full">
                    <h2 className="text-2xl md:text-4xl font-black text-white drop-shadow-md leading-tight uppercase text-center w-full truncate">
                        {vocab.mean}
                    </h2>
                </div>
            </div>

            {/* LAYER 2: INPUTS (75%) */}
            <div className="flex-none h-[75%] flex flex-col items-center px-4 gap-4 relative z-10 pt-4 pb-24 overflow-y-auto w-full max-w-2xl mx-auto custom-scrollbar">
                
                <motion.div 
                    animate={shake ? { x: [-5, 5, -5, 5, 0] } : { x: 0 }}
                    transition={{ duration: 0.4 }}
                    className="w-full space-y-4"
                >
                    {/* Input 1: Kana */}
                    <div className={`w-full flex h-20 rounded-2xl border-2 overflow-hidden transition-all relative bg-[#1E293B]/70 backdrop-blur-[10px] shrink-0 ${focusedInput === 'kana' && status === 'typing' ? 'border-[#38BDF8] shadow-[0_0_15px_rgba(56,189,248,0.3)]' : status === 'correct' ? 'border-[#10B981] bg-[#10B981]/10' : status === 'wrong' ? 'border-[#F43F5E] bg-[#F43F5E]/10' : 'border-white/10'}`}>
                        <motion.div 
                            className="bg-black/20 flex items-center px-6 cursor-pointer overflow-hidden h-full"
                            animate={{ width: status === 'typing' ? '100%' : '60%' }}
                            onClick={() => { 
                                if (status === 'typing') {
                                    setFocusedInput('kana'); 
                                    setShowKeyboardOverlay(true); 
                                }
                            }}
                        >
                            <span className="text-2xl md:text-3xl font-black text-white truncate">{inputs.kana}</span>
                            {focusedInput === 'kana' && status === 'typing' && <span className="w-0.5 h-8 bg-[#38BDF8] animate-pulse ml-1"></span>}
                        </motion.div>
                        <AnimatePresence>
                            {status !== 'typing' && (
                                <motion.div 
                                    initial={{ width: '0%', opacity: 0 }}
                                    animate={{ width: '40%', opacity: 1 }}
                                    className={`border-l border-white/5 flex items-center justify-center h-full ${status === 'correct' ? 'bg-[#10B981]/20' : 'bg-[#F43F5E]/20'}`}
                                >
                                    <span className={`text-xl md:text-2xl font-black ${status === 'correct' ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>{vocab.ka}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Input 2: Romaji */}
                    <div className={`w-full flex h-20 rounded-2xl border-2 overflow-hidden transition-all bg-[#1E293B]/70 backdrop-blur-[10px] shrink-0 ${focusedInput === 'romaji' && status === 'typing' ? 'border-[#38BDF8] shadow-[0_0_15px_rgba(56,189,248,0.3)]' : status === 'correct' ? 'border-[#10B981] bg-[#10B981]/10' : status === 'wrong' ? 'border-[#F43F5E] bg-[#F43F5E]/10' : 'border-white/10'}`}>
                        <motion.div
                            className="bg-black/20 flex items-center h-full"
                            animate={{ width: status === 'typing' ? '100%' : '60%' }}
                        >
                            <input 
                                ref={romajiInputRef}
                                type="text"
                                value={inputs.romaji}
                                onChange={(e) => setInputs(prev => ({ ...prev, romaji: e.target.value }))}
                                onFocus={() => { setFocusedInput('romaji'); setShowKeyboardOverlay(false); }}
                                disabled={status !== 'typing'}
                                className="w-full h-full bg-transparent px-6 text-2xl md:text-3xl font-black text-white outline-none placeholder-slate-600 truncate"
                                placeholder="Romaji..."
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                            />
                        </motion.div>
                        <AnimatePresence>
                            {status !== 'typing' && (
                                <motion.div 
                                    initial={{ width: '0%', opacity: 0 }}
                                    animate={{ width: '40%', opacity: 1 }}
                                    className={`border-l border-white/5 flex items-center justify-center h-full ${status === 'correct' ? 'bg-[#10B981]/20' : 'bg-[#F43F5E]/20'}`}
                                >
                                    <span className={`text-xl md:text-2xl font-black ${status === 'correct' ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>{vocab.ro}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Input 3: Han Viet */}
                    <div className={`w-full flex h-20 rounded-2xl border-2 overflow-hidden transition-all bg-[#1E293B]/70 backdrop-blur-[10px] shrink-0 ${focusedInput === 'hanviet' && status === 'typing' ? 'border-[#38BDF8] shadow-[0_0_15px_rgba(56,189,248,0.3)]' : status === 'correct' ? 'border-[#10B981] bg-[#10B981]/10' : status === 'wrong' ? 'border-[#F43F5E] bg-[#F43F5E]/10' : 'border-white/10'}`}>
                        <motion.div
                            className="bg-black/20 flex items-center h-full"
                            animate={{ width: status === 'typing' ? '100%' : '60%' }}
                        >
                            <input 
                                ref={hanvietInputRef}
                                type="text"
                                value={inputs.hanviet}
                                onChange={(e) => setInputs(prev => ({ ...prev, hanviet: e.target.value }))}
                                onFocus={() => { setFocusedInput('hanviet'); setShowKeyboardOverlay(false); }}
                                disabled={status !== 'typing'}
                                className="w-full h-full bg-transparent px-6 text-2xl md:text-3xl font-black text-white outline-none placeholder-slate-600 truncate"
                                placeholder="Hán Việt..."
                            />
                        </motion.div>
                        <AnimatePresence>
                            {status !== 'typing' && (
                                <motion.div 
                                    initial={{ width: '0%', opacity: 0 }}
                                    animate={{ width: '40%', opacity: 1 }}
                                    className={`border-l border-white/5 flex items-center justify-center h-full ${status === 'correct' ? 'bg-[#10B981]/20' : 'bg-[#F43F5E]/20'}`}
                                >
                                    <span className={`text-xl md:text-2xl font-black ${status === 'correct' ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>{vocab.hv}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* CONFIRM / NEXT BUTTONS */}
                {!showKeyboardOverlay && status === 'typing' && (
                    <button 
                        onClick={handleConfirm}
                        className="mt-6 w-full py-4 bg-[#38BDF8] rounded-xl text-[#0F172A] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(56,189,248,0.4)] active:scale-95 transition hover:bg-[#0ea5e9] text-lg shrink-0"
                    >
                        Xác nhận
                    </button>
                )}

                {!showKeyboardOverlay && status !== 'typing' && (
                    <button 
                        onClick={() => onNext(status === 'correct' ? 3 : 1)}
                        className={`mt-6 w-full py-4 rounded-xl text-white font-black uppercase tracking-widest shadow-lg active:scale-95 transition text-lg shrink-0 flex items-center justify-center gap-2 ${status === 'correct' ? 'bg-[#10B981] hover:bg-emerald-400' : 'bg-[#F43F5E] hover:bg-rose-400'}`}
                    >
                        NEXT <ChevronRight size={24} />
                    </button>
                )}
            </div>

            {/* COUNTDOWN BAR */}
            {status !== 'typing' && countdown !== null && (
                <div className="absolute bottom-16 left-0 w-full h-1 bg-black/50 z-20">
                    <motion.div 
                        className="h-full bg-[#38BDF8] shadow-[0_0_10px_#38BDF8]"
                        initial={{ width: '100%' }}
                        animate={{ width: '0%' }}
                        transition={{ duration: 5, ease: 'linear' }}
                    />
                </div>
            )}

            {/* BOTTOM BAR (Progress & Prev) */}
            <div className="absolute bottom-0 left-0 w-full h-16 bg-[#0F172A] border-t border-white/10 z-20 flex items-center px-4 gap-4">
                <button 
                    onClick={onPrev} 
                    disabled={currentIndex === 0}
                    className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition disabled:opacity-30 border border-white/10"
                >
                    <ChevronLeft size={24} />
                </button>
                <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden relative border border-white/5">
                    <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#38BDF8] to-indigo-500 transition-all duration-300"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
                <div className="text-slate-400 font-bold text-sm w-12 text-right">
                    {currentIndex + 1}/{total}
                </div>
            </div>

            {/* OVERLAY KEYBOARD (100%) */}
            <AnimatePresence>
                {showKeyboardOverlay && (
                    <motion.div 
                        initial={{ y: '100%' }}
                        animate={{ y: '0%' }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-0 bg-[#0F172A] z-50 flex flex-col"
                    >
                        {/* PREVIEW AREA (Meaning + Kana) */}
                        <div className="flex-none p-4 pt-12 border-b border-white/10 bg-[#1E293B]/50 flex flex-col items-center justify-center gap-2 relative">
                            <button onClick={() => setShowKeyboardOverlay(false)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition">
                                <X size={20} />
                            </button>
                            <h2 className="text-xl md:text-2xl font-black text-white drop-shadow-md leading-tight uppercase text-center w-full truncate px-12">
                                {vocab.mean}
                            </h2>
                            <div className="text-4xl md:text-5xl font-black text-[#38BDF8] h-14 flex items-center justify-center w-full truncate">
                                {inputs.kana}
                                <span className="w-1 h-10 bg-[#38BDF8] animate-pulse ml-1"></span>
                            </div>
                        </div>

                        {/* FUNCTION STRIP */}
                        <div className="flex-none h-14 flex gap-2 p-2 border-b border-white/10 bg-black/20">
                            <button onClick={() => setKeyboardType(prev => prev === 'hira' ? 'kata' : 'hira')} className="flex-[1.5] rounded-lg bg-white/5 border border-white/10 text-white font-bold text-xs uppercase hover:bg-white/10 active:bg-white/20 transition">
                                {keyboardType === 'hira' ? 'Đổi Kata' : 'Đổi Hira'}
                            </button>
                            <button onClick={handleDakuten} className="flex-1 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-xl hover:bg-white/10 active:bg-white/20 transition">゛</button>
                            <button onClick={handleHandakuten} className="flex-1 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-xl hover:bg-white/10 active:bg-white/20 transition">゜</button>
                            <button onClick={handleSmall} className="flex-1 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 active:bg-white/20 transition">小</button>
                            <button onClick={handleBackspace} className="flex-[1.5] rounded-lg bg-[#F43F5E]/20 border border-[#F43F5E]/30 text-[#F43F5E] font-bold text-xs uppercase flex items-center justify-center gap-1 hover:bg-[#F43F5E]/30 active:bg-[#F43F5E]/40 transition">
                                <Delete size={16} /> Xóa
                            </button>
                        </div>

                        {/* GRID KEYBOARD - Scrollable */}
                        <div className="flex-1 p-2 overflow-y-auto custom-scrollbar bg-[#0F172A]">
                            <div className="grid grid-cols-5 gap-2 min-h-full pb-20">
                                {KEYBOARD_LAYOUT.map((row, rowIndex) => (
                                    <React.Fragment key={rowIndex}>
                                        {row.map((char, colIndex) => {
                                            if (char === '') return <div key={`${rowIndex}-${colIndex}`} />;
                                            
                                            const displayChar = getDisplayChar(char);
                                            
                                            return (
                                                <button
                                                    key={`${rowIndex}-${colIndex}`}
                                                    onClick={() => handleVirtualKey(displayChar)}
                                                    className="rounded-xl font-bold text-2xl md:text-4xl active:scale-90 transition flex items-center justify-center bg-[#1E293B] border border-white/10 text-white hover:bg-white/10 active:bg-[#38BDF8] active:text-[#0F172A] active:border-[#38BDF8] min-h-[60px] md:min-h-[80px] shadow-sm"
                                                >
                                                    {displayChar}
                                                </button>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        {/* BOTTOM ACTION ROW (Fixed) */}
                        <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#0F172A] via-[#0F172A] to-transparent flex gap-2">
                            <button 
                                onClick={() => handleVirtualKey(' ')}
                                className="flex-1 rounded-xl bg-[#1E293B] border border-white/10 text-white font-bold text-sm uppercase hover:bg-white/10 active:bg-white/20 transition flex items-center justify-center h-14"
                            >
                                Dấu cách
                            </button>
                            <button 
                                onClick={() => setShowKeyboardOverlay(false)}
                                className="flex-[2] rounded-xl bg-gradient-to-r from-[#38BDF8] to-indigo-500 text-white font-black text-lg uppercase hover:opacity-90 active:scale-95 transition shadow-lg h-14"
                            >
                                OK
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};


import React, { useState } from 'react';
import { RULE_DATA } from '../../services/ruleService';

interface RuleExplorerViewProps {
    onClose: () => void;
    db?: any; 
}

type TabType = 'transform' | 'phonetic';

export const RuleExplorerView: React.FC<RuleExplorerViewProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<TabType>('transform');

    const TableHeader = ({ title, sub1, sub2, colorClass }: any) => (
        <div className={`${colorClass} text-white font-black text-center border-b-2 border-white/20`}>
            <div className="py-2 text-lg uppercase tracking-wider">{title}</div>
            <div className="grid grid-cols-2 text-xs border-t border-white/20 bg-black/10">
                <div className="py-1 border-r border-white/20">{sub1}</div>
                <div className="py-1">{sub2}</div>
            </div>
        </div>
    );

    const TableRow = ({ src, dest, isLast, fontClass = "" }: any) => (
        <div className={`grid grid-cols-2 text-center text-sm font-bold text-slate-900 ${!isLast ? 'border-b border-slate-300' : ''}`}>
            <div className="py-2 px-1 border-r border-slate-300 bg-white/50">{src}</div>
            <div className={`py-2 px-1 bg-white ${fontClass}`}>{dest}</div>
        </div>
    );

    const PhoneticRow = ({ criteria, yes, no, isLast }: any) => (
        <div className={`grid grid-cols-12 text-center text-sm ${!isLast ? 'border-b border-slate-300' : ''}`}>
            <div className="col-span-4 py-3 px-2 bg-slate-100 border-r border-slate-300 font-black text-slate-700 flex items-center justify-center text-[10px] uppercase text-center leading-tight">{criteria}</div>
            <div className="col-span-4 py-3 px-2 bg-emerald-50 border-r border-slate-300 text-emerald-800 font-bold whitespace-pre-line flex items-center justify-center text-xs text-left">{yes}</div>
            <div className="col-span-4 py-3 px-2 bg-rose-50 text-rose-800 font-bold whitespace-pre-line flex items-center justify-center text-xs text-left">{no}</div>
        </div>
    );

    return (
        <div className="absolute inset-0 z-[60] bg-slate-950/95 backdrop-blur-xl animate-slide-up flex flex-col overflow-hidden">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 shrink-0 bg-slate-900">
                <h2 className="text-xl font-black text-white uppercase tracking-widest">MẠNG LƯỚI QUY TẮC</h2>
                <button 
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider border border-slate-600"
                >
                    Đóng
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex bg-slate-900/50 border-b border-slate-800 p-2 gap-2 justify-center">
                <button 
                    onClick={() => setActiveTab('transform')}
                    className={`px-6 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'transform' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    Âm ON Kanji (Hán -&gt; Nhật)
                </button>
                <button 
                    onClick={() => setActiveTab('phonetic')}
                    className={`px-6 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'phonetic' ? 'bg-fuchsia-600 text-white shadow-[0_0_15px_rgba(192,38,211,0.4)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                    Trường Âm & Âm Ngắt
                </button>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
                
                {activeTab === 'transform' ? (
                    // --- TAB 1: TRANSFORM RULES ---
                    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
                        {/* COL 1: ÂM ĐẦU (BLUE) */}
                        <div className="rounded-xl overflow-hidden border-2 border-sky-600 shadow-lg bg-sky-100">
                            <TableHeader title="ÂM ĐẦU" sub1="ÂM HÁN VIỆT" sub2="ÂM ON" colorClass="bg-sky-600" />
                            {RULE_DATA.initial.map((rule, i) => <TableRow key={i} src={rule.src} dest={rule.dest} isLast={i === RULE_DATA.initial.length - 1} />)}
                        </div>
                        {/* COL 2: ÂM VẦN (ORANGE) */}
                        <div className="rounded-xl overflow-hidden border-2 border-orange-500 shadow-lg bg-orange-50">
                            <TableHeader title="ÂM VẦN" sub1="ÂM HÁN VIỆT" sub2="ÂM ON" colorClass="bg-orange-500" />
                            {RULE_DATA.rhyme.map((rule, i) => <TableRow key={i} src={rule.src} dest={rule.dest} isLast={i === RULE_DATA.rhyme.length - 1} />)}
                        </div>
                        {/* COL 3: ÂM CUỐI (GREEN) + OTHER */}
                        <div className="flex flex-col gap-6">
                            <div className="rounded-xl overflow-hidden border-2 border-emerald-600 shadow-lg bg-emerald-50">
                                <TableHeader title="ÂM CUỐI" sub1="ÂM HÁN VIỆT" sub2="ÂM ON" colorClass="bg-emerald-600" />
                                {RULE_DATA.ending.map((rule, i) => <TableRow key={i} src={rule.src} dest={rule.dest} isLast={i === RULE_DATA.ending.length - 1} fontClass="font-serif" />)}
                            </div>
                            <div className="rounded-xl overflow-hidden border-2 border-slate-500 bg-white shadow-lg">
                                <div className="bg-slate-600 text-white font-black text-center py-2 text-lg uppercase tracking-wider border-b-2 border-slate-500">BIẾN ÂM KHÁC</div>
                                <div className="p-4 text-sm text-slate-800 font-medium space-y-4">
                                    {RULE_DATA.special.map((note, i) => (
                                        <div key={i} className="flex gap-2"><span className="text-slate-900 font-black">•</span><p className="whitespace-pre-line leading-relaxed">{note.text}</p></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // --- TAB 2: PHONETIC RULES (UPDATED TEXT) ---
                    <div className="max-w-4xl mx-auto space-y-8 animate-slide-up">
                        
                        {/* 1. KANJI LONG VOWELS */}
                        <div className="rounded-xl overflow-hidden border-2 border-purple-500 shadow-xl bg-white">
                            <div className="bg-purple-600 text-white font-black text-center py-3 text-lg uppercase tracking-wider border-b-2 border-purple-400">
                                1. PHÂN BIỆT TRƯỜNG ÂM TRONG KANJI (THEO ÂM HÁN VIỆT)
                            </div>
                            <div className="grid grid-cols-12 text-center text-[10px] font-black uppercase bg-slate-200 border-b border-slate-300 py-2">
                                <div className="col-span-4 text-slate-600">Đặc điểm</div>
                                <div className="col-span-4 text-emerald-700">CÓ Trường Âm (Chouon)</div>
                                <div className="col-span-4 text-rose-700">KHÔNG CÓ Trường Âm</div>
                            </div>
                            {RULE_DATA.phoneticKanji.map((rule, i) => (
                                <PhoneticRow key={i} criteria={rule.criteria} yes={rule.yes} no={rule.no} isLast={i === RULE_DATA.phoneticKanji.length - 1} />
                            ))}
                            <div className="p-4 bg-purple-50 space-y-2 border-t border-purple-100">
                                <div className="text-[11px] font-bold text-purple-900">
                                    <i className="fas fa-info-circle mr-1"></i> Mẹo nhỏ: Quy tắc này giúp bạn đoán xem âm On-yomi có kéo dài hay không dựa trên cấu trúc nguyên âm.
                                </div>
                            </div>
                        </div>

                        {/* 2. KATAKANA LONG VOWELS */}
                        <div className="rounded-xl overflow-hidden border-2 border-pink-500 shadow-xl bg-white">
                            <div className="bg-pink-600 text-white font-black text-center py-3 text-lg uppercase tracking-wider border-b-2 border-pink-400">
                                2. TRƯỜNG ÂM TRONG KATAKANA (TỪ MƯỢN TIẾNG ANH)
                            </div>
                            <div className="grid grid-cols-12 text-center text-[10px] font-black uppercase bg-slate-200 border-b border-slate-300 py-2">
                                <div className="col-span-4 text-slate-600">Quy tắc Tiếng Anh</div>
                                <div className="col-span-4 text-slate-600">Ví dụ (Eng)</div>
                                <div className="col-span-4 text-pink-600">Cách viết (Có ー)</div>
                            </div>
                            {RULE_DATA.phoneticKatakana.map((rule, i) => (
                                <div key={i} className={`grid grid-cols-12 text-center text-sm ${i < RULE_DATA.phoneticKatakana.length - 1 ? 'border-b border-slate-300' : ''}`}>
                                    <div className="col-span-4 py-3 px-2 bg-slate-50 border-r border-slate-300 font-bold text-slate-700 text-xs flex items-center justify-center">{rule.rule}</div>
                                    <div className="col-span-4 py-3 px-2 border-r border-slate-300 text-slate-600 font-medium flex items-center justify-center text-xs">{rule.exEn}</div>
                                    <div className="col-span-4 py-3 px-2 text-pink-600 font-black flex items-center justify-center text-sm font-serif">{rule.exJa}</div>
                                </div>
                            ))}
                        </div>

                        {/* 3. SOKUON (AM NGAT) */}
                        <div className="rounded-xl overflow-hidden border-2 border-amber-500 shadow-xl bg-amber-50">
                             <div className="bg-amber-600 text-white font-black text-center py-3 text-lg uppercase tracking-wider border-b-2 border-amber-400">
                                3. BONUS: QUY TẮC ÂM NGẮT (っ/ッ)
                            </div>
                            <div className="p-6 text-center space-y-4">
                                <div className="inline-block px-6 py-3 bg-amber-100 rounded-2xl border-2 border-amber-400 shadow-inner">
                                    <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest block mb-2">CÂU THẦN CHÚ CHIẾN THẦN</span>
                                    <span className="text-3xl font-black text-amber-700 font-digital">"{RULE_DATA.sokuon.mantra}"</span>
                                </div>
                                <div className="text-sm font-bold text-slate-700">
                                    Tương ứng với các hàng: <span className="text-amber-600 text-2xl mx-1 font-digital">{RULE_DATA.sokuon.rows}</span>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-xl mx-auto italic font-medium">
                                    {RULE_DATA.sokuon.desc}
                                </p>
                                <div className="bg-white px-4 py-2 rounded-xl border border-amber-200 text-slate-500 font-bold text-xs">
                                    Ví dụ: <span className="text-slate-800">{RULE_DATA.sokuon.examples}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-900 rounded-2xl border border-white/10 text-center">
                            <p className="text-[11px] text-slate-400 font-medium italic">
                                * Lưu ý: Các quy tắc trên đúng khoảng 85%. Tiếng Nhật luôn có ngoại lệ, nhưng với dân kỹ thuật cần học nhanh như bạn thì đống mẹo này là quá đủ để "phá đảo" rồi!
                            </p>
                        </div>

                    </div>
                )}

            </div>
        </div>
    );
};

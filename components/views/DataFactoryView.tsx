
import React, { useState, useEffect } from 'react';
import { parseVocabString, getNextImportLessonId, loadDB } from '../../services/storageService';
import { Vocab } from '../../types';

interface DataFactoryProps {
    onImport: (newVocab: Vocab[]) => void;
    onClose: () => void;
    onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const DataFactoryView: React.FC<DataFactoryProps> = ({ onImport, onClose, onNotify }) => {
    const [lessonNum, setLessonNum] = useState<string>("1");
    const [rawInput, setRawInput] = useState<string>("");
    const [autoDetectLesson, setAutoDetectLesson] = useState(false); // New state for multi-import

    // Auto-calculate next lesson ID on mount
    useEffect(() => {
        const db = loadDB();
        setLessonNum(getNextImportLessonId(db));
    }, []);

    const handleImport = () => {
        if (!rawInput.trim()) {
            onNotify("Vui lòng dán dữ liệu vào ô trống", 'error');
            return;
        }
        
        // Pass "AUTO" if checkbox checked, else specific lesson num
        const targetLesson = autoDetectLesson ? "AUTO" : lessonNum;
        const vocab = parseVocabString(rawInput, targetLesson);
        
        if (vocab.length > 0) {
            onImport(vocab);
            onClose();
        } else {
            onNotify("Không tìm thấy dữ liệu hợp lệ. Kiểm tra định dạng JSON.", 'error');
        }
    };

    const insertTemplate = () => {
        const template = `[
  { "id": 21, "type": "vocab", "ka": "びょういん", "kj": "病院", "ro": "byouin", "hv": "Bệnh Viện", "mean": "bệnh viện", "on": "-", "kun": "-", "en": "-", "lesson": "1" },
  { "id": "21.1", "type": "kanji", "ka": "やま.い", "kj": "病", "ro": "byou", "hv": "Bệnh", "mean": "Ốm, bệnh tật", "on": "BYOU", "kun": "yamai", "en": "-", "lesson": "2" },
  { "id": "21.2", "type": "kanji", "ka": "にわ", "kj": "院", "ro": "in", "hv": "Viện", "mean": "Cái sân, tòa nhà, học viện", "on": "IN", "kun": "niwa", "en": "-" }
]`;
        setRawInput(prev => prev + template);
    };

    return (
        <section className="absolute inset-0 p-8 overflow-y-auto custom-scrollbar animate-slide-up bg-black/80 backdrop-blur-md">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center border-l-4 border-emerald-500 pl-4">
                    <h2 className="text-2xl font-black italic uppercase text-white tracking-widest">Xưởng dữ liệu</h2>
                    <button onClick={onClose} className="text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:text-white">Đóng</button>
                </div>
                
                <div className="rounded-[1.25rem] border-[2.5px] border-emerald-500/30 p-8 space-y-6 bg-slate-900/50">
                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">CẤU HÌNH NHẬP LIỆU</label>
                        
                        {/* AUTO DETECT TOGGLE */}
                        <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/10">
                            <input 
                                type="checkbox" 
                                checked={autoDetectLesson} 
                                onChange={(e) => setAutoDetectLesson(e.target.checked)}
                                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                                id="autoDetect"
                            />
                            <label htmlFor="autoDetect" className="cursor-pointer">
                                <div className="text-xs font-bold text-white uppercase">Chế độ nạp nhiều bài (Auto Detect)</div>
                                <div className="text-[9px] text-slate-400 italic">Sử dụng thuộc tính 'lesson' trong file JSON thay vì ghi đè</div>
                            </label>
                        </div>

                        {!autoDetectLesson && (
                            <div className="flex items-center gap-2 animate-slide-up">
                                <span className="text-xs font-bold text-slate-400">Ghi đè vào bài số:</span>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="99" 
                                    value={lessonNum} 
                                    onChange={(e) => setLessonNum(e.target.value)}
                                    className="w-24 font-black text-lg bg-[#020617] text-[#f8fafc] border-[2.5px] border-[#1e293b] p-3 rounded-xl outline-none focus:border-indigo-500 focus:shadow-[0_0_15px_rgba(99,102,241,0.2)] text-center"
                                />
                                <div className="text-[10px] text-slate-500 italic">
                                    * Tất cả từ vựng được nạp sẽ bị gán vào bài này.
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2 relative">
                        <div className="flex justify-between items-end">
                            <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Dán dữ liệu (JSON Object/Array)</label>
                            <button onClick={insertTemplate} className="text-[9px] font-black text-emerald-400 hover:text-emerald-300 uppercase bg-emerald-900/30 px-2 py-1 rounded">
                                + Chèn mẫu Atomize V2
                            </button>
                        </div>
                        <div className="text-[10px] text-slate-500 mb-2 font-mono space-y-1">
                            <div>Format chuẩn (JSON 11 trường): <span className="text-indigo-400">id, type, ka, kj, ro, hv, mean, on, kun, en</span></div>
                            <div className="italic text-[9px] text-rose-400 font-bold">Lưu ý: type='vocab' cho từ ghép, type='kanji' cho chữ Hán lẻ.</div>
                        </div>
                        <textarea 
                            value={rawInput}
                            onChange={(e) => setRawInput(e.target.value)}
                            className="w-full h-72 text-[12px] font-mono leading-relaxed bg-[#020617] text-[#f8fafc] border-[2.5px] border-[#1e293b] p-4 rounded-xl outline-none focus:border-indigo-500 focus:shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
                            placeholder='[ { "id": 21, "type": "vocab", ... } ]'
                        ></textarea>
                    </div>

                    <button 
                        onClick={handleImport}
                        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-xl transition-all border border-emerald-500/30"
                    >
                        Xác nhận nạp bài học
                    </button>
                </div>
            </div>
        </section>
    );
};


import { AppDatabase, STORAGE_KEY, Vocab, UserStats, SRSStatus } from '../types';

const DEFAULT_STATS: UserStats = {
    xp: 0,
    level: 1,
    streak: 0,
    score: 0,
    lastStudyDate: "",
    title: "Tân binh"
};

const DEFAULT_DB: AppDatabase = {
    vocab: [],
    favorites: [],
    mistakes: [],
    mistakeStreaks: {}, 
    srs: {},
    stats: DEFAULT_STATS,
    config: { 
        kanjiSize: 90, // Reduced by ~30% from 130
        autoPlayAudio: true,
        writingTimer: 0, 
        writingMode: 'sequential'
    },
    history: {},
    studyLog: {},
    highScores: {
        anki: [],
        match: [],
        survival: [],
        writing: []
    },
    cramSession: undefined
};

export const RANKS = [
    { threshold: 2501, title: "Huyền thoại", icon: "👑", color: "text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] border-yellow-500" },
    { threshold: 1001, title: "Hiền triết", icon: "🔮", color: "text-fuchsia-400 drop-shadow-[0_0_15px_rgba(192,132,252,0.8)] border-fuchsia-500" },
    { threshold: 401, title: "Bậc thầy", icon: "💎", color: "text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)] border-cyan-500" },
    { threshold: 201, title: "Chuyên gia", icon: "🏹", color: "text-indigo-400 border-indigo-500" },
    { threshold: 101, title: "Học giả", icon: "📜", color: "text-sky-400 border-sky-500" },
    { threshold: 51, title: "Người tập sự", icon: "🗡️", color: "text-emerald-400 border-emerald-500" },
    { threshold: 0, title: "Tân binh", icon: "🌱", color: "text-slate-400 border-slate-500" }
];

export const getRankByCount = (count: number) => {
    return RANKS.find(r => count >= r.threshold) || RANKS[RANKS.length - 1];
};

export const loadDB = (): AppDatabase => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Migration logic for old data if needed
            const migratedVocab = (parsed.vocab || []).map((v: any) => ({
                ...v,
                type: v.type || 'vocab',
                ka: v.ka || v.hira || "-",
                kj: v.kj || v.kanji || "-",
                ro: v.ro || v.romaji || "-",
                en: v.en || v.eng || "-",
                on: v.on || "-",
                kun: v.kun || "-"
            }));

            return { 
                ...DEFAULT_DB, 
                ...parsed, 
                vocab: migratedVocab,
                stats: { ...DEFAULT_STATS, ...parsed.stats },
                config: { ...DEFAULT_DB.config, ...parsed.config },
                highScores: { ...DEFAULT_DB.highScores, ...(parsed.highScores || {}) }
            };
        }
    } catch (e) { console.error(e); }
    return DEFAULT_DB;
};

export const saveDB = (db: AppDatabase) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } 
    catch (e) { console.error(e); }
};

export const exportVocabData = (db: AppDatabase, lessonId?: string) => {
    try {
        const dataToExport = lessonId 
            ? db.vocab.filter(v => v.lesson === lessonId)
            : db.vocab;

        if (dataToExport.length === 0) {
            alert("Không có dữ liệu để xuất!");
            return;
        }

        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `kotoba_export_${lessonId ? `bai_${lessonId}` : 'full'}_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    } catch (e) { alert("Lỗi xuất dữ liệu!"); }
};

export const calculateSRS = (current: SRSStatus | undefined, rating: 1 | 2 | 3 | 4, hintUsed: boolean = false): SRSStatus => {
    const now = Date.now();
    const ONE_MINUTE = 60 * 1000;
    const ONE_HOUR = 60 * ONE_MINUTE;
    const ONE_DAY = 24 * ONE_HOUR;

    // Initialize if undefined
    let status: SRSStatus = current ? { ...current } : {
        status: 'new',
        interval: 0,
        easeFactor: 2.5,
        stepIndex: 0,
        lapses: 0,
        lastReviewed: 0,
        nextReview: now,
        reps: 0,
        mustReviewConsecutiveCorrect: 0
    };

    // Update stats
    status.lastReviewed = now;
    status.reps = (status.reps || 0) + 1;

    // Hint Penalty Logic
    let effectiveRating = rating;
    if (hintUsed) {
        if (rating === 4) effectiveRating = 3; // Disable Easy
        if (rating === 3) effectiveRating = 2; // Treat Good as Hard for interval
    }

    // --- MUST REVIEW LOGIC ---
    if (status.status === 'must_review') {
        if (effectiveRating >= 3) {
            status.mustReviewConsecutiveCorrect = (status.mustReviewConsecutiveCorrect || 0) + 1;
            
            // Check exit condition: 2 consecutive correct answers (Level 3 or 4)
            if (status.mustReviewConsecutiveCorrect >= 2) {
                // Graduate from Must Review
                status.status = 'review';
                status.mustReviewConsecutiveCorrect = 0;
                
                // Set interval based on rating
                if (effectiveRating === 3) {
                    status.interval = 1.5; // 1.5 days
                    status.nextReview = now + (1.5 * ONE_DAY);
                } else {
                    status.interval = 3; // 3 days
                    status.nextReview = now + (3 * ONE_DAY);
                }
            } else {
                // Stay in must_review, schedule next review shortly (e.g., 10 mins)
                status.nextReview = now + (10 * ONE_MINUTE);
            }
        } else {
            // Rating 1 or 2
            // Reset consecutive correct counter if failed
            status.mustReviewConsecutiveCorrect = 0;
            // Stay in must_review, immediate retry
            status.nextReview = now + ONE_MINUTE;
        }
        return status;
    }

    // --- STANDARD LOGIC ---
    
    // Level 1 (AGAIN - Pink)
    if (rating === 1) {
        status.lapses = (status.lapses || 0) + 1;
        status.status = 'learning'; // Reset to learning
        status.stepIndex = 0;
        status.nextReview = now + ONE_MINUTE; // Session queue handles immediate repetition
        return status;
    }

    // Level 2 (HARD - Orange)
    if (effectiveRating === 2) {
        status.nextReview = now + (15 * ONE_HOUR);
        // Keep current status or move to learning? Usually Hard implies learning step.
        if (status.status === 'review') status.status = 'relearning';
        return status;
    }

    // Level 3 (GOOD - Green)
    if (effectiveRating === 3) {
        status.status = 'review';
        status.interval = 1.5; // 1.5 days
        status.nextReview = now + (1.5 * ONE_DAY);
        return status;
    }

    // Level 4 (EASY - Blue)
    if (effectiveRating === 4) {
        status.status = 'review';
        status.interval = 3; // 3 days
        status.nextReview = now + (3 * ONE_DAY);
        return status;
    }

    return status;
};

export const getSRSIntervalDisplay = (current: SRSStatus | undefined, rating: 1 | 2 | 3 | 4, hintUsed: boolean = false): string => {
    // Clone to avoid mutation
    const tempCurrent = current ? { ...current } : undefined;
    const next = calculateSRS(tempCurrent, rating, hintUsed);
    const diff = next.nextReview - Date.now();
    
    if (diff < 60 * 60 * 1000) { // Less than 1 hour
        const mins = Math.round(diff / 60000);
        return mins <= 1 ? "< 1p" : `${mins}p`;
    } else if (diff < 24 * 60 * 60 * 1000) { // Less than 1 day
        const hours = Math.round(diff / 3600000);
        return `${hours}h`;
    } else {
        const days = Math.round(diff / (24 * 60 * 60 * 1000));
        return `${days} ngày`;
    }
};

// Update: SRS can now filter by type (default 'vocab')
export const getDueVocab = (db: AppDatabase, type: 'vocab' | 'kanji' = 'vocab'): Vocab[] => {
    const now = Date.now();
    return db.vocab.filter(v => {
        if (v.type !== type) return false;
        const srs = db.srs[v.id];
        // If no SRS, it's new (due immediately). If SRS exists, check nextReview.
        // Must Review items are prioritized
        return !srs || srs.nextReview <= now || srs.status === 'must_review';
    }).sort((a, b) => {
        const srsA = db.srs[a.id];
        const srsB = db.srs[b.id];
        
        // Priority: Must Review > Overdue > New
        const isMustReviewA = srsA?.status === 'must_review';
        const isMustReviewB = srsB?.status === 'must_review';
        
        if (isMustReviewA && !isMustReviewB) return -1;
        if (!isMustReviewA && isMustReviewB) return 1;
        
        const nextA = srsA?.nextReview || 0;
        const nextB = srsB?.nextReview || 0;
        return nextA - nextB;
    });
};

export const updateStats = (db: AppDatabase, xpGain: number): UserStats => {
    const today = new Date().toISOString().split('T')[0];
    const newXP = db.stats.xp + xpGain;
    
    // Update Streak logic
    let newStreak = db.stats.streak;
    const lastDate = db.stats.lastStudyDate;
    if (lastDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];
        if (lastDate === yStr) {
            newStreak += 1;
        } else {
            newStreak = 1; // Reset or start new
        }
    }

    // Note: studyLog update must be handled by the caller or a wrapper function
    // as this function only returns UserStats.

    // Req: Apprentice rank (Người tập sự) only counts 'vocab' type
    const masteredVocabCount = db.vocab.filter(v => {
        const s = db.srs[v.id];
        return s && s.status === 'review' && v.type === 'vocab';
    }).length;

    // Helper to determine rank based on count
    const getRankTitle = (count: number) => {
        const rank = RANKS.find(r => count >= r.threshold);
        return rank ? rank.title : RANKS[RANKS.length - 1].title;
    };
    
    return { 
        ...db.stats, 
        xp: newXP, 
        score: db.stats.score + xpGain, 
        lastStudyDate: today, 
        streak: newStreak, 
        level: Math.floor(Math.sqrt(newXP / 100)) + 1, 
        title: getRankTitle(masteredVocabCount) 
    };
};

export const checkIn = (db: AppDatabase): AppDatabase => {
    const today = new Date().toISOString().split('T')[0];
    
    // Calculate new stats with a bonus
    const CHECKIN_XP = 50;
    const newStats = updateStats(db, CHECKIN_XP);
    
    // Update Study Log
    const newStudyLog = { ...db.studyLog };
    newStudyLog[today] = (newStudyLog[today] || 0) + 1;

    return {
        ...db,
        stats: newStats,
        studyLog: newStudyLog
    };
};

export const parseVocabString = (raw: string, lesson: string): Vocab[] => {
    try {
        const parsed = JSON.parse(raw.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];
        
        // If lesson is "AUTO", we don't force it, but default to "1" if missing
        const isAuto = lesson === "AUTO";
        const defaultLesson = "1";

        return list.map((item: any) => {
            let originalId = String(item.id || Math.random().toString(36).substr(2, 9));
            
            // Determine final lesson ID
            const targetLesson = isAuto ? String(item.lesson || defaultLesson) : String(lesson);
            
            // Logic to prevent duplicate prefixes if re-importing
            // If the ID already starts with "X_", check if X matches targetLesson
            const prefix = `${targetLesson}_`;
            const finalId = originalId.startsWith(prefix) ? originalId : `${prefix}${originalId}`;

            return {
                id: finalId,
                type: item.type || 'vocab',
                lesson: targetLesson, // Force override or preserve
                ka: item.ka || "-",
                kj: item.kj || "-",
                ro: item.ro || "-",
                hv: item.hv || "-",
                mean: item.mean || "-",
                on: item.on || "-",
                kun: item.kun || "-",
                en: item.en || "-",
            };
        });
    } catch (e) {
        return [];
    }
};

export const getRelatedVocab = (db: AppDatabase, kanjiChar: string): Vocab[] => {
    // Only return 'vocab' type related words, not isolated kanji entries
    return db.vocab.filter(v => v.type === 'vocab' && v.kj && v.kj.includes(kanjiChar));
};

export const getPhoneticFamily = (db: AppDatabase, targetHV: string): Vocab[] => {
    // Return other 'kanji' entries with similar HV
    return db.vocab.filter(v => v.type === 'kanji' && v.hv === targetHV);
};

export interface VocabStatus { vocab: Vocab; status: string; colorClass: string; }
export const getVocabStatus = (db: AppDatabase, v: Vocab): VocabStatus => ({ 
    vocab: v, 
    status: db.srs[v.id]?.status || 'new',
    colorClass: '' 
});

// Helper to find the next available lesson number for import
export const getNextImportLessonId = (db: AppDatabase): string => {
    const existingLessons = new Set(db.vocab.map(v => parseInt(v.lesson)));
    // Scan from 1 to 100 to find the first gap
    for (let i = 1; i <= 100; i++) {
        if (!existingLessons.has(i)) {
            return i.toString();
        }
    }
    return "1";
};

// Reset progress for a specific lesson
export const resetLessonStats = (db: AppDatabase, lessonId: string, type?: 'vocab' | 'kanji'): AppDatabase => {
    const newSRS = { ...db.srs };
    
    db.vocab.forEach(v => {
        // String comparison to be safe
        if (String(v.lesson) === String(lessonId)) {
            // Apply type filter if exists
            if (type && v.type !== type) return;

            const now = Date.now();
            newSRS[v.id] = {
                status: 'new',
                interval: 0,
                easeFactor: 2.5,
                stepIndex: 0,
                lapses: 0,
                lastReviewed: 0,
                nextReview: now,
                reps: 0
            };
        }
    });

    return { ...db, srs: newSRS };
};

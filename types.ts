
export interface Vocab {
    id: string | number;
    type: 'vocab' | 'kanji';
    lesson: string;
    ka: string; // was hira
    kj: string; // was kanji
    ro: string; // was romaji
    hv: string;
    mean: string;
    on: string; // new
    kun: string;
    en: string; // was eng
    example?: string;
}

export interface SRSStatus {
    status: 'new' | 'learning' | 'review' | 'relearning' | 'must_review';
    interval: number;      // Current gap in days (0.5 = 12h)
    easeFactor: number;    // Multiplier, default 2.5
    stepIndex: number;     // For 'learning' phase (e.g., 0: 1m, 1: 10m)
    lapses: number;        // Number of times rated "Again"
    lastReviewed: number;  // Timestamp (ms)
    nextReview: number;    // Timestamp (ms)
    reps: number;          // Total repetitions (legacy/stat)
    mustReviewConsecutiveCorrect?: number; // Track consecutive correct answers for exiting Must Review
}

export interface HighScoreRecord {
    date: string; 
    score: number;
}

export interface UserStats {
    xp: number;
    level: number;
    streak: number;
    score: number; 
    lastStudyDate: string; 
    title: string; 
    checkIns?: string[]; // Array of YYYY-MM-DD
    wordsStudiedToday?: number;
}

export interface AppConfig {
    kanjiSize: number;
    autoPlayAudio: boolean;
    lastLessonId?: string;
    writingTimer: number; 
    writingMode: 'sequential' | 'shuffle';
}

export interface CramSession {
    lessonId: string;
    queue: Vocab[];
    buffer: Vocab[];
    progressMap: Record<string, number>; // itemId -> hits (0-3)
    graduatedIds: string[];
    lockStartTime: number; // Timestamp when lock started
    lockDuration: number; // Seconds (default 240)
    phase: 'setup' | 'locked' | 'cramming' | 'exit_test' | 'finished';
    mistakesInExitTest: number;
    blitzSpeed: number;
    testQueue: Vocab[]; // Items to review before exit
}

export interface HistoryState {
    [key: string]: number;
}

export interface AppDatabase {
    vocab: Vocab[];
    favorites: string[];
    mistakes: string[];
    mistakeStreaks: Record<string, number>; 
    srs: Record<string, SRSStatus>; 
    stats: UserStats;
    config: AppConfig;
    history: HistoryState;
    studyLog: Record<string, number>; 
    highScores: {
        anki: HighScoreRecord[];
        match: HighScoreRecord[];
        survival: HighScoreRecord[];
        writing: HighScoreRecord[];
        [key: string]: HighScoreRecord[]; 
    };
    cramSession?: CramSession; // New persistent session
}

export type ViewName = 'dashboard' | 'lesson-list' | 'data-factory' | 'study' | 'writing' | 'reflex' | 'reflex-selector' | 'blitz-game' | 'cram' | 'settings' | 'rule-explorer' | 'kanji-explorer' | 'kanji-network' | 'typing';
export type ModeName = 'study' | 'writing' | 'reflex' | 'blitz' | 'cram' | 'typing';

export const STORAGE_KEY = 'kotoba_master_pro_v13';


// Rules map for Sino-Vietnamese -> Onyomi mapping
// This is a simplified rule set for demonstration.

const CONSONANT_RULES: Record<string, string[]> = {
    'C': ['K'], 'K': ['K'], 'Q': ['K'], 'QU': ['K'],
    'D': ['Y', 'Z', 'J'], 'Đ': ['T', 'D'],
    'G': ['K', 'G'], 'GH': ['K', 'G'],
    'H': ['K', 'G'],
    'L': ['R'],
    'M': ['M', 'B'],
    'N': ['N', 'J'], 'NH': ['N', 'J', 'Z'], 'NG': ['G', 'G'],
    'P': ['H'], 'PH': ['H'],
    'S': ['S', 'SH'], 'X': ['S', 'SH'],
    'T': ['T', 'S', 'CH'], 'TH': ['S', 'T'], 'TR': ['CH', 'J'],
    'V': ['M', 'B', 'W']
};

const RHYME_RULES: Record<string, string[]> = {
    'A': ['A'], 'AC': ['AKU'], 'ACH': ['AKU', 'EKI'], 'AI': ['AI'], 'AM': ['AN'], 'AN': ['AN'], 'ANG': ['OU', 'YOU'], 'ANH': ['EI', 'OU'], 'AO': ['OU'], 'AP': ['OU', 'ATSU'], 'AT': ['ATSU'], 'AY': ['AI'],
    'E': ['AI', 'EI'], 'EM': ['EN'], 'EN': ['EN'], 'ET': ['ETSU'],
    'I': ['I'], 'IA': ['A'], 'ICH': ['EKI'], 'IEU': ['OU', 'YOU'], 'IM': ['IN'], 'IN': ['IN'], 'INH': ['EI', 'SEI', 'SHOU'], 'IP': ['YUU', 'ITSU'], 'IT': ['ITSU'],
    'O': ['O'], 'OA': ['A', 'WA'], 'OC': ['AKU', 'OKU'], 'OI': ['AI'], 'OM': ['AN', 'ON'], 'ON': ['ON'], 'ONG': ['OU', 'UU'], 'OP': ['OU'], 'OT': ['OTSU'],
    'U': ['U'], 'UA': ['A'], 'UAN': ['AN'], 'UANG': ['OU'], 'UC': ['UKU', 'OKU'], 'UE': ['AI'], 'UI': ['I', 'KI'], 'UM': ['UN'], 'UN': ['UN'], 'UNG': ['OU', 'UU'], 'UO': ['O'], 'UOC': ['AKU'], 'UONG': ['OU'], 'UY': ['I', 'KI'], 'UYEN': ['EN'], 'UYET': ['ETSU'], 'UU': ['UU', 'YU'],
    'Y': ['I'], 'YEU': ['OU', 'YOU'], 'YEN': ['EN']
};

export interface PhoneticAnalysis {
    originalHV: string;
    consonantRule: { src: string, dest: string[] } | null;
    rhymeRule: { src: string, dest: string[] } | null;
    prediction: string;
    isMatch: boolean;
}

const removeTones = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
};

// Simple heuristic to split HV into Consonant and Rhyme
// E.g., "TRUONG" -> "TR" + "UONG"
const splitHV = (hv: string) => {
    // Normalize to remove tones for lookup (e.g., HỌC -> HOC)
    const normalized = removeTones(hv).toUpperCase();
    
    // Sort consonants by length desc to match multi-char consonants first (e.g., NG, TH)
    const consonants = Object.keys(CONSONANT_RULES).sort((a, b) => b.length - a.length);
    
    let start = "";
    let end = normalized;

    for (const c of consonants) {
        if (normalized.startsWith(c)) {
            start = c;
            end = normalized.substring(c.length);
            break;
        }
    }
    return { start, end, normalized };
};

export const analyzePhonetics = (hv: string): PhoneticAnalysis => {
    const { start, end } = splitHV(hv);
    
    const cRule = start ? { src: start, dest: CONSONANT_RULES[start] || [] } : null;
    const rRule = end ? { src: end, dest: RHYME_RULES[end] || [] } : null;

    let prediction = "";
    if (cRule && rRule) {
        // Simple prediction: take first common mapping (heuristic)
        // For HOC (GAKU): H->[K,G], OC->[AKU, OKU]. Combinations: KAKU, KOKU, GAKU, GOKU.
        // We just concat the first options for simplicity, or try to be smart.
        // Let's just return the combination of first options, 
        // but since H -> K/G, usually G is specific.
        const c = cRule.dest[0] || "";
        const r = rRule.dest[0] || "";
        prediction = c + r;

        // Special override logic could go here, but for now we list possibilities.
        // If consonant can be G, and rhyme AKU -> GAKU.
        if (cRule.dest.includes('G') && rRule.dest.includes('AKU')) {
             prediction = "GAKU / KOKU";
        }
    } else if (rRule && !start) {
        prediction = rRule.dest[0] || "";
    }

    return {
        originalHV: hv,
        consonantRule: cRule,
        rhymeRule: rRule,
        prediction,
        isMatch: true // In a real app, compare with actual On reading
    };
};

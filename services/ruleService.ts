
export interface ManualRule {
    src: string;
    dest: string;
    note?: string;
}

export const RULE_DATA = {
  initial: [
    { src: 'C, K, KH, GI', dest: 'K' },
    { src: 'QU, H', dest: 'K (hoặc G)' },
    { src: 'L', dest: 'R' },
    { src: 'NG, NGH', dest: 'G' },
    { src: 'M', dest: 'M (hoặc B)' },
    { src: 'N, NH', dest: 'N' },
    { src: 'B, PH', dest: 'H (hoặc B)' },
    { src: 'T, TH, CH, S, X', dest: 'S (hoặc SH)' },
    { src: 'TR', dest: 'CH' },
    { src: 'Đ', dest: 'D (hoặc T)' },
    { src: 'D, V', dest: 'không có' },
  ],
  rhyme: [
    { src: 'A, OA', dest: 'A (hoặc E, O)' },
    { src: 'Ă, O', dest: 'O' },
    { src: 'Â', dest: 'i' },
    { src: 'Ư', dest: 'YO' },
    { src: 'AI, OI', dest: 'AI' },
    { src: 'ƯU, ẤP', dest: 'YUU' },
    { src: 'IE, UYÊ', dest: 'E' },
    { src: 'ICH', dest: 'EKI' },
    { src: 'E, ANH, INH, ÊNH', dest: 'EI (hoặc AI)' },
    { src: 'AO, ÂU, ANG, OANG, ONG', dest: 'OU' },
    { src: 'IÊU, ƯƠNG, UÔNG, UNG', dest: 'YOU' },
  ],
  ending: [
    { src: 'N, M', dest: 'ん' },
    { src: 'T', dest: 'つ (hoặc く, き)' },
    { src: 'C, CH', dest: 'く (hoặc き)' },
  ],
  special: [
    { text: 'Sau chữ hán kết thúc bằng ん là hàng は => thì chuyển sang hàng ぱ\nVD: 文 (ぶん) / 法 (ほう) => 文法 (ぶんぽう)' },
    { text: '2 chữ đọc kiểu Kun-Kun: => Chữ sau xuất hiện âm đục\nVD1: 出口 (でぐち)\nVD2: 飲み薬 (のみぐすり)' }
  ],
  // NEW: Phonetic Rules Data
  phoneticKanji: [
    { criteria: 'Số lượng chữ cái', yes: 'Từ 4 chữ cái trở lên\n(VD: Động -> Dou)', no: 'Chỉ có 1, 2, hoặc 3 chữ cái\n(VD: Cổ -> Ko)' },
    { criteria: 'Đuôi âm Hán Việt', yes: 'Kết thúc bằng NH, NG, P', no: 'Kết thúc bằng Ư, Ơ, Ô, I, A\n(VD: Thư, Cơ, Phổ)' },
    { criteria: 'Vần đặc biệt', yes: 'Kết thúc bằng ƯU, Ê, O, U, E\n(VD: Dụng, Ánh, Tập)', no: 'Chữ Hán đọc thành 2 âm tiết trở lên\n(VD: Học -> Gaku)' },
    { criteria: 'Cấu trúc nguyên âm', yes: 'Có 2 nguyên âm ghép lại ở cuối', no: 'Thường chỉ có 1 nguyên âm đơn' }
  ],
  phoneticKatakana: [
    { rule: 'Có đuôi "-r" (ar, in, ur, er, or)', exEn: 'Calendar, Report', exJa: 'カレンダー, レポート' },
    { rule: 'Kết thúc bằng "Y" (/i/)', exEn: 'Party, Taxi', exJa: 'パーティー, タクシー' },
    { rule: 'Nguyên âm + Phụ âm + "E" câm', exEn: 'Cake, Note, Rule', exJa: 'ケーキ, ノート, ルール' }
  ],
  sokuon: {
      mantra: "Phòng Trọ Khách Sạn",
      rows: "P, T, K, S",
      desc: "Khi các âm thuộc 4 hàng này đi trước một âm khác cùng loại, chúng thường biến thành âm ngắt 「っ/ッ」 để tạo độ nảy.",
      examples: "Nikki (Nhật ký), Kitte (Con tem), Beddo (Cái giường)"
  }
};

// Legacy support
export const parseRuleCodes = (_ruleString: string, _kanjiString: string, _hvString: string) => {
    return [];
};

export interface ThaiStockMeta {
  symbol: string;
  nameTh: string;
  sector: string;
  isSet50: boolean;
}

export const SET50_STOCKS: ThaiStockMeta[] = [
  // Energy & Utilities
  { symbol: "PTT", nameTh: "ปตท.", sector: "พลังงานและสาธารณูปโภค", isSet50: true },
  { symbol: "PTTEP", nameTh: "ปตท. สำรวจและผลิตปิโตรเลียม", sector: "พลังงานและสาธารณูปโภค", isSet50: true },
  { symbol: "GULF", nameTh: "กัลฟ์ เอ็นเนอร์จี ดีเวลลอปเมนท์", sector: "พลังงานและสาธารณูปโภค", isSet50: true },
  { symbol: "OR", nameTh: "ปตท. น้ำมันและการค้าปลีก", sector: "พลังงานและสาธารณูปโภค", isSet50: true },
  { symbol: "TOP", nameTh: "ไทยออยล์", sector: "พลังงานและสาธารณูปโภค", isSet50: true },
  { symbol: "BCP", nameTh: "บางจาก คอร์ปอเรชั่น", sector: "พลังงานและสาธารณูปโภค", isSet50: true },
  { symbol: "GPSC", nameTh: "โกลบอล เพาเวอร์ ซินเนอร์ยี่", sector: "พลังงานและสาธารณูปโภค", isSet50: true },
  { symbol: "BGRIM", nameTh: "บี.กริม เพาเวอร์", sector: "พลังงานและสาธารณูปโภค", isSet50: true },
  { symbol: "EGCO", nameTh: "ผลิตไฟฟ้า", sector: "พลังงานและสาธารณูปโภค", isSet50: true },
  { symbol: "RATCH", nameTh: "ราช กรุ๊ป", sector: "พลังงานและสาธารณูปโภค", isSet50: true },
  { symbol: "BANPU", nameTh: "บ้านปู", sector: "พลังงานและสาธารณูปโภค", isSet50: true },

  // Banking
  { symbol: "KBANK", nameTh: "ธนาคารกสิกรไทย", sector: "ธนาคาร", isSet50: true },
  { symbol: "SCB", nameTh: "เอสซีบี เอกซ์", sector: "ธนาคาร", isSet50: true },
  { symbol: "BBL", nameTh: "ธนาคารกรุงเทพ", sector: "ธนาคาร", isSet50: true },
  { symbol: "KTB", nameTh: "ธนาคารกรุงไทย", sector: "ธนาคาร", isSet50: true },
  { symbol: "TTB", nameTh: "ธนาคารทหารไทยธนชาต", sector: "ธนาคาร", isSet50: true },
  { symbol: "TISCO", nameTh: "ทิสโก้ไฟแนนเชียลกรุ๊ป", sector: "ธนาคาร", isSet50: true },

  // Finance & Insurance
  { symbol: "KTC", nameTh: "บัตรกรุงไทย", sector: "เงินทุนและหลักทรัพย์", isSet50: true },
  { symbol: "MTC", nameTh: "เมืองไทย แคปปิตอล", sector: "เงินทุนและหลักทรัพย์", isSet50: true },
  { symbol: "SAWAD", nameTh: "ศรีสวัสดิ์ คอร์ปอเรชั่น", sector: "เงินทุนและหลักทรัพย์", isSet50: true },
  { symbol: "TIDLOR", nameTh: "เงินติดล้อ", sector: "เงินทุนและหลักทรัพย์", isSet50: true },
  { symbol: "TLI", nameTh: "ไทยประกันชีวิต", sector: "ประกันภัยและประกันชีวิต", isSet50: true },

  // Commerce / Retail
  { symbol: "CPALL", nameTh: "ซีพี ออลล์", sector: "พาณิชย์", isSet50: true },
  { symbol: "CPAXT", nameTh: "ซีพี แอ็กซ์ตร้า", sector: "พาณิชย์", isSet50: true },
  { symbol: "CRC", nameTh: "เซ็นทรัล รีเทล คอร์ปอเรชั่น", sector: "พาณิชย์", isSet50: true },
  { symbol: "HMPRO", nameTh: "โฮม โปรดักส์ เซ็นเตอร์", sector: "พาณิชย์", isSet50: true },
  { symbol: "BJC", nameTh: "เบอร์ลี่ ยุคเกอร์", sector: "พาณิชย์", isSet50: true },
  { symbol: "COM7", nameTh: "คอมเซเว่น", sector: "พาณิชย์", isSet50: true },
  { symbol: "GLOBAL", nameTh: "สยามโกลบอลเฮ้าส์", sector: "พาณิชย์", isSet50: true },

  // Healthcare
  { symbol: "BDMS", nameTh: "กรุงเทพดุสิตเวชการ", sector: "การแพทย์", isSet50: true },
  { symbol: "BH", nameTh: "โรงพยาบาลบำรุงราษฎร์", sector: "การแพทย์", isSet50: true },

  // ICT & Electronics
  { symbol: "ADVANC", nameTh: "แอดวานซ์ อินโฟร์ เซอร์วิส", sector: "เทคโนโลยีสารสนเทศและการสื่อสาร", isSet50: true },
  { symbol: "TRUE", nameTh: "ทรู คอร์ปอเรชั่น", sector: "เทคโนโลยีสารสนเทศและการสื่อสาร", isSet50: true },
  { symbol: "DELTA", nameTh: "เดลต้า อีเลคโทรนิคส์ (ประเทศไทย)", sector: "ชิ้นส่วนอิเล็กทรอนิกส์", isSet50: true },
  { symbol: "CCET", nameTh: "แคล-คอมพ์ อีเล็คโทรนิคส์", sector: "ชิ้นส่วนอิเล็กทรอนิกส์", isSet50: true },

  // Transportation & Tourism
  { symbol: "AOT", nameTh: "ท่าอากาศยานไทย", sector: "ขนส่งและโลจิสติกส์", isSet50: true },
  { symbol: "BEM", nameTh: "ทางด่วนและรถไฟฟ้ากรุงเทพ", sector: "ขนส่งและโลจิสติกส์", isSet50: true },
  { symbol: "BTS", nameTh: "บีทีเอส กรุ๊ป โฮลดิ้งส์", sector: "ขนส่งและโลจิสติกส์", isSet50: true },
  { symbol: "MINT", nameTh: "ไมเนอร์ อินเตอร์เนชั่นแนล", sector: "อาหารและเครื่องดื่ม", isSet50: true },
  { symbol: "CENTEL", nameTh: "โรงแรมเซ็นทรัลพลาซา", sector: "การท่องเที่ยวและสันทนาการ", isSet50: true },

  // Property & Construction Materials
  { symbol: "CPN", nameTh: "เซ็นทรัลพัฒนา", sector: "พัฒนาอสังหาริมทรัพย์", isSet50: true },
  { symbol: "AWC", nameTh: "แอสเสท เวิรด์ คอร์ป", sector: "พัฒนาอสังหาริมทรัพย์", isSet50: true },
  { symbol: "WHA", nameTh: "ดับบลิวเอชเอ คอร์ปอเรชั่น", sector: "พัฒนาอสังหาริมทรัพย์", isSet50: true },
  { symbol: "LH", nameTh: "แลนด์แอนด์เฮ้าส์", sector: "พัฒนาอสังหาริมทรัพย์", isSet50: true },
  { symbol: "SCC", nameTh: "ปูนซิเมนต์ไทย", sector: "วัสดุก่อสร้าง", isSet50: true },
  { symbol: "SCGP", nameTh: "เอสซีจี แพคเกจจิ้ง", sector: "บรรจุภัณฑ์", isSet50: true },

  // Petrochemicals & Food
  { symbol: "PTTGC", nameTh: "พีทีที โกลบอล เคมิคอล", sector: "ปิโตรเคมีและเคมีภัณฑ์", isSet50: true },
  { symbol: "IVL", nameTh: "อินโดรามา เวนเจอร์ส", sector: "ปิโตรเคมีและเคมีภัณฑ์", isSet50: true },
  { symbol: "CPF", nameTh: "เจริญโภคภัณฑ์อาหาร", sector: "อาหารและเครื่องดื่ม", isSet50: true },
  { symbol: "TU", nameTh: "ไทยยูเนี่ยน กรุ๊ป", sector: "อาหารและเครื่องดื่ม", isSet50: true },
];

export const EXTRA_POPULAR_STOCKS: ThaiStockMeta[] = [
  { symbol: "AAI", nameTh: "เอเชี่ยน อะไลอันซ์ อินเตอร์เนชั่นแนล", sector: "อาหารและเครื่องดื่ม", isSet50: false },
  { symbol: "ITC", nameTh: "ไอ-เทล คอร์ปอเรชั่น", sector: "อาหารและเครื่องดื่ม", isSet50: false },
  { symbol: "BTG", nameTh: "เบทาโกร", sector: "อาหารและเครื่องดื่ม", isSet50: false },
  { symbol: "CBG", nameTh: "คาราบาวกรุ๊ป", sector: "อาหารและเครื่องดื่ม", isSet50: false },
  { symbol: "OSP", nameTh: "โอสถสภา", sector: "อาหารและเครื่องดื่ม", isSet50: false },
  { symbol: "ICHI", nameTh: "อิชิตัน กรุ๊ป", sector: "อาหารและเครื่องดื่ม", isSet50: false },
  { symbol: "SAPPE", nameTh: "เซ็ปเป้", sector: "อาหารและเครื่องดื่ม", isSet50: false },
  { symbol: "M", nameTh: "เอ็มเค เรสโตรองต์ กรุ๊ป", sector: "อาหารและเครื่องดื่ม", isSet50: false },
  { symbol: "SPALI", nameTh: "ศุภาลัย", sector: "พัฒนาอสังหาริมทรัพย์", isSet50: false },
  { symbol: "AP", nameTh: "เอพี (ไทยแลนด์)", sector: "พัฒนาอสังหาริมทรัพย์", isSet50: false },
  { symbol: "SIRI", nameTh: "แสนสิริ", sector: "พัฒนาอสังหาริมทรัพย์", isSet50: false },
  { symbol: "AMATA", nameTh: "อมตะ คอร์ปอเรชัน", sector: "พัฒนาอสังหาริมทรัพย์", isSet50: false },
  { symbol: "ROJNA", nameTh: "สวนอุตสาหกรรมโรจนะ", sector: "พัฒนาอสังหาริมทรัพย์", isSet50: false },
  { symbol: "ORI", nameTh: "ออริจิ้น พร็อพเพอร์ตี้", sector: "พัฒนาอสังหาริมทรัพย์", isSet50: false },
  { symbol: "QH", nameTh: "ควอลิตี้เฮ้าส์", sector: "พัฒนาอสังหาริมทรัพย์", isSet50: false },
  { symbol: "BCH", nameTh: "บางกอก เชน ฮอสปิทอล", sector: "การแพทย์", isSet50: false },
  { symbol: "CHG", nameTh: "โรงพยาบาลจุฬารัตน์", sector: "การแพทย์", isSet50: false },
  { symbol: "PR9", nameTh: "โรงพยาบาลพระรามเก้า", sector: "การแพทย์", isSet50: false },
  { symbol: "MEGA", nameTh: "เมก้า ไลฟ์ไซแอ็นซ์", sector: "พาณิชย์", isSet50: false },
  { symbol: "DOHOME", nameTh: "ดูโฮม", sector: "พาณิชย์", isSet50: false },
  { symbol: "MOSHI", nameTh: "โมชิ โมชิ รีเทล คอร์ปอเรชั่น", sector: "พาณิชย์", isSet50: false },
  { symbol: "KCE", nameTh: "เคซีอี อีเลคโทรนิคส์", sector: "ชิ้นส่วนอิเล็กทรอนิกส์", isSet50: false },
  { symbol: "HANA", nameTh: "ฮานา ไมโครอิเล็คโทรนิคส", sector: "ชิ้นส่วนอิเล็กทรอนิกส์", isSet50: false },
  { symbol: "KKP", nameTh: "ธนาคารเกียรตินาคินภัทร", sector: "ธนาคาร", isSet50: false },
  { symbol: "TCAP", nameTh: "ทุนธนชาต", sector: "เงินทุนและหลักทรัพย์", isSet50: false },
  { symbol: "AEONTS", nameTh: "อิออน ธนสินทรัพย์", sector: "เงินทุนและหลักทรัพย์", isSet50: false },
  { symbol: "BAM", nameTh: "บริหารสินทรัพย์ กรุงเทพพาณิชย์", sector: "เงินทุนและหลักทรัพย์", isSet50: false },
  { symbol: "JMT", nameTh: "เจ เอ็ม ที เน็ทเวอร์ค เซอร์วิสเซ็ส", sector: "เงินทุนและหลักทรัพย์", isSet50: false },
  { symbol: "JMART", nameTh: "เจมาร์ท กรุ๊ป โฮลดิ้งส์", sector: "เทคโนโลยีสารสนเทศและการสื่อสาร", isSet50: false },
  { symbol: "SPRC", nameTh: "สตาร์ ปิโตรเลียม รีไฟน์นิ่ง", sector: "พลังงานและสาธารณูปโภค", isSet50: false },
  { symbol: "IRPC", nameTh: "ไออาร์พีซี", sector: "พลังงานและสาธารณูปโภค", isSet50: false },
  { symbol: "CKP", nameTh: "ซีเค พาวเวอร์", sector: "พลังงานและสาธารณูปโภค", isSet50: false },
  { symbol: "GUNKUL", nameTh: "กันกุลเอ็นจิเนียริ่ง", sector: "พลังงานและสาธารณูปโภค", isSet50: false },
  { symbol: "EA", nameTh: "พลังงานบริสุทธิ์", sector: "พลังงานและสาธารณูปโภค", isSet50: false },
  { symbol: "ERW", nameTh: "ดิ เอราวัณ กรุ๊ป", sector: "การท่องเที่ยวและสันทนาการ", isSet50: false },
  { symbol: "AAV", nameTh: "เอเชีย เอวิเอชั่น", sector: "ขนส่งและโลจิสติกส์", isSet50: false },
  { symbol: "BA", nameTh: "การบินกรุงเทพ", sector: "ขนส่งและโลจิสติกส์", isSet50: false },
  { symbol: "RCL", nameTh: "อาร์ ซี แอล", sector: "ขนส่งและโลจิสติกส์", isSet50: false },
  { symbol: "PSL", nameTh: "พรีเชียส ชิพปิ้ง", sector: "ขนส่งและโลจิสติกส์", isSet50: false },
  { symbol: "CK", nameTh: "ช.การช่าง", sector: "บริการรับเหมาก่อสร้าง", isSet50: false },
  { symbol: "STECON", nameTh: "สเตคอน กรุ๊ป", sector: "บริการรับเหมาก่อสร้าง", isSet50: false },
  { symbol: "TASCO", nameTh: "ทิปโก้แอสฟัลท์", sector: "วัสดุก่อสร้าง", isSet50: false },
  { symbol: "TOA", nameTh: "ทีโอเอ เพ้นท์ (ประเทศไทย)", sector: "วัสดุก่อสร้าง", isSet50: false },
  { symbol: "PLANB", nameTh: "แพลน บี มีเดีย", sector: "สื่อและสิ่งพิมพ์", isSet50: false },
  { symbol: "VGI", nameTh: "วีจีไอ", sector: "สื่อและสิ่งพิมพ์", isSet50: false },
  { symbol: "MAJOR", nameTh: "เมเจอร์ ซีนีเพล็กซ์ กรุ้ป", sector: "สื่อและสิ่งพิมพ์", isSet50: false },
  { symbol: "SISB", nameTh: "เอสไอเอสบี", sector: "บริการเฉพาะกิจ", isSet50: false },
  { symbol: "BBIK", nameTh: "บลูบิค กรุ๊ป", sector: "เทคโนโลยีสารสนเทศและการสื่อสาร", isSet50: false },
  { symbol: "SKY", nameTh: "สกาย ไอซีที", sector: "เทคโนโลยีสารสนเทศและการสื่อสาร", isSet50: false },
  { symbol: "STA", nameTh: "ศรีตรังแอโกรอินดัสทรี", sector: "ธุรกิจการเกษตร", isSet50: false },
  { symbol: "STGT", nameTh: "ศรีตรังโกลฟส์", sector: "ของใช้ส่วนตัวและเวชภัณฑ์", isSet50: false },
  { symbol: "BLA", nameTh: "กรุงเทพประกันชีวิต", sector: "ประกันภัยและประกันชีวิต", isSet50: false },
];

export const ALL_KNOWN_STOCKS: ThaiStockMeta[] = [...SET50_STOCKS, ...EXTRA_POPULAR_STOCKS];

export const STOCK_META_MAP = new Map<string, ThaiStockMeta>(
  ALL_KNOWN_STOCKS.map((s) => [s.symbol, s])
);

export const SET50_SYMBOLS: string[] = SET50_STOCKS.map((s) => s.symbol);

export function normalizeThaiSymbol(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\.BK$/i, "")
    .replace(/[^A-Z0-9&-]/g, "");
}

export function toYahooSymbol(symbol: string): string {
  const clean = normalizeThaiSymbol(symbol);
  if (clean.startsWith("^")) return clean;
  return `${clean}.BK`;
}

export function getStockMeta(symbol: string): ThaiStockMeta {
  const clean = normalizeThaiSymbol(symbol);
  return (
    STOCK_META_MAP.get(clean) ?? {
      symbol: clean,
      nameTh: clean,
      sector: "ตลาดหลักทรัพย์แห่งประเทศไทย (SET/mai)",
      isSet50: false,
    }
  );
}

export function getDefaultPeers(symbol: string): string[] {
  const clean = normalizeThaiSymbol(symbol);
  const customGroups: Record<string, string[]> = {
    AAI: ["AAI", "ITC", "TU", "CPF", "BTG"],
    ITC: ["ITC", "AAI", "TU", "CPF", "BTG"],
    PTT: ["PTT", "PTTEP", "TOP", "BCP", "OR"],
    PTTEP: ["PTTEP", "PTT", "TOP", "BCP", "BANPU"],
    KBANK: ["KBANK", "SCB", "BBL", "KTB", "TTB"],
    SCB: ["SCB", "KBANK", "BBL", "KTB", "TTB"],
    BBL: ["BBL", "KBANK", "SCB", "KTB", "TISCO"],
    KTB: ["KTB", "BBL", "KBANK", "SCB", "TTB"],
    CPALL: ["CPALL", "CPAXT", "CRC", "BJC", "HMPRO"],
    BDMS: ["BDMS", "BH", "BCH", "CHG", "PR9"],
    BH: ["BH", "BDMS", "BCH", "CHG", "PR9"],
    ADVANC: ["ADVANC", "TRUE", "COM7", "SKY", "BBIK"],
    TRUE: ["TRUE", "ADVANC", "COM7", "JMART", "SKY"],
    DELTA: ["DELTA", "CCET", "KCE", "HANA"],
    AOT: ["AOT", "BEM", "BTS", "MINT", "CENTEL"],
    GULF: ["GULF", "GPSC", "BGRIM", "EGCO", "RATCH"],
    CPN: ["CPN", "AWC", "LH", "SPALI", "AP"],
    MTC: ["MTC", "SAWAD", "TIDLOR", "KTC", "AEONTS"],
  };
  if (customGroups[clean]) return customGroups[clean];

  const meta = getStockMeta(clean);
  const sameSector = ALL_KNOWN_STOCKS.filter(
    (s) => s.sector === meta.sector && s.symbol !== clean
  )
    .slice(0, 4)
    .map((s) => s.symbol);

  return [clean, ...sameSector];
}

// Common English words that look like tickers but aren't Thai stock mentions in prose
const FALSE_POSITIVE_TOKENS = new Set([
  "SET", "MAI", "USD", "THB", "FED", "BOT", "MPC", "GDP", "CPI", "PMI", "IAA",
  "PDF", "API", "AI", "ETF", "IPO", "EPS", "ROE", "ROA", "EMA", "RSI", "MACD",
  "ATR", "BUY", "SELL", "HOLD", "OUTPERFORM", "NEUTRAL", "TOP", "OR", "M", "CK", "LH", "BH", "TU", "EA", "BA", "AP", "QH",
  "USA", "IMF", "OPEC", "WTI", "DXY", "YOY", "QOQ", "MOM", "NEW", "HOT", "LIVE",
  "CEO", "CFO", "ESG", "ESG100", "FTSE", "MSCI", "THAI", "NEWS", "STOCK", "FOCUS",
  "KS", "KSS", "INVX", "FSSIA", "BLS", "MST", "DAOL", "DAOLSEC", "GLOBLEX", "LIB", "CNS", "PI", "YUANTA", "CGSI", "KGI", "ASPS", "TRINITY", "UOBKH", "DBS", "NOMURA", "CLSA", "JPM", "UBS", "MS",
]);

export function extractThaiTickersFromText(text: string): string[] {
  const found = new Set<string>();
  const upper = text.toUpperCase();
  const matches = upper.match(/\b[A-Z]{2,8}\b/g) ?? [];
  for (const token of matches) {
    if (!STOCK_META_MAP.has(token)) continue;
    // Short 2-letter tickers (OR, BH, LH, TU, CK, EA, BA, AP, QH) require context clues or uppercase standalone in Thai text
    if (token.length <= 2 || token === "TOP") {
      // Check if preceded/followed by Thai chars, punctuation, or explicit stock markers
      const explicitRegex = new RegExp(`(?:หุ้น|แนะนำ|เป้า|ซื้อ|ถือ|ขาย|\\(|\\s|^)${token}(?:\\.BK|\\)|\\s|,|/|\\:|\\-|$)`);
      if (explicitRegex.test(upper) && !FALSE_POSITIVE_TOKENS.has(token)) {
        found.add(token);
      } else if (token === "TOP" && /(?:ไทยออยล์|หุ้น\s*TOP|TOP\.BK|\bTOP\b.*(?:เป้า|โรงกลั่น|ซื้อ))/.test(text)) {
        found.add("TOP");
      } else if (token === "OR" && /(?:ปตท\.?\s*น้ำมัน|หุ้น\s*OR|OR\.BK|\bOR\b.*(?:เป้า|ซื้อ|คาเฟ่))/.test(text)) {
        found.add("OR");
      } else if ((token === "BH" || token === "LH" || token === "TU" || token === "CK" || token === "AP" || token === "EA" || token === "BA") && new RegExp(`(?:หุ้น\\s*|\\(|^|\\s)${token}(?:\\)|\\.BK|\\s|$)`).test(text)) {
        // Check original case is truly ALL CAPS (not English word "or", "top", "ba")
        if (new RegExp(`\\b${token}\\b`).test(text)) {
          found.add(token);
        }
      }
      continue;
    }
    if (!FALSE_POSITIVE_TOKENS.has(token)) {
      found.add(token);
    }
  }
  return Array.from(found);
}

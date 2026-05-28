// Regulatory content filters for AI coaching card outputs.
// Complies with: insurance regulatory requirements, IUL/FINRA-adjacent guardrails.

export interface FilterResult {
  content: string;
  isRegulatoryFlag: boolean;
  flagType: "regulatory" | "iul_language" | null;
  originalContent: string;
}

// ─── Regulatory patterns ──────────────────────────────────────────────────────

// Specific product recommendation language
const PRODUCT_RECOMMENDATION_PATTERNS: RegExp[] = [
  /\bi\s+recommend\b/i,
  /\byou\s+should\s+buy\b/i,
  /\bbest\s+option\s+(for\s+you|is)\b/i,
  /\bperfect\s+(plan|policy|product|coverage)\s+(for\s+you|is)\b/i,
  /\bgo\s+with\s+the\b/i,
  /\bpurchase\s+the\b/i,
  /\bsign\s+up\s+for\b/i,
];

// Dollar amounts with insurance context (coverage, premium, benefit amounts)
const DOLLAR_AMOUNT_PATTERN =
  /\$[\d,]+(?:\.\d{2})?\s*(?:per\s+month|\/mo(?:nth)?|monthly|annually|\/year|\/yr|per\s+year|a\s+month|a\s+year)?\s*(?:in\s+coverage|of\s+coverage|face\s+(?:value|amount)|death\s+benefit|benefit|premium)?/gi;

// Coverage and benefit amount framing
const COVERAGE_AMOUNT_PATTERNS: RegExp[] = [
  /\b\d{3,}[,\d]*\s*(?:thousand|million|k|M)?\s*(?:dollars?\s+)?(?:of\s+|in\s+)?(?:coverage|benefit|protection|face\s+(?:value|amount)|death\s+benefit)\b/i,
  /\b(?:coverage|benefit|face\s+(?:value|amount)|death\s+benefit)\s+(?:of\s+)?\$?[\d,]+/i,
];

// ─── IUL / FINRA-adjacent patterns ───────────────────────────────────────────

const IUL_INVESTMENT_LANGUAGE_PATTERNS: RegExp[] = [
  /\binvestment\s+returns?\b/i,
  /\bmarket\s+performance\b/i,
  /\bguaranteed\s+(?:growth|returns?)\b/i,
  /\bportfolio\s+(?:growth|returns?|performance)\b/i,
  /\bROI\b/,
  /\breturn\s+on\s+investment\b/i,
  /\bmarket[- ]linked\b/i,
  /\bindexed\s+returns?\b/i,
  /\binvestment[- ]grade\b/i,
  /\bequity\s+(?:growth|returns?|linked)\b/i,
  /\bmarket\s+(?:gains?|growth|upside)\b/i,
  // Tightened: only flag "securities" in investment context, not general "security"
  /\bsecurities\b/i,
  /\bfinancial\s+securities?\b/i,
  // Tightened: only flag "assets" in investment portfolio context
  /\binvestment\s+assets?\b/i,
  /\bmanage(?:d)?\s+assets?\b/i,
];

// ─── Replacement messages ─────────────────────────────────────────────────────

const REGULATORY_REPLACEMENT =
  "Focus on understanding the prospect's situation — avoid product specifics until qualification is complete.";

const IUL_REPLACEMENT =
  "Stick to protection framing — avoid investment language for IUL products to stay within insurance regulatory guidelines.";

// ─── Filter functions ─────────────────────────────────────────────────────────

function hasMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Applies regulatory and IUL content filters to a coaching card's text.
 * Returns the (possibly replaced) content and flagging metadata.
 */
export function filterCoachingCard(content: string): FilterResult {
  const original = content;

  // Check IUL language first (more specific, higher priority)
  if (hasMatch(content, IUL_INVESTMENT_LANGUAGE_PATTERNS)) {
    return {
      content: IUL_REPLACEMENT,
      isRegulatoryFlag: true,
      flagType: "iul_language",
      originalContent: original,
    };
  }

  // Check product recommendation patterns
  const hasProductRec = hasMatch(content, PRODUCT_RECOMMENDATION_PATTERNS);
  const hasDollarAmount = DOLLAR_AMOUNT_PATTERN.test(content);
  const hasCoverageAmount = hasMatch(content, COVERAGE_AMOUNT_PATTERNS);

  if (hasProductRec || hasDollarAmount || hasCoverageAmount) {
    return {
      content: REGULATORY_REPLACEMENT,
      isRegulatoryFlag: true,
      flagType: "regulatory",
      originalContent: original,
    };
  }

  return {
    content,
    isRegulatoryFlag: false,
    flagType: null,
    originalContent: original,
  };
}

/**
 * Filters an array of coaching suggestions (strings) from the AI report.
 * Returns filtered items and a log of any flagged events.
 */
export function filterCoachingItems(items: string[]): {
  filtered: string[];
  flagged: Array<{ original: string; replaced: string; flagType: "regulatory" | "iul_language" }>;
} {
  const flagged: Array<{ original: string; replaced: string; flagType: "regulatory" | "iul_language" }> = [];
  const filtered = items.map((item) => {
    const result = filterCoachingCard(item);
    if (result.isRegulatoryFlag && result.flagType) {
      flagged.push({ original: item, replaced: result.content, flagType: result.flagType });
    }
    return result.content;
  });
  return { filtered, flagged };
}

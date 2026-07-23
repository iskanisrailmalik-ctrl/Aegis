/**
 * Auto-categorization engine.
 * Maps merchant/sender names to spending categories using keyword rules.
 * Categories are user-editable; corrections feed back into this map over time.
 */

export type CategoryKey =
  | "food"
  | "shopping"
  | "bills"
  | "entertainment"
  | "transport"
  | "health"
  | "travel"
  | "salary"
  | "transfer"
  | "emi"
  | "investment"
  | "other";

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  // Tailwind classes for badge coloring
  badge: string;
  // dot / icon color
  color: string;
  // hex for charts
  hex: string;
  // lucide icon name (rendered by a small map in the UI)
  icon: string;
}

export const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  food: {
    key: "food",
    label: "Food & Dining",
    badge: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    color: "text-orange-600 dark:text-orange-400",
    hex: "#f97316",
    icon: "UtensilsCrossed",
  },
  shopping: {
    key: "shopping",
    label: "Shopping",
    badge: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    color: "text-violet-600 dark:text-violet-400",
    hex: "#8b5cf6",
    icon: "ShoppingBag",
  },
  bills: {
    key: "bills",
    label: "Bills & Utilities",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    color: "text-amber-600 dark:text-amber-400",
    hex: "#f59e0b",
    icon: "ReceiptText",
  },
  entertainment: {
    key: "entertainment",
    label: "Entertainment",
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    color: "text-rose-600 dark:text-rose-400",
    hex: "#f43f5e",
    icon: "Clapperboard",
  },
  transport: {
    key: "transport",
    label: "Transport",
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    color: "text-sky-600 dark:text-sky-400",
    hex: "#0ea5e9",
    icon: "Car",
  },
  health: {
    key: "health",
    label: "Health",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    color: "text-emerald-600 dark:text-emerald-400",
    hex: "#10b981",
    icon: "HeartPulse",
  },
  travel: {
    key: "travel",
    label: "Travel",
    badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    color: "text-cyan-600 dark:text-cyan-400",
    hex: "#06b6d4",
    icon: "Plane",
  },
  salary: {
    key: "salary",
    label: "Salary & Income",
    badge: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
    color: "text-emerald-600 dark:text-emerald-400",
    hex: "#059669",
    icon: "Banknote",
  },
  transfer: {
    key: "transfer",
    label: "Transfer",
    badge: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    color: "text-slate-600 dark:text-slate-400",
    hex: "#64748b",
    icon: "ArrowLeftRight",
  },
  emi: {
    key: "emi",
    label: "EMI / Loan",
    badge: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    color: "text-red-600 dark:text-red-400",
    hex: "#ef4444",
    icon: "Landmark",
  },
  investment: {
    key: "investment",
    label: "Investment",
    badge: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    color: "text-teal-600 dark:text-teal-400",
    hex: "#14b8a6",
    icon: "TrendingUp",
  },
  other: {
    key: "other",
    label: "Other",
    badge: "border-muted-foreground/30 bg-muted text-muted-foreground",
    color: "text-muted-foreground",
    hex: "#94a3b8",
    icon: "CircleDashed",
  },
};

interface CategoryRule {
  category: CategoryKey;
  // case-insensitive keyword tests against merchant + bank + sender
  keywords: string[];
  // applies only to this tx type (optional)
  type?: "credit" | "debit";
}

const RULES: CategoryRule[] = [
  // Food & Dining
  { category: "food", keywords: ["swiggy", "zomato", "dominos", "mcdonald", "kfc", "pizza", "chai", "restaurant", "food", "bigbasket", "grocery", "blinkit", "zepto", "instamart", "dineout", "barbeque", "haldiram", "biryani", "cafe", "coffee", "starbucks"] },
  // Shopping
  { category: "shopping", keywords: ["amazon", "flipkart", "myntra", "ajio", "snapdeal", "meesho", "nykaa", "reliance", "tatacliq", "shop", "store", "mall", "bigbazaar", "lifestyle", "pantaloons", "westside", "decathlon", "ikea"] },
  // Bills & Utilities
  { category: "bills", keywords: ["bescom", "electricity", "water", "gas", "broadband", "airtel", "jio", "vodafone", "vi ", "bsnl", "recharge", "dth", "tatasky", " broadband", "act corp", "act fibernet", "mobile", "postpaid", "mseb", "tpc", "tata power"] },
  // Entertainment
  { category: "entertainment", keywords: ["netflix", "prime", "hotstar", "disney", "spotify", "youtube", "bookmyshow", "pvr", "inox", "movie", "music", "gaming", "steam", "xbox", "playstation", "sonyliv", "zee5", "eros"] },
  // Transport
  { category: "transport", keywords: ["uber", "ola", "rapido", "metro", "irctc", "redbus", "abhibus", "petrol", "fuel", "bp ", "hp ", "indian oil", "shell", "toll", "fastag", "parking", "yulu", "bike", "taxi", "cab"] },
  // Health
  { category: "health", keywords: ["pharma", "medical", "hospital", "clinic", "apollo", "medplus", "1mg", "pharmeasy", "netmeds", "doctor", "lab", "diagnostic", "health", "gym", "cult", "fitso"] },
  // Travel
  { category: "travel", keywords: ["makemytrip", "mmt", "goibibo", "cleartrip", "yatra", "irctc", "indigo", "spicejet", "vistara", "airindia", "oyo", "booking", "agoda", "airbnb", "hotel", "flight"] },
  // Salary & Income
  { category: "salary", type: "credit", keywords: ["salary", "payroll", "wages", "stipend"] },
  // Transfer
  { category: "transfer", keywords: ["neft", "rtgs", "imps", "upi", "zelle", "transfer", "self", "from ", "to self"] },
  // EMI / Loan
  { category: "emi", keywords: ["bajaj", "hdb", "home credit", "tata capital", "emi", "loan", "nbfc", "lender"] },
  // Investment
  { category: "investment", keywords: ["mutual fund", "sip", "zerodha", "groww", "upstox", "nse", "bse", "demat", "ppf", "rd ", "fd ", "investment", "nps", "stocks"] },
];

/**
 * Determine category for a transaction.
 * @param merchant extracted merchant name
 * @param bank bank name
 * @param sender sender header
 * @param type credit/debit
 * @param isEmi whether this is an EMI transaction
 */
export function categorize(params: {
  merchant?: string | null;
  bank?: string | null;
  sender?: string | null;
  type?: string | null;
  isEmi?: boolean;
}): CategoryKey {
  const { merchant, bank, sender, type, isEmi } = params;

  if (isEmi) return "emi";

  const haystack = [merchant, bank, sender]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack) return "other";

  // check salary first (credit only)
  if (type === "credit") {
    if (/\bsalary\b|payroll|wages|stipend/.test(haystack)) return "salary";
  }

  for (const rule of RULES) {
    if (rule.type && rule.type !== type) continue;
    for (const kw of rule.keywords) {
      if (haystack.includes(kw)) return rule.category;
    }
  }

  return "other";
}

/**
 * Async categorization that consults user-saved merchant overrides first.
 * Falls back to the keyword-rule-based categorize() if no override exists.
 */
export async function categorizeWithOverrides(params: {
  merchant?: string | null;
  bank?: string | null;
  sender?: string | null;
  type?: string | null;
  isEmi?: boolean;
}): Promise<CategoryKey> {
  const { merchant, isEmi } = params;

  // EMI always wins
  if (isEmi) return "emi";

  // Check user overrides first (feedback loop)
  if (merchant) {
    try {
      const { db } = await import("@/lib/db");
      const normalized = merchant.trim().toUpperCase();
      const override = await db.merchantOverride.findUnique({
        where: { merchant: normalized },
      });
      if (override) {
        return override.category as CategoryKey;
      }
    } catch {
      // DB not available (e.g., during seed) — fall through to rules
    }
  }

  return categorize(params);
}

/**
 * Save or update a merchant → category override (feedback loop).
 * Called when a user manually edits a transaction's category.
 */
export async function saveMerchantOverride(
  merchant: string,
  category: string
): Promise<void> {
  const normalized = merchant.trim().toUpperCase();
  if (!normalized) return;
  const { db } = await import("@/lib/db");
  await db.merchantOverride.upsert({
    where: { merchant: normalized },
    update: { category },
    create: { merchant: normalized, category },
  });
}

/**
 * Apply saved overrides to all existing transactions with matching merchants.
 * Returns the count of transactions updated.
 */
export async function applyOverridesToExisting(): Promise<number> {
  const { db } = await import("@/lib/db");
  const overrides = await db.merchantOverride.findMany();
  if (overrides.length === 0) return 0;

  const overrideMap = new Map(overrides.map((o) => [o.merchant, o.category]));
  const txs = await db.transaction.findMany();
  let updated = 0;

  for (const tx of txs) {
    if (!tx.merchant) continue;
    const normalized = tx.merchant.trim().toUpperCase();
    const newCat = overrideMap.get(normalized);
    if (newCat && newCat !== tx.category) {
      await db.transaction.update({
        where: { id: tx.id },
        data: { category: newCat },
      });
      updated++;
    }
  }

  return updated;
}

export function formatINR(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(val);
}

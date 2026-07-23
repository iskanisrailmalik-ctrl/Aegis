/**
 * Sample SMS messages — used by /api/seed to populate demo data.
 * Covers: verified transactions, EMI, flagged scams, unverified promos.
 * Dates are generated relative to "now" so they appear in day/week/month filters.
 */

export interface SampleSms {
  sender: string;
  text: string;
  receivedAt?: string;
}

function daysAgo(n: number): { dateStr: string; iso: string } {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const yr = String(d.getFullYear()).slice(-2);
  const dateStr = `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${yr}`;
  return { dateStr, iso: d.toISOString() };
}

export const SAMPLE_SMS: SampleSms[] = [
  // --- Verified bank transactions (recent) ---
  {
    sender: "SBIINB",
    text: () => {
      const d = daysAgo(0);
      return `Rs 1,250.00 debited from A/c XX1234 on ${d.dateStr} via UPI to AMAZON PAY. Avl Bal Rs 24,530.50-SBI`;
    },
    receivedAt: () => daysAgo(0).iso,
  },
  {
    sender: "HDFCBK",
    text: () => {
      const d = daysAgo(1);
      return `Rs 45,000.00 credited to A/c XX5678 from NEFT-SALARIES on ${d.dateStr}. Avl Bal Rs 1,12,450.00-HDFC`;
    },
    receivedAt: () => daysAgo(1).iso,
  },
  {
    sender: "ICICIB",
    text: () => {
      const d = daysAgo(2);
      return `Rs 299.00 debited from A/c XX9012 at NETFLIX SUBSCRIPTION on ${d.dateStr}. Avl Bal Rs 8,210.00-ICICI`;
    },
    receivedAt: () => daysAgo(2).iso,
  },
  {
    sender: "AXISBK",
    text: () => {
      const d = daysAgo(3);
      return `Rs 750.00 debited from A/c XX3456 to SWIGGY BANGALORE on ${d.dateStr} via UPI. Avl Bal Rs 15,800.00`;
    },
    receivedAt: () => daysAgo(3).iso,
  },
  {
    sender: "KOTAKB",
    text: () => {
      const d = daysAgo(4);
      return `Rs 2,500.00 credited to A/c XX7890 from ZELLE TRANSFER on ${d.dateStr}. Avl Bal Rs 47,300.00`;
    },
    receivedAt: () => daysAgo(4).iso,
  },
  {
    sender: "HDFCBK",
    text: () => {
      const d = daysAgo(5);
      return `Rs 1,499.00 debited from A/c XX5678 to BIGBASKET GROCERY on ${d.dateStr}. Avl Bal Rs 1,10,951.00-HDFC`;
    },
    receivedAt: () => daysAgo(5).iso,
  },

  // --- Wallet/UPI transactions ---
  {
    sender: "PHONPE",
    text: "Rs 520.00 paid to BESCOM ELECTRICITY via PhonePe. Txn ID: N8X2P9. Ref: 77881234",
    receivedAt: () => daysAgo(0).iso,
  },
  {
    sender: "PAYTMB",
    text: () => {
      const d = daysAgo(6);
      return `Rs 1,999.00 paid to FLIPKART via Paytm UPI. Txn ID: PYTM9981234. on ${d.dateStr}`;
    },
    receivedAt: () => daysAgo(6).iso,
  },
  {
    sender: "GPAY",
    text: () => {
      const d = daysAgo(7);
      return `Rs 150.00 paid to CHAI POINT via Google Pay UPI. UPI Ref: 123456789. on ${d.dateStr}`;
    },
    receivedAt: () => daysAgo(7).iso,
  },

  // --- Credit card ---
  {
    sender: "HDFCCRD",
    text: () => {
      const d = daysAgo(8);
      return `Rs 3,499.00 spent on Card ending 4321 at MAKEMYTRIP on ${d.dateStr}. Avl Cr Limit Rs 86,500.00`;
    },
    receivedAt: () => daysAgo(8).iso,
  },

  // --- EMI / Loans (NBFC) ---
  {
    sender: "BAJAJFINSERV",
    text: () => {
      const d = daysAgo(2);
      return `EMI of Rs 8,500.00 due on ${d.dateStr} for Loan A/c LNSB9981234. Please keep sufficient balance-Bajaj Finserv`;
    },
    receivedAt: () => daysAgo(2).iso,
  },
  {
    sender: "HDBFS",
    text: () => {
      const d = daysAgo(10);
      return `EMI of Rs 5,200.00 due on ${d.dateStr} for Loan No HDB4521. Paid-HDB Financial`;
    },
    receivedAt: () => daysAgo(10).iso,
  },
  {
    sender: "HCIN",
    text: () => {
      const d = daysAgo(12);
      return `EMI of Rs 3,150.00 debited for Loan ID HCIN2024 on ${d.dateStr}. Next due 03-Dec-24-Home Credit`;
    },
    receivedAt: () => daysAgo(12).iso,
  },

  // --- Recurring subscriptions (for recurring-payment detection) ---
  // Netflix monthly — 3 occurrences to establish a monthly pattern
  {
    sender: "ICICIB",
    text: () => {
      const d = daysAgo(33);
      return `Rs 299.00 debited from A/c XX9012 at NETFLIX SUBSCRIPTION on ${d.dateStr}. Avl Bal Rs 8,509.00-ICICI`;
    },
    receivedAt: () => daysAgo(33).iso,
  },
  {
    sender: "ICICIB",
    text: () => {
      const d = daysAgo(63);
      return `Rs 299.00 debited from A/c XX9012 at NETFLIX SUBSCRIPTION on ${d.dateStr}. Avl Bal Rs 8,808.00-ICICI`;
    },
    receivedAt: () => daysAgo(63).iso,
  },
  // Spotify monthly — 2 occurrences
  {
    sender: "AXISBK",
    text: () => {
      const d = daysAgo(5);
      return `Rs 119.00 debited from A/c XX3456 to SPOTIFY PREMIUM on ${d.dateStr} via UPI. Avl Bal Rs 15,681.00`;
    },
    receivedAt: () => daysAgo(5).iso,
  },
  {
    sender: "AXISBK",
    text: () => {
      const d = daysAgo(35);
      return `Rs 119.00 debited from A/c XX3456 to SPOTIFY PREMIUM on ${d.dateStr} via UPI. Avl Bal Rs 16,800.00`;
    },
    receivedAt: () => daysAgo(35).iso,
  },
  // Swiggy weekly-ish — 2 occurrences
  {
    sender: "AXISBK",
    text: () => {
      const d = daysAgo(10);
      return `Rs 450.00 debited from A/c XX3456 to SWIGGY BANGALORE on ${d.dateStr} via UPI. Avl Bal Rs 16,250.00`;
    },
    receivedAt: () => daysAgo(10).iso,
  },
  // Salary credit recurring — 2 occurrences
  {
    sender: "HDFCBK",
    text: () => {
      const d = daysAgo(31);
      return `Rs 45,000.00 credited to A/c XX5678 from NEFT-SALARIES on ${d.dateStr}. Avl Bal Rs 67,450.00-HDFC`;
    },
    receivedAt: () => daysAgo(31).iso,
  },

  // --- Unverified / promotional (legit sender, not a transaction) ---
  {
    sender: "HDFCBK",
    text: "Get pre-approved Personal Loan up to Rs 15,00,000 at attractive rates. Apply now on HDFC NetBanking. Reply STOP to unsubscribe.",
    receivedAt: () => daysAgo(9).iso,
  },

  // --- Flagged scams ---
  {
    sender: "+919876543210",
    text: "Dear Customer, your SBI account will be blocked today. Update your KYC immediately. Click here: http://bit.ly/sbi-kyc-update",
    receivedAt: () => daysAgo(1).iso,
  },
  {
    sender: "+917012345678",
    text: "Congratulations! You have won Rs 5,00,000 in KBC Lottery 2024. To claim your prize call now on +917012345678 and share your OTP.",
    receivedAt: () => daysAgo(4).iso,
  },
  {
    sender: "UNKNOWN",
    text: "Your HDFC ATM card is blocked. Call 1800-XXX-XXXX or click http://t.me/hdfcsecure to reactivate. Share your CVV to verify.",
    receivedAt: () => daysAgo(5).iso,
  },
  {
    sender: "+919812345670",
    text: "URGENT: KYC expire today. Your account will be suspended. Click http://bit.ly/verify-kyc-now to update.",
    receivedAt: () => daysAgo(11).iso,
  },
].map((s) => ({
  sender: s.sender,
  text: typeof s.text === "function" ? (s.text as () => string)() : (s.text as string),
  receivedAt: typeof s.receivedAt === "function" ? (s.receivedAt as () => string)() : s.receivedAt,
}));

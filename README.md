# Aegis — Offline SMS Financial Intelligence & Document Management Platform

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-6.1-2D3748?style=for-the-badge&logo=prisma)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)
![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?style=for-the-badge&logo=sqlite)
![Privacy](https://img.shields.io/badge/Privacy-100%25_Offline-success?style=for-the-badge)

**Aegis** is an offline-first, privacy-preserving financial management, document parsing, and SMS intelligence application tailored for Indian financial ecosystems. Built with Next.js 16 (App Router & Turbopack), Prisma ORM (SQLite in WAL mode), TypeScript, Tailwind CSS, and Shadcn UI.

---

## 🔒 100% Offline & Privacy Guarantee

- **Zero Cloud API Dependencies**: All SMS parsing, PDF vector decoding, scam classification, candidate staging, and natural-language Q&A run **100% locally on your machine**.
- **No Third-Party Network Requests**: No data, transactions, or document content ever leave your host device.
- **On-Device Encrypted Vault**: Bank statements and financial PDFs are stored in an encrypted document vault using Web Crypto AES-GCM standards.

---

## 🌟 Key Features

### 1. SMS Parsing & Scam Classification Engine
- **Bank-Agnostic Regex Engine**: Parses transactions across 25+ Indian banks (HDFC, ICICI, SBI, Axis, Kotak, PNB), payment apps (UPI, Paytm, PhonePe, CRED), and NBFCs.
- **3-Tier Fraud & Spam Filter**: Categorizes messages into *Verified*, *Unverified*, and *Flagged (Scam/Phishing)* using heuristic signal detection.

### 2. PDF Bank Statement & Document Vault Engine
- **Spatial PDF Vector Decoding**: Preserves column layout structure (`Date`, `Narration`, `Chq/Ref No`, `Withdrawal`, `Deposit`, `Balance`) via `pdfjs-dist`.
- **Bank-Agnostic Structural Metadata Filtering**: Automatically strips multi-page repeated header lines, customer address blocks, and closing summary tables without hardcoded labels.
- **Balance-Delta Credit/Debit Classifier**: Derives transaction types directly from consecutive row balance deltas ($\Delta = \text{Balance}_t - \text{Balance}_{t-1}$), handling non-keyword narrations (`PAYMENT FROM PHONE`).

### 3. Staging Table & Import Review Gate
- **Zero-Auto-Commit Safety**: All extracted document rows are staged into an intermediate `ExtractedDataCandidate` table with `needsReview` status.
- **Interactive Review UI (`ImportReviewDialog`)**: Visual review dialog allowing users to confirm, reassign target components, or ignore individual candidate items before committing to live financial tables.
- **Atomic Database Commits**: Multi-table writes run inside atomic Prisma `$transaction` blocks with `@unique` `idempotencyKey` protection against duplicate retries.

### 4. Natural Language Q&A & Search Engine
- **On-Device Hybrid RAG**: Answers natural language financial questions (*"How much did I spend on food this month?"*, *"Show my EMI schedule"*) using deterministic TF-IDF indexing and structured SQL aggregation routing.

### 5. Autonomous Background Orchestration
- **In-Process Job Worker**: Automatically schedules background statement reconciliation passes, retries failed document extractions with exponential backoff, and tracks system health metrics (`SystemHealthLog`).

### 6. Loan, EMI & Budget Management
- **Loan & EMI Obligation Tracker**: Auto-detects EMI debits, tracks loan principal, interest rates, tenure, overdue payments, and generates repayment schedules.
- **Category Budgets**: Monitor spending limits with real-time visual progress indicators.

---

## 🏗️ Architecture Overview

```
Client UI (React 19 SPA)
   └── API Layer (Next.js Node.js Handlers)
        ├── SMS & Document Parsing Engines (parser.ts, documents.ts, field-detector.ts)
        ├── Hybrid RAG & Search Engine (intelligence.ts, embeddings.ts)
        ├── Autonomous Background Worker (autonomous-worker.ts)
        └── Local Persistence (SQLite custom.db via Prisma ORM)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm** or **bun**

### Environment Setup

Create a `.env` file in the root directory:

```env
DATABASE_URL="file:./db/custom.db"
```

### Installation Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/aegis.git
   cd aegis
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Database Initialization**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Build for Production**
   ```bash
   npm run build
   npm run start
   ```

---

## 🧪 Testing & Verification

Run TypeScript compilation checks and production builds:

```bash
# Run TypeScript compilation check
npx tsc --noEmit

# Run full Next.js production build
npm run build
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

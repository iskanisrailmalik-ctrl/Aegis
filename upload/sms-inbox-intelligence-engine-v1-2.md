# SMS Inbox & Intelligence Engine — Design Spec
### Version 1.3

*Standalone spec covering: SMS Inbox, SMS Preview, Intelligence Engine, Reports, fully offline RAG logic, the humanized voice engine, and document ingestion/reconciliation. This is separate from the main app plan and focuses only on this subsystem.*

---

## 1. Scope

This subsystem is responsible for:
1. Storing every ingested SMS (not just parsed transactions)
2. Letting the user browse/search/preview raw SMS inside the app
3. Generating both structured reports and natural-language answers about the user's SMS/financial data
4. Doing all of the above **fully offline** — RAG runs entirely on-device, with no cloud/online mode
5. Optionally ingesting user-uploaded documents (loan agreements, EMI schedules, bank statements) to enrich and reconcile SMS-derived data — see Section 8

It assumes the core Transaction/LoanAccount/FlaggedMessage parsing pipeline from the main app plan already exists and feeds into this subsystem.

---

## 2. Data Model

```
SmsMessage {
  id,
  rawText,
  sender,
  senderType,        // 'bank' | 'paymentsBank' | 'nbfc' | 'wallet' | 'creditCard' | 'unknown' | 'other'
  receivedAt,
  language,
  classification,     // 'verified' | 'unverified' | 'flagged' | 'unparsed'
  linkedRecordType,    // 'transaction' | 'loan' | 'flaggedMessage' | null
  linkedRecordId,
  embeddingVector      // generated on-device, for RAG retrieval (see Section 5)
}
```

Every SMS ingested by the app — parsed or not, transaction or not — gets a row here. This is the single source of truth the Inbox, Reports, and RAG engine all read from.

---

## 3. SMS Inbox & Preview

**Purpose:** give the user a transparent, searchable view of everything the app has read — this is what makes the "we don't hide anything, we don't upload anything" promise concrete and verifiable to the user, not just a claim in a privacy policy.

**Inbox list view:**
- Reverse-chronological, grouped by day
- Each row: sender name/short code, sender-type icon, first line preview, classification badge (✅/⚠️/🚫/unparsed)
- Filters: by sender, by date range, by classification, by linked-record type (transactions only / loans only / flagged only / unlinked)
- Search: full-text search across `rawText` and `sender`, entirely local (SQLite FTS5 / IndexedDB with a simple inverted index — no external search service needed)

**SMS Preview (detail view):**
- Full raw message text, exactly as received
- Sender info: short code/number, sender type, and (if flagged) the legitimacy-check result
- Linked record card if parsed (tap through to the Transaction/Loan/FlaggedMessage detail)
- "This wasn't parsed correctly" action → manual correction flow, which also becomes training signal for the Rule Registry
- Never editable in place — the raw SMS is immutable; only the *interpretation* (linked record) is editable, so the source of truth is always preserved

---

## 4. Intelligence Engine — Two Tiers

### Tier 1: Structured Reports (no LLM, no RAG)
Pure aggregation over already-parsed, already-classified data. This is the default, always-available reporting layer.

Examples:
- Spending by category (pie/bar chart), by period
- Credited vs debited trend over time (line chart)
- Top merchants by spend
- EMI summary: upcoming, overdue, total monthly obligation
- Security summary: number of flagged messages this month, by scam-pattern type

All computed on-device, instantly, from the existing `Transaction`/`LoanAccount`/`FlaggedMessage` tables. No dependency on Tier 2.

### Tier 2: Natural-Language Q&A (RAG-powered)
For open-ended questions that don't map to a pre-built report:
- "How much did I spend on food delivery last month?"
- "Show me anything unusual in my spending this week"
- "Which of my EMIs is the most expensive?"
- "Summarize the SMS from my landlord's bank"

This is where RAG logic (Section 5) comes in — retrieving relevant `SmsMessage`/`Transaction` records and generating a grounded answer.

**Every Tier 2 answer must:**
- Show which underlying messages/transactions it drew from (tap-through list, not just a paragraph)
- Fall back gracefully to "I couldn't find enough information for that" rather than fabricating an answer when retrieval comes back empty or low-confidence

---

## 5. RAG Logic

### 5.1 Why RAG, and why fully on-device
Regex-based parsing extracts *structured fields* reliably, but can't answer flexible, open-ended questions — that needs retrieval + generation. RAG lets the app ground its answers in the user's actual SMS instead of a language model guessing from general knowledge, which matters enormously for a finance app where a wrong number is a real problem, not just an annoyance.

Doing this entirely on-device keeps the core privacy promise absolute — financial SMS content never leaves the device, with no online mode to reason about or explain to users.

### 5.2 Indexing pipeline
1. On ingestion (or in a background batch job), each `SmsMessage` gets an embedding vector from a small on-device embedding model
2. Embeddings stored alongside the message (`embeddingVector` field)
3. Given realistic SMS volume (a few thousand messages/year for a typical user), a full local vector index isn't necessary — brute-force cosine similarity over all embeddings is fast enough on-device; a lightweight local vector index (e.g. `sqlite-vss` or a simple in-memory index rebuilt at startup) can be added later if volume grows

### 5.3 Retrieval + generation
1. User's natural-language question is embedded with the same model
2. Top-N most similar `SmsMessage`/`Transaction` records retrieved (cosine similarity)
3. Retrieved records + the question are passed to a small on-device LLM (quantized, roughly 0.5-2GB depending on device capability) to generate a grounded natural-language answer
4. Answer is returned with the source records attached for the explainability/tap-through requirement in Section 4

### 5.4 Model choices (on-device)
- **Embedding model**: a small sentence-embedding model (e.g. a distilled multilingual sentence-transformer, quantized) — needs multilingual support given the app's Indian-language scope
- **Generation model**: a small quantized instruction-tuned LLM suitable for mobile (e.g. in the 1-3B parameter range, quantized to 4-bit) run via an on-device inference runtime (e.g. `llama.cpp`, MLC-LLM, or ONNX Runtime Mobile)
- Both models bundled with the app or downloaded once on first use (still offline after that), not called over the network per-query

### 5.5 Maximizing offline intelligence quality
Since this is now offline-only, quality has to come from smart design rather than a bigger cloud model:
- **Device-tiered model selection**: ship two local model sizes (e.g. a leaner ~0.5B and a fuller ~2-3B variant) and pick automatically based on device RAM/chipset, so higher-end phones get noticeably better reasoning without penalizing budget devices
- **Hybrid retrieval, not pure semantic search**: combine keyword/structured filtering (date range, sender type, amount range parsed from the question itself) with embedding similarity — this narrows the candidate set before the LLM sees it, which improves answer quality far more than a bigger model would on its own
- **Pre-aggregation for common question shapes**: route obviously-structured questions ("how much did I spend on X last month") to Tier 1 aggregation logic instead of the LLM entirely — reserve generation for genuinely open-ended questions, which keeps the model's job narrow and its answers more reliable
- **Domain-tuned generation model**: fine-tune (or use a community fine-tune of) the small local LLM specifically on financial-summarization-style tasks rather than using a general-purpose chat model as-is — a narrow, well-tuned small model consistently outperforms a generic one of the same size
- **Periodic model updates via app updates**: since there's no server call per query, model quality still improves over time by shipping better quantized weights in app updates, independent of network availability at query time
- **Multilingual embedding priority**: since regional-language quality is the biggest real gap versus a cloud model, prioritize an embedding model with strong Indian-language support even if the generation model itself is English-primary — retrieval accuracy matters more than generation fluency for grounding correctness

### 5.6 Confidence & failure handling
- If retrieval returns no sufficiently relevant messages, the engine says so rather than generating a vague or fabricated answer
- Low-confidence answers are visually marked (e.g. "This answer is based on limited matching data")
- Every generated answer is a *reflection of the user's own data*, never externally sourced facts — the model's role here is summarization/reasoning over retrieved SMS, not general knowledge lookup

---

## 6. Voice Engine — Humanized TTS

Default platform TTS (Android's built-in engine, iOS `AVSpeechSynthesizer`) sounds robotic because it's older formant/concatenative synthesis. This subsystem needs a better default, since both transaction announcements and any spoken Tier 2 report answers (Section 8) run through the same voice pipeline.

**Approach — layered, best-quality-available:**

1. **Primary: bundled neural on-device TTS.** Ship a small neural TTS engine such as **Piper** or **Coqui TTS** (VITS-based) as the default voice. These produce genuinely natural speech, run fully offline, and are small enough to bundle per-language (~20-100MB per voice). Piper in particular is built for embedded/offline apps and has growing Indian-language voice coverage — a strong fit given the multilingual requirement.
2. **Secondary: platform "enhanced/neural" voices.** Where a bundled neural voice isn't available for a given language, fall back to the OS's own higher-quality neural voice packs (Android's enhanced TTS, iOS's premium voices) — still offline once downloaded, no bundling cost, but quality/coverage isn't fully in the app's control.
3. **Tertiary: standard platform TTS.** Final fallback on low-end devices or unsupported languages, so voice output never fails outright — just degrades gracefully.
4. **Optional: concatenative human-recorded phrases.** For the most common fixed vocabulary (numbers, "rupees", "debited", "credited", "received from", major bank names), record a real voice actor once and stitch clips at runtime. Most natural of all options since it's real human audio, but only covers pre-recorded phrases — anything outside that vocabulary (an unusual merchant name) needs to fall back to neural/platform TTS mid-sentence, so this is best used as a polish layer over option 1, not a replacement for it.

**Selection logic:** at first launch (or per-language), the app checks which tier is available/fits the device (RAM, storage, language support) and picks automatically — user never has to manually configure this, though a "voice quality" setting could expose it for power users who want to force platform TTS to save storage.

**Where this plugs in:**
- Transaction announcements (main plan, Section 12 Multi-Language Support) — the Sentence Builder's language-aware templates feed straight into this voice engine
- **Spoken Tier 2 report answers** — natural extension: once a RAG-generated answer is produced (Section 5), the same voice engine can read it aloud on request, so "ask a question" can be a fully voice-in/voice-out experience, not just text

---

## 7. Reports UI

- **Reports home**: Tier 1 structured charts front and center (fast, reliable, always available)
- **Ask a question** entry point (search-bar style) for Tier 2 natural-language queries
- Answers rendered as: short generated text + a "Based on N messages" expandable source list + (where relevant) an auto-generated mini chart if the question implies one (e.g. spend-over-time questions get a small trend chart alongside the text answer)
- Every answer is unambiguously on-device — no mode-switching UI needed since there's only one mode
- Report history: past questions and answers saved locally so users can revisit them without re-asking

---

## 8. Document Ingestion & Reconciliation

**Purpose:** SMS alone can't give the app the full picture — a loan agreement has the complete EMI schedule, tenure, and interest rate upfront; a bank statement is the ground truth for what actually happened in an account. This is a structured **extraction + reconciliation** layer, not model training — extracted document data enriches and validates existing Transaction/LoanAccount records, it doesn't retrain any model.

### 8.1 Supported document types
- **Loan agreements** — lender, principal, interest rate, tenure, full EMI schedule (all due dates/amounts upfront, not inferred one SMS at a time)
- **EMI schedules** (standalone, e.g. from an NBFC portal export) — same extraction target as above
- **Bank statements** (PDF/CSV export) — full transaction history for a period, used primarily for reconciliation against what SMS parsing already captured

### 8.2 Data model
```
DocumentRecord {
  id, documentType,      // 'loanAgreement' | 'emiSchedule' | 'bankStatement'
  uploadedAt, sourceInstitution,
  extractionStatus,       // 'pending' | 'parsed' | 'needsReview' | 'failed'
  extractedFields,        // structured output, shape depends on documentType
  linkedLoanId,           // for loan/EMI documents
  reconciliationSummary    // for bank statements, see 8.4
}
```

### 8.3 Extraction pipeline
- Text-based PDFs: direct text extraction
- Scanned/image documents: on-device OCR (e.g. ML Kit Text Recognition or Tesseract) before extraction
- Same tiered approach as SMS/Bank Rule Registry: a versioned **Document Template Registry**, with Tier 1 covering major banks/NBFCs' statement and loan-agreement layouts, Tier 2 covering the long tail via the same opt-in "help us support this format" flow, and a Tier 3 generic fallback (keyword/pattern-based field detection) with mandatory manual review before anything is saved
- Every extracted field carries the same reason-code/confidence treatment as SMS parsing — e.g. "EMI amount extracted from page 2, table row 3" — so users can verify rather than blindly trust

### 8.4 Reconciliation (bank statements)
- Compare statement transactions against already-parsed SMS-derived Transaction records for the same period
- Surface three outcomes: matched (confirms SMS parsing worked), **missed** (in statement but no matching SMS was parsed — a real coverage gap the app should own up to), and **extra** (an SMS-derived transaction with no statement match — worth flagging for review, could indicate a misparse)
- This reconciliation summary becomes a trust signal shown to the user (e.g. "98% of last month's transactions matched your bank statement") and a concrete feedback loop for improving the Rule Registry

### 8.5 Loan/EMI enrichment
- A parsed loan agreement/EMI schedule pre-populates a complete `LoanAccount` with the full future schedule already known, instead of the app inferring it EMI-by-EMI over months
- Future EMI-debit SMS still get linked as before, but now validate against the known schedule instead of being the sole source of truth — a mismatch (wrong amount, missed date) becomes a meaningful alert rather than silent data

### 8.6 Security considerations
Documents are more sensitive than SMS — full account numbers, KYC details, signatures may be present. This raises the bar over SMS-only handling:
- Documents should be encrypted at rest, at least to the same standard as the rest of the local database, ideally with an additional layer (e.g. per-document encryption key) given their sensitivity
- Never included in the RAG embedding index or any report/voice output without explicit user action per document — documents are opt-in ingestion, not automatically swept into the same pipeline as SMS
- Same absolute rule as everything else in this spec: documents are processed and stored entirely on-device, never uploaded

---

## Version History

- **v1.0** — Initial standalone spec: Inbox, SMS Preview, two-tier Intelligence Engine, RAG logic (on-device default + optional online mode), Reports UI.
- **v1.1** — Removed the optional online "Smart Reports" mode; RAG is now fully offline only. Added device-tiered model selection, hybrid retrieval, pre-aggregation routing, domain-tuned generation model, and multilingual embedding priority to push offline answer quality as close to cloud-level as possible.
- **v1.2** — Added a Voice Engine section: layered on-device TTS approach (bundled neural TTS → platform enhanced voices → standard TTS fallback → optional concatenative human-recorded phrases) to replace robotic default TTS, shared between transaction announcements and spoken report answers.
- **v1.3** — Added a Document Ingestion & Reconciliation section: extraction (not model training) from user-uploaded loan agreements, EMI schedules, and bank statements, with a Document Template Registry, statement-based reconciliation against SMS-derived transactions, loan/EMI schedule pre-population, and elevated security handling for document sensitivity.

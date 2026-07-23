/**
 * Lightweight on-device embedding & semantic retrieval (Spec Section 5.2-5.3).
 *
 * Instead of shipping a large neural embedding model, this uses a TF-IDF
 * (Term Frequency - Inverse Document Frequency) approach to create
 * "embedding vectors" from SMS text. This is:
 * - Fully offline (no model download, no inference runtime)
 * - Fast (pure JavaScript, no WASM needed)
 * - Good enough for semantic matching on financial SMS vocabulary
 *
 * The approach:
 * 1. Build a vocabulary from all SMS messages
 * 2. Compute TF-IDF vectors for each message (term frequency × inverse doc frequency)
 * 3. For a query, compute its TF-IDF vector against the same vocabulary
 * 4. Retrieve top-N messages by cosine similarity
 *
 * This implements the "brute-force cosine similarity over all embeddings"
 * approach mentioned in Section 5.2, suitable for a few thousand messages.
 */

export interface EmbeddingVector {
  messageId: string;
  vector: Record<string, number>; // sparse vector: term → tfidf weight
}

// Stop words to exclude from tokenization
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "dare",
  "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
  "from", "as", "into", "through", "during", "before", "after", "above",
  "below", "up", "down", "out", "off", "over", "under", "again", "further",
  "then", "once", "here", "there", "when", "where", "why", "how", "all",
  "each", "every", "both", "few", "more", "most", "other", "some", "such",
  "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "also", "and", "or", "but", "if", "because", "while", "this",
  "that", "these", "those", "i", "me", "my", "we", "our", "you", "your",
  "he", "him", "his", "she", "her", "it", "its", "they", "them", "their",
  "what", "which", "who", "whom", "whose",
  // SMS-specific noise
  "dear", "customer", "please", "rs", "inr", "avl", "bal", "ac", "a/c",
  "xx", "on", "via", "to", "from", "at", "by", "for",
]);

/** Tokenize text into meaningful terms (lowercase, alphanumeric, stop-word filtered). */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/**
 * Build a TF-IDF index from a corpus of documents.
 * Returns a map from document ID to its sparse TF-IDF vector.
 */
export function buildTfidfIndex(
  documents: Array<{ id: string; text: string }>
): {
  index: Map<string, Record<string, number>>;
  vocabulary: Set<string>;
  docFreq: Map<string, number>;
  totalDocs: number;
} {
  const totalDocs = documents.length;
  if (totalDocs === 0) {
    return { index: new Map(), vocabulary: new Set(), docFreq: new Map(), totalDocs: 0 };
  }

  // Document frequency: how many documents contain each term
  const docFreq = new Map<string, number>();
  const tokenizedDocs: Array<{ id: string; tokens: string[] }> = [];

  for (const doc of documents) {
    const tokens = tokenize(doc.text);
    tokenizedDocs.push({ id: doc.id, tokens });
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }

  const vocabulary = new Set(docFreq.keys());

  // Compute TF-IDF vectors
  const index = new Map<string, Record<string, number>>();
  for (const { id, tokens } of tokenizedDocs) {
    const vector: Record<string, number> = {};
    const termFreq = new Map<string, number>();
    for (const t of tokens) {
      termFreq.set(t, (termFreq.get(t) ?? 0) + 1);
    }
    const docLength = tokens.length;
    for (const [term, freq] of termFreq) {
      const tf = freq / docLength;
      const df = docFreq.get(term) ?? 1;
      const idf = Math.log((totalDocs + 1) / (df + 1)) + 1; // smoothed IDF
      vector[term] = tf * idf;
    }
    index.set(id, vector);
  }

  return { index, vocabulary, docFreq, totalDocs };
}

/**
 * Compute the TF-IDF vector for a query against an existing index.
 */
export function embedQuery(
  query: string,
  docFreq: Map<string, number>,
  totalDocs: number
): Record<string, number> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return {};

  const vector: Record<string, number> = {};
  const termFreq = new Map<string, number>();
  for (const t of tokens) {
    termFreq.set(t, (termFreq.get(t) ?? 0) + 1);
  }
  const docLength = tokens.length;
  for (const [term, freq] of termFreq) {
    const tf = freq / docLength;
    const df = docFreq.get(term) ?? 0;
    if (df === 0) {
      // Term not in corpus — give it a small weight so it doesn't dominate
      const idf = Math.log((totalDocs + 1) / 1) + 1;
      vector[term] = tf * idf * 0.3; // discounted weight for unknown terms
    } else {
      const idf = Math.log((totalDocs + 1) / (df + 1)) + 1;
      vector[term] = tf * idf;
    }
  }
  return vector;
}

/**
 * Compute cosine similarity between two sparse vectors.
 */
export function cosineSimilarity(
  a: Record<string, number>,
  b: Record<string, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Iterate over the smaller vector for efficiency
  const [smaller, larger] = Object.keys(a).length < Object.keys(b).length ? [a, b] : [b, a];
  for (const key in smaller) {
    if (key in larger) {
      dotProduct += smaller[key] * larger[key];
    }
  }
  for (const key in a) normA += a[key] * a[key];
  for (const key in b) normB += b[key] * b[key];

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Retrieve the top-N most similar documents for a query.
 * Returns array of { id, score } sorted by descending similarity.
 */
export function semanticSearch(
  query: string,
  index: Map<string, Record<string, number>>,
  docFreq: Map<string, number>,
  totalDocs: number,
  topN: number = 10
): Array<{ id: string; score: number }> {
  const queryVector = embedQuery(query, docFreq, totalDocs);
  if (Object.keys(queryVector).length === 0) return [];

  const scores: Array<{ id: string; score: number }> = [];
  for (const [id, docVector] of index) {
    const score = cosineSimilarity(queryVector, docVector);
    if (score > 0) {
      scores.push({ id, score });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topN);
}

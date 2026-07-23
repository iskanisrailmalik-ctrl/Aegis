/**
 * API security utilities — error sanitization + rate limiting.
 */

/**
 * Sanitize error messages for API responses.
 * In production: returns generic messages, hiding Prisma/internal details.
 * In development: returns full error for debugging.
 */
export function sanitizeError(e: unknown): string {
  if (process.env.NODE_ENV === "production") {
    // Generic messages for production
    if (e instanceof Error) {
      if (e.message.includes("Unique constraint")) return "Item already exists";
      if (e.message.includes("Record to update not found")) return "Item not found";
      if (e.message.includes("Record to delete not found")) return "Item not found";
      if (e.message.includes("Foreign key constraint")) return "Referenced item not found";
      if (e.message.includes("Invalid")) return "Invalid input";
    }
    return "An error occurred";
  }
  return e instanceof Error ? e.message : "Unknown error";
}

/**
 * Simple in-memory rate limiter.
 * Limits requests per IP per time window.
 * For production, use Redis or a proper rate limiting middleware.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Check rate limit for a given key (usually IP + route).
 * Returns { allowed: boolean, remaining: number, resetAt: number }.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetTime };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetTime };
}

/**
 * Get client IP from request (best effort).
 */
export function getClientIP(req: Request): string {
  const headers = req.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Rate limit middleware wrapper for API routes.
 * Usage: const limited = rateLimit(req, 30); if (limited) return limited;
 */
export function rateLimit(
  req: Request,
  maxRequests: number = 30,
  windowMs: number = 60_000
): Response | null {
  const ip = getClientIP(req);
  const url = new URL(req.url);
  const key = `${ip}:${url.pathname}`;

  const result = checkRateLimit(key, maxRequests, windowMs);
  if (!result.allowed) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(result.resetAt),
          "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }
  return null;
}

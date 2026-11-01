import { NextResponse } from "next/server";
import redis, { ensureConnected } from "../../../lib/redis";

const VIEWS_KEY = "help:views";

// ---------------------------------------------------------------------------
// POST /api/views
// Increments the view counter using Redis INCR (atomic, no read-then-write).
// Returns the new count. If Redis is unavailable, returns count: null.
// ---------------------------------------------------------------------------
export async function POST() {
  const redisAvailable = await ensureConnected();
  if (!redisAvailable) {
    return NextResponse.json({ count: null });
  }

  try {
    const count = await redis.incr(VIEWS_KEY);
    return NextResponse.json({ count });
  } catch (err) {
    console.error("[Redis] INCR error:", (err as Error).message);
    return NextResponse.json({ count: null });
  }
}

// ---------------------------------------------------------------------------
// GET /api/views
// Returns the current view count without incrementing.
// ---------------------------------------------------------------------------
export async function GET() {
  const redisAvailable = await ensureConnected();
  if (!redisAvailable) {
    return NextResponse.json({ count: null });
  }

  try {
    const raw = await redis.get(VIEWS_KEY);
    const count = raw ? parseInt(raw, 10) : 0;
    return NextResponse.json({ count });
  } catch (err) {
    console.error("[Redis] GET views error:", (err as Error).message);
    return NextResponse.json({ count: null });
  }
}

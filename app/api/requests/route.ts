import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import redis, { ensureConnected } from "../../../lib/redis";

const CACHE_KEY = "help:latest";
const CACHE_TTL = 60; // seconds

// ---------------------------------------------------------------------------
// GET /api/requests
// Returns the latest 10 help requests, newest first.
// Checks Redis cache first; falls back to PostgreSQL on cache miss or Redis
// unavailability.
// ---------------------------------------------------------------------------
export async function GET() {
  const redisAvailable = await ensureConnected();

  // 1. Try Redis cache
  if (redisAvailable) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        return NextResponse.json({
          source: "Redis",
          requests: JSON.parse(cached),
        });
      }
    } catch (err) {
      console.error("[Redis] GET error:", (err as Error).message);
      // Fall through to PostgreSQL
    }
  }

  // 2. Query PostgreSQL
  try {
    const result = await db.query(
      `SELECT id, student_name, message, status, created_at
       FROM help_requests
       ORDER BY created_at DESC
       LIMIT 10`
    );
    const requests = result.rows;

    // 3. Populate cache
    if (redisAvailable) {
      try {
        await redis.set(CACHE_KEY, JSON.stringify(requests), {
          EX: CACHE_TTL,
        });
      } catch (err) {
        console.error("[Redis] SET error:", (err as Error).message);
      }
    }

    return NextResponse.json({ source: "PostgreSQL", requests });
  } catch (err) {
    console.error("[DB] query error:", err);
    return NextResponse.json(
      { success: false, error: "Database error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/requests
// Accepts { student_name, message } — both required, non-empty.
// Inserts into PostgreSQL and invalidates the Redis cache.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { student_name, message } = body as Record<string, unknown>;

  // Validation
  if (
    !student_name ||
    typeof student_name !== "string" ||
    student_name.trim() === ""
  ) {
    return NextResponse.json(
      { success: false, error: "student_name and message are required" },
      { status: 400 }
    );
  }
  if (!message || typeof message !== "string" || message.trim() === "") {
    return NextResponse.json(
      { success: false, error: "student_name and message are required" },
      { status: 400 }
    );
  }

  const name = student_name.trim().slice(0, 50);
  const msg = message.trim().slice(0, 200);

  try {
    // Parameterized insert — no SQL injection possible
    const result = await db.query(
      `INSERT INTO help_requests (student_name, message)
       VALUES ($1, $2)
       RETURNING id`,
      [name, msg]
    );
    const id: number = result.rows[0].id;

    // Invalidate cache so the next GET fetches fresh data from PostgreSQL
    const redisAvailable = await ensureConnected();
    if (redisAvailable) {
      try {
        await redis.del(CACHE_KEY);
      } catch (err) {
        console.error("[Redis] DEL error:", (err as Error).message);
      }
    }

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (err) {
    console.error("[DB] insert error:", err);
    return NextResponse.json(
      { success: false, error: "Database error" },
      { status: 500 }
    );
  }
}

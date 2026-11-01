import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import redis, { ensureConnected } from "../../../../lib/redis";

const CACHE_KEY = "help:latest";

// ---------------------------------------------------------------------------
// PATCH /api/requests/[id]
// Marks a request as resolved. Invalidates Redis cache on success.
// Bonus feature from the lab.
// ---------------------------------------------------------------------------
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json(
      { success: false, error: "Invalid id" },
      { status: 400 }
    );
  }

  try {
    const result = await db.query(
      `UPDATE help_requests SET status = 'resolved'
       WHERE id = $1 AND status = 'open'
       RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: "Request not found or already resolved" },
        { status: 404 }
      );
    }

    // Invalidate cache — status changed
    const redisAvailable = await ensureConnected();
    if (redisAvailable) {
      try {
        await redis.del(CACHE_KEY);
      } catch (err) {
        console.error("[Redis] DEL error:", (err as Error).message);
      }
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("[DB] update error:", err);
    return NextResponse.json(
      { success: false, error: "Database error" },
      { status: 500 }
    );
  }
}

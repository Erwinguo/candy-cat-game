import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { query } from "../db.js";
import { verifySession } from "../auth.js";

const submitScoreSchema = z.object({
  score: z.coerce.number().int().min(0).max(1_000_000),
  movesLeft: z.coerce.number().int().min(0).max(999),
  level: z.string().trim().min(1).max(64).default("classic"),
  guestName: z.string().trim().min(1).max(32).optional(),
});

const leaderboardQuerySchema = z.object({
  level: z.string().trim().min(1).max(64).default("classic"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const rankQuerySchema = z.object({
  scoreId: z.string().uuid(),
});

type ScoreRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  moves_left: number;
  level: string;
  created_at: string;
  rank: string;
};

function normalizeScore(row: ScoreRow) {
  return {
    id: row.id,
    rank: Number(row.rank),
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    score: row.score,
    movesLeft: row.moves_left,
    level: row.level,
    createdAt: row.created_at,
  };
}

async function getUserIdFromRequest(request: any): Promise<string | null> {
  const cookie = request.cookies?.tangdou_token;
  const header = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const rawToken = cookie || header;
  if (!rawToken) return null;
  return await verifySession(rawToken);
}

export const scoreRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/scores", async (request, reply) => {
    const parsed = submitScoreSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_score_payload", details: parsed.error.flatten() });
    }

    const { score, movesLeft, level, guestName } = parsed.data;
    const safeGuestName = guestName || "糖豆玩家";
    const userId = await getUserIdFromRequest(request);

    let result;
    if (userId) {
      result = await query<{ id: string }>(
        `
          insert into scores (user_id, guest_name, score, moves_left, level)
          values ($1, $2, $3, $4, $5)
          returning id
        `,
        [userId, safeGuestName, score, movesLeft, level],
      );
    } else {
      result = await query<{ id: string }>(
        `
          insert into scores (guest_name, score, moves_left, level)
          values ($1, $2, $3, $4)
          returning id
        `,
        [safeGuestName, score, movesLeft, level],
      );
    }

    return reply.code(201).send({ id: result.rows[0].id });
  });

  app.get("/api/leaderboard", async (request, reply) => {
    const parsed = leaderboardQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_leaderboard_query", details: parsed.error.flatten() });
    }

    const { level, limit } = parsed.data;
    const result = await query<ScoreRow>(
      `
        select
          s.id,
          coalesce(u.display_name, s.guest_name, '糖豆玩家') as display_name,
          u.avatar_url,
          s.score,
          s.moves_left,
          s.level,
          s.created_at,
          rank() over (order by s.score desc, s.moves_left desc, s.created_at asc) as rank
        from scores s
        left join app_users u on u.id = s.user_id
        where s.level = $1
        order by s.score desc, s.moves_left desc, s.created_at asc
        limit $2
      `,
      [level, limit],
    );

    return { items: result.rows.map(normalizeScore) };
  });

  app.get("/api/leaderboard/me", async (request, reply) => {
    const parsed = rankQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_rank_query", details: parsed.error.flatten() });
    }

    const result = await query<ScoreRow>(
      `
        with ranked as (
          select
            s.id,
            coalesce(u.display_name, s.guest_name, '糖豆玩家') as display_name,
            u.avatar_url,
            s.score,
            s.moves_left,
            s.level,
            s.created_at,
            rank() over (
              partition by s.level
              order by s.score desc, s.moves_left desc, s.created_at asc
            ) as rank
          from scores s
          left join app_users u on u.id = s.user_id
        )
        select * from ranked where id = $1
      `,
      [parsed.data.scoreId],
    );

    if (!result.rowCount) {
      return reply.code(404).send({ error: "score_not_found" });
    }

    return { item: normalizeScore(result.rows[0]) };
  });
};

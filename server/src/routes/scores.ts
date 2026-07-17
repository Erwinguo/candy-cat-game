import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { query } from "../db.js";
import { verifySession } from "../auth.js";

const submitScoreSchema = z.object({
  score: z.coerce.number().int().min(0).max(1_000_000),
  movesLeft: z.coerce.number().int().min(0).max(999),
  level: z.string().trim().min(1).max(64).default("classic"),
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
  user_id: string | null;
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
    userId: row.user_id,
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

    const { score, movesLeft, level } = parsed.data;
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return reply.code(401).send({
        error: "login_required",
        message: "Login is required to record a leaderboard score.",
      });
    }

    const result = await query<{ id: string }>(
      `
        insert into scores (user_id, score, moves_left, level)
        values ($1, $2, $3, $4)
        returning id
      `,
      [userId, score, movesLeft, level],
    );

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
        with user_scores as (
          select
            s.*,
            row_number() over (
              partition by s.user_id
              order by s.score desc, s.moves_left desc, s.created_at asc
            ) as user_best_order
          from scores s
          where s.level = $1 and s.user_id is not null
        ),
        legacy_guest_scores as (
          select
            s.*,
            row_number() over (
              partition by s.guest_name
              order by s.score desc, s.moves_left desc, s.created_at asc
            ) as user_best_order
          from scores s
          where s.level = $1
            and s.user_id is null
            and nullif(trim(s.guest_name), '') is not null
        ),
        player_bests as (
          select
            s.id, s.user_id, u.display_name, u.avatar_url,
            s.score, s.moves_left, s.level, s.created_at
          from user_scores s
          join app_users u on u.id = s.user_id
          where s.user_best_order = 1
          union all
          select
            s.id, null::uuid as user_id, s.guest_name as display_name,
            null::text as avatar_url, s.score, s.moves_left, s.level, s.created_at
          from legacy_guest_scores s
          where s.user_best_order = 1
        ),
        ranked as (
          select
            s.*,
            rank() over (
              order by s.score desc, s.moves_left desc, s.created_at asc
            ) as rank
          from player_bests s
        )
        select * from ranked
        order by rank asc
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
        with target as (
          select s.*
          from scores s
          where s.id = $1 and s.user_id is not null
        ),
        other_user_scores as (
          select
            s.*,
            row_number() over (
              partition by s.user_id
              order by s.score desc, s.moves_left desc, s.created_at asc
            ) as user_best_order
          from scores s
          join target t on t.level = s.level
          where s.user_id is not null and s.user_id <> t.user_id
        ),
        legacy_guest_scores as (
          select
            s.*,
            row_number() over (
              partition by s.guest_name
              order by s.score desc, s.moves_left desc, s.created_at asc
            ) as user_best_order
          from scores s
          join target t on t.level = s.level
          where s.user_id is null
            and nullif(trim(s.guest_name), '') is not null
        ),
        candidates as (
          select id, user_id, guest_name, score, moves_left, level, created_at from target
          union all
          select id, user_id, guest_name, score, moves_left, level, created_at
          from other_user_scores
          where user_best_order = 1
          union all
          select id, user_id, guest_name, score, moves_left, level, created_at
          from legacy_guest_scores
          where user_best_order = 1
        ),
        ranked as (
          select
            s.id,
            s.user_id,
            coalesce(u.display_name, s.guest_name, '匿名玩家') as display_name,
            u.avatar_url,
            s.score,
            s.moves_left,
            s.level,
            s.created_at,
            rank() over (
              partition by s.level
              order by s.score desc, s.moves_left desc, s.created_at asc
            ) as rank
          from candidates s
          left join app_users u on u.id = s.user_id
        ),
        target_rank as (
          select rank from ranked where id = $1
        )
        select r.*
        from ranked r
        cross join target_rank t
        where r.rank between greatest(1, t.rank - 4) and t.rank + 4
        order by r.rank asc
      `,
      [parsed.data.scoreId],
    );

    if (!result.rowCount) {
      return reply.code(404).send({ error: "score_not_found" });
    }

    const items = result.rows.map(normalizeScore);
    const item = items.find((score) => score.id === parsed.data.scoreId);
    if (!item) {
      return reply.code(404).send({ error: "score_not_found" });
    }

    return { item, items };
  });
};

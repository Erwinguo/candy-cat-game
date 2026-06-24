import type { FastifyPluginAsync } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { query } from "../db.js";

const createShareSchema = z.object({
  scoreId: z.string().uuid(),
});

type ShareRow = {
  id: string;
  share_token: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  moves_left: number;
  level: string;
  created_at: string;
};

function normalizeShare(row: ShareRow) {
  return {
    id: row.id,
    shareToken: row.share_token,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    score: row.score,
    movesLeft: row.moves_left,
    level: row.level,
    createdAt: row.created_at,
  };
}

export const shareRoutes: FastifyPluginAsync = async (app) => {
  // Create a share snapshot
  app.post("/api/shares", async (request, reply) => {
    const parsed = createShareSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_share_payload", details: parsed.error.flatten() });
    }

    const { scoreId } = parsed.data;

    // Verify score exists
    const scoreCheck = await query<{ id: string; guest_name: string | null; user_id: string | null }>(
      `select id, guest_name, user_id from scores where id = $1`,
      [scoreId],
    );

    if (!scoreCheck.rowCount) {
      return reply.code(404).send({ error: "score_not_found" });
    }

    const shareToken = randomBytes(16).toString("hex");

    await query(
      `insert into share_snapshots (user_id, score_id, share_token) values ($1, $2, $3)`,
      [scoreCheck.rows[0].user_id, scoreId, shareToken],
    );

    return reply.code(201).send({ shareToken });
  });

  // View a shared snapshot
  app.get("/api/shares/:token", async (request, reply) => {
    const result = await query<ShareRow>(
      `
        select
          ss.id,
          ss.share_token,
          coalesce(u.display_name, s.guest_name, '糖豆玩家') as display_name,
          u.avatar_url,
          s.score,
          s.moves_left,
          s.level,
          ss.created_at
        from share_snapshots ss
        join scores s on s.id = ss.score_id
        left join app_users u on u.id = ss.user_id
        where ss.share_token = $1
      `,
      [(request.params as any).token],
    );

    if (!result.rowCount) {
      return reply.code(404).send({ error: "share_not_found" });
    }

    return { item: normalizeShare(result.rows[0]) };
  });
};

import { DurableObject } from "cloudflare:workers";

import { SSETarget } from "../../SSETarget";
import type { StepEvent, StepEventWithId } from "..";

export class WorkflowEvents<Env extends object> extends DurableObject<Env> {
  private workflowSSE: DurableObjectSSETarget;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.workflowSSE = new DurableObjectSSETarget(ctx);
  }

  async dispatchEvent(event: StepEvent) {
    this.workflowSSE.dispatchEvent(event);
  }

  override async fetch(request: Request) {
    return this.workflowSSE.fetch(request);
  }
}

class DurableObjectSSETarget extends SSETarget<StepEvent> {
  constructor(private readonly ctx: DurableObjectState) {
    super("/sse");
    const sql = ctx.storage.sql;

    sql.exec(`CREATE TABLE IF NOT EXISTS events(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      step TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      error TEXT
    );`);
  }

  override storeEvent(event: StepEvent) {
    const sql = this.ctx.storage.sql;
    const query = `INSERT INTO events (type, step, timestamp, error) VALUES (?, ?, ?, ?)`;
    sql.exec(query, ...[event.type, event.step, event.timestamp, event.error]);
  }

  override getEvents(sinceId?: number): readonly StepEventWithId[] {
    const sql = this.ctx.storage.sql;
    if (sinceId !== undefined) {
      return sql
        .exec<StepEventWithId>("SELECT * FROM events WHERE id > ? ORDER BY id ASC", sinceId)
        .toArray();
    }
    return sql.exec<StepEventWithId>("SELECT * FROM events ORDER BY id ASC").toArray();
  }
}

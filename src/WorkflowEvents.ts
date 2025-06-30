import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

export type WorkflowProgressEvent = {
  type: "step_started" | "step_completed" | "step_failed";
  step: string;
  timestamp: string;
  error?: string;
};

export abstract class WorkflowEvents<
  Env extends object,
> extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;

    sql.exec(`CREATE TABLE IF NOT EXISTS events(
      type TEXT NOT NULL,
      step TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      error TEXT
    );`);
  }

  async addEvent(event: WorkflowProgressEvent) {
    const sql = this.ctx.storage.sql;
    const query = `INSERT INTO events (type, step, timestamp, error) VALUES (?, ?, ?, ?)`;
    sql.exec(query, ...[event.type, event.step, event.timestamp, event.error]);
  }

  private getEvents() {
    const sql = this.ctx.storage.sql;
    return sql.exec("SELECT * FROM events");
  }

  override async fetch(request: Request) {
    const app = new Hono<{ Bindings: Env }>();
    app.get("/sse", (c) => {
      const events = this.getEvents().toArray();

      return streamSSE(c, async (stream) => {
        for (const event of events) {
          await stream.writeSSE({
            data: JSON.stringify(event),
          });
        }
      });
    });

    return app.fetch(request);
  }
}

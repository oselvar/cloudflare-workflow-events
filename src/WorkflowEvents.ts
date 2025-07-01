import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

export type StepMethod = "do" | "sleep" | "sleepUntil" | "waitForEvent";

export type StepEvent = {
  name: "started" | "completed" | "failed";
  method: StepMethod;
  step: string;
  timestamp: string;
  error?: string;
};

export class WorkflowEvents<Env extends object> extends DurableObject<Env> {
  private eventResolvers: Array<() => void> = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;

    sql.exec(`CREATE TABLE IF NOT EXISTS events(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      step TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      error TEXT
    );`);
  }

  async addEvent(event: StepEvent) {
    const sql = this.ctx.storage.sql;
    const query = `INSERT INTO events (type, step, timestamp, error) VALUES (?, ?, ?, ?)`;
    sql.exec(query, ...[event.name, event.step, event.timestamp, event.error]);

    // Notify waiting streams about the new event
    this.notifyNewEvent();
  }

  private notifyNewEvent() {
    // Resolve all waiting promises
    const resolvers = this.eventResolvers;
    this.eventResolvers = [];
    resolvers.forEach((resolve) => resolve());
  }

  private waitForNewEvent(): Promise<void> {
    return new Promise((resolve) => this.eventResolvers.push(resolve));
  }

  private getEvents(sinceId?: number) {
    const sql = this.ctx.storage.sql;
    if (sinceId !== undefined) {
      return sql.exec<StepEvent & { id: number }>(
        "SELECT * FROM events WHERE id > ? ORDER BY id ASC",
        sinceId,
      );
    }
    return sql.exec<StepEvent & { id: number }>("SELECT * FROM events ORDER BY id ASC");
  }

  override async fetch(request: Request) {
    const app = new Hono<{ Bindings: Env }>();
    app.get("/sse", (c) => {
      return streamSSE(c, async (stream) => {
        const ping = setInterval(() => {
          stream.writeSSE({ event: "ping", data: "" }).catch((err) => {
            // eslint-disable-next-line no-console
            console.error("SSE Error writing ping", err);
          });
        }, 10000);

        let loop = true;
        stream.onAbort(() => {
          loop = false;
          clearInterval(ping);
        });

        const lastEventId = c.req.header("Last-Event-ID");
        let lastEventCount = 0;

        if (lastEventId) {
          const sinceId = parseInt(lastEventId, 10);
          if (!isNaN(sinceId)) {
            // Start from the event after the last received event
            lastEventCount = sinceId;
          }
        }

        while (loop) {
          const allEvents = this.getEvents(
            lastEventCount > 0 ? lastEventCount : undefined,
          ).toArray();
          const newEvents = allEvents.slice(lastEventCount > 0 ? 0 : lastEventCount);

          for (const event of newEvents) {
            const { id, name, ...rest } = event;
            await stream.writeSSE({
              id: String(id),
              event: name,
              data: JSON.stringify(rest),
            });
          }

          lastEventCount =
            allEvents.length > 0
              ? (allEvents[allEvents.length - 1]?.id ?? lastEventCount)
              : lastEventCount;
          await this.waitForNewEvent();
        }
      });
    });

    return app.fetch(request);
  }
}

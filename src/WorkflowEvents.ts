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
  private eventResolvers: Array<() => void> = [];

  static async serveSSE<T extends WorkflowEvents<object>>(
    instanceId: string,
    workflowEventsNs: DurableObjectNamespace<T>,
  ) {
    const workflowEvents = workflowEventsNs.get(
      workflowEventsNs.idFromName(instanceId),
    );
    return workflowEvents.fetch("http://0.0.0.0/sse");
  }

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

  async addEvent(event: WorkflowProgressEvent) {
    const sql = this.ctx.storage.sql;
    const query = `INSERT INTO events (type, step, timestamp, error) VALUES (?, ?, ?, ?)`;
    sql.exec(query, ...[event.type, event.step, event.timestamp, event.error]);

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

  private getEvents() {
    const sql = this.ctx.storage.sql;
    return sql.exec<WorkflowProgressEvent & { id: number }>(
      "SELECT * FROM events ORDER BY id ASC",
    );
  }

  override async fetch(request: Request) {
    const app = new Hono<{ Bindings: Env }>();
    app.get("/sse", (c) => {
      return streamSSE(c, async (stream) => {
        let lastEventCount = 0;

        while (true) {
          const allEvents = this.getEvents().toArray();
          const newEvents = allEvents.slice(lastEventCount);

          for (const event of newEvents) {
            const { id, type, ...rest } = event;
            await stream.writeSSE({
              id: String(id),
              event: type,
              data: JSON.stringify(rest),
            });
          }

          lastEventCount = allEvents.length;
          await this.waitForNewEvent();
        }
      });
    });

    return app.fetch(request);
  }
}

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

export type ServerSentEvent = {
  type: string;
};

export type ServerSentEventWithId<E extends ServerSentEvent> = E & {
  id: number;
};

export abstract class SSETarget<E extends ServerSentEvent> {
  private eventResolvers: Array<() => void> = [];

  constructor(
    private readonly ssePath: string,
    private readonly pingIntervalMillis = 10_000,
  ) {}

  dispatchEvent(event: E) {
    this.storeEvent(event);

    // Notify waiting streams about the new event
    this.notifyNewEvent();
  }

  protected abstract storeEvent(event: E): void;
  protected abstract getEvents(sinceId?: number): readonly ServerSentEventWithId<E>[];

  async fetch(request: Request) {
    const app = new Hono<{ Bindings: Env }>();
    app.get(this.ssePath, (c) => {
      return streamSSE(c, async (stream) => {
        const ping = setInterval(() => {
          stream.writeSSE({ event: "ping", data: "" }).catch((err) => {
            // eslint-disable-next-line no-console
            console.error("SSE Error writing ping", err);
          });
        }, this.pingIntervalMillis);

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
          const allEvents = this.getEvents(lastEventCount > 0 ? lastEventCount : undefined);
          const newEvents = allEvents.slice(lastEventCount > 0 ? 0 : lastEventCount);

          for (const event of newEvents) {
            const { id, type, ...rest } = event;
            await stream.writeSSE({
              id: String(id),
              event: type,
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

  private notifyNewEvent() {
    // Resolve all waiting promises
    const resolvers = this.eventResolvers;
    this.eventResolvers = [];
    resolvers.forEach((resolve) => resolve());
  }

  private waitForNewEvent(): Promise<void> {
    return new Promise((resolve) => this.eventResolvers.push(resolve));
  }
}

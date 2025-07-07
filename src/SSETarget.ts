import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

export type ServerSentEvent = {
  type: string;
};

export type ServerSentEventWithId<E extends ServerSentEvent> = E & {
  id: number;
};

/**
 * Receives events and dispatches them to connected EventSource clients.
 *
 * All dispatched events are stored.
 * This allows clients to receive previously dispatched events.
 *
 * *IMPORTANT:* This class is meant to be subclassed, overriding storeEvent and getEvents.
 * The default implementation stores events in memory, which may cause out of memory errors.
 */
export class SSETarget<E extends ServerSentEvent> {
  private eventResolvers: Array<() => void> = [];

  constructor(
    private readonly ssePath: string,
    private readonly pingIntervalMillis = 10_000,
  ) {}

  /**
   * Dispatches an event to connected EventSource clients.
   * @param event the event object to dispatch.
   */
  dispatchEvent(event: E) {
    this.storeEvent(event);

    // Notify waiting streams about the new event
    this.notifyNewEvent();
  }

  private events: ServerSentEventWithId<E>[] = [];

  protected storeEvent(event: E): void {
    this.events.push({ ...event, id: this.events.length + 1 });
  }

  protected getEvents(
    sinceId?: number,
  ): readonly ServerSentEventWithId<ServerSentEventWithId<E>>[] {
    return this.events.filter((event) => event.id > (sinceId ?? 0));
  }

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

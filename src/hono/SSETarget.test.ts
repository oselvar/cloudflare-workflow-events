import { createEventSource } from "eventsource-client";
import { describe, it } from "vitest";

import { type ServerSentEvent, type ServerSentEventWithId, SSETarget } from "./SSETarget";

function isEqual(event1: TestEvent, event2: TestEvent): boolean {
  return event1.type === event2.type && event1.thing == event2.thing;
}

type TestEvent = ServerSentEvent & {
  thing: string;
};

class MemoryPersistedServerSentEventTarget extends SSETarget<TestEvent> {
  private events: ServerSentEventWithId<TestEvent>[] = [];

  protected override storeEvent(event: TestEvent): void {
    this.events.push({ ...event, id: this.events.length + 1 });
  }

  public override getEvents(sinceId?: number): readonly ServerSentEventWithId<TestEvent>[] {
    return this.events.filter((event) => event.id > (sinceId ?? 0));
  }
}

describe("SSETarget", () => {
  it("should dispatch events to Eventource", async () => {
    const sse = new MemoryPersistedServerSentEventTarget("/sse");

    const event1: TestEvent = {
      type: "started",
      thing: "banana",
    };
    const event2: TestEvent = {
      type: "completed",
      thing: "banana",
    };
    sse.dispatchEvent(event1);
    sse.dispatchEvent(event2);

    await new Promise<void>((resolve, _reject) => {
      const es = createEventSource({
        url: "http://0.0.0.0/sse",
        fetch: (url) => {
          const req = new Request(url);
          return sse.fetch(req);
        },
        onMessage({ event, data }) {
          const reconstructedEvent = { ...JSON.parse(data), type: event };
          if (isEqual(reconstructedEvent, event2)) {
            es.close();
            resolve();
          }
        },
      });
    });
  });
});

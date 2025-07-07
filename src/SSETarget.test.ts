import { createEventSource } from "eventsource-client";
import { describe, it } from "vitest";

import { type ServerSentEvent, SSETarget } from "./SSETarget";

function isEqual(event1: TestEvent, event2: TestEvent): boolean {
  return event1.type === event2.type && event1.thing == event2.thing;
}

type TestEvent = ServerSentEvent & {
  thing: string;
};

describe("SSETarget", () => {
  it("should dispatch events to Eventource", async () => {
    const sse = new SSETarget("/sse");

    const event2: TestEvent = {
      type: "completed",
      thing: "banana",
    };
    sse.dispatchEvent({
      type: "started",
    });
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

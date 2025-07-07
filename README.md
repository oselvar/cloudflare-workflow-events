# SSETarget

The `@oselvar/ssetarget` module exposes a simple API for dispatching events to `EventSource` clients.

```typescript
const sse = new SSETarget("/sse");

sse.dispatchEvent({
  type: "started",
});
```

The `SSETarget` can be used to serve Server-Sent Events:

```typescript
function handleRequest(req: Request) {
  return sse.fetch(req);
}
```

## Cloudflare Workflow events

The library was developed to server Server-Sent Events about the progress of [Cloudflare Workflows](https://developers.cloudflare.com/workflows/).

```typescript
export class MyWorkflow extends WorkflowEntrypoint {
  override async run(event: WorkflowEvent, step: WorkflowStep) {
    step = new WorkflowEventStep(step, this.env.WORKFLOW_EVENTS, event.instanceId);

    // The step dispatches workflow events via SSE
  }
}
```

See the `./src/examples` directory and `./wrangler.toml` for details.

Example SSE events:

```
event: started
data: {"step":"first step","timestamp":"2025-06-30T13:43:26.690Z","error":null}

event: completed
data: {"step":"first step","timestamp":"2025-06-30T13:43:28.688Z","error":null}

event: started
data: {"step":"second step","timestamp":"2025-06-30T13:43:28.689Z","error":null}

event: completed
data: {"step":"second step","timestamp":"2025-06-30T13:43:31.687Z","error":null}

event: started
data: {"step":"third step","timestamp":"2025-06-30T13:43:31.688Z","error":null}

event: completed
data: {"step":"third step","timestamp":"2025-06-30T13:43:32.689Z","error":null}
```

## Try out the example

Start the example:

    # Terminal 1
    npm start

Start a workflow:

    curl -v -X POST http://localhost:9875

Listen to events (using the ID from the `Location` header)

    curl http://localhost:9875/cbd3f7a0-e9ee-422d-8d33-9db7383dba2c/sse

The workflow will wait for events. Trigger one:

    curl -X POST http://localhost:9875/cbd3f7a0-e9ee-422d-8d33-9db7383dba2c/event

## Motivation

The library was built for https://openartmarket.com/ to display progress on a purchase. The purchase workflow takes up to a minute, and we wanted to give users a way to monitor the progress of their purchase.

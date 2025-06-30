# cloudflare-workflow-events

The `cloudflare-workflow-events` exposes a Server-Sent Events endpoint that emits events about the progress of a workflow.

For example:

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

Listen to events (using the `Location` header)

    curl http://localhost:9875/cbd3f7a0-e9ee-422d-8d33-9db7383dba2c/sse

## Motivation

The library was built for https://openartmarket.com/ to display progress on a purchase. The purchase workflow takes up to a minute, and we wanted to give users a way to monitor the progress of their purchase.

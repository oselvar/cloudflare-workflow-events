# cloudflare-workflow-events

The `cloudflare-workflow-events` exposes a Server-Sent Events endpoint that emits events about the progress of a workflow.

For example:

```
event: step_started
data: {"step":"first step","timestamp":"2025-06-30T13:43:26.690Z","error":null}

event: step_completed
data: {"step":"first step","timestamp":"2025-06-30T13:43:28.688Z","error":null}

event: step_started
data: {"step":"second step","timestamp":"2025-06-30T13:43:28.689Z","error":null}

event: step_completed
data: {"step":"second step","timestamp":"2025-06-30T13:43:31.687Z","error":null}

event: step_started
data: {"step":"third step","timestamp":"2025-06-30T13:43:31.688Z","error":null}

event: step_completed
data: {"step":"third step","timestamp":"2025-06-30T13:43:32.689Z","error":null}
```

## Motivation

The library was built for https://openartmarket.com/ to display progress on a purchase. The purchase workflow takes up to a minute, and we wanted to give users a way to monitor the progress of their purchase.

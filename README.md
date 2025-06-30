# cloudflare-workflow-events

cloudflare-workflow-events is a a drop-in replacement for selected Cloudflare Workers features
that makes it easier to test Cloudflare Worker applications.

cloudflare-workflow-events does not use a local wrangler/miniflare session and does not depend on the Cloudflare runtime.

## Motivation

The library was created to make Cloudflare Workflows easier to test.
In particular:

- Idempotency
- Pause/Resume of workflows (not implemented in wrangler/miniflare)

## Workflows

Cloudflare Workflows embody critical business logic that is important to test.

It's _particularly_ important to test that all the steps are [idempotent](https://developers.cloudflare.com/workflows/build/rules-of-workflows/#ensure-apibinding-calls-are-idempotent).

It's also important to test that workflows can run concurrently.

Workflows typically communicate with external services, and mocking those is non-trivial
when the tests run in one process and the workflow in another.

We wanted a way to test Workflows where the tests and the workflow run in the same process.
This makes it easier to stub external services and verify how the workflow interacts with them.

Another reason we wanted to run them in the same process is that we want a sub-second
feedback cycle.

cloudflare-workflow-events achieves this by providing a mechanism to inject stub adapters for external services.

Just write your workflows as normal with the following changes:

1. Replace the import of `cloudflare:workers` with `@oselvar/cloudflare-workflow-events`
2. Replace the use of `this.env` with `this.adapters` - see
3. Use `createCloudflareWorkflow` to convert your cloudflare-workflow-events Workflow to a Cloudflare Workflow

See [CalculateCubeWorkflow.ts](./src/examples/CalculateCubeWorkflow.ts) for an example.

Try it out interactively

    # Terminal 1
    npm start

    # Terminal 2
    curl http://localhost:9875?value=3

    ## Replace id with the response from the first request
    curl http://localhost:9875?instanceId=id

Now, let's test it:

    npx vitest

### Tips

cloudflare-workflow-events might highlight idempotency bugs in your workflows.
Here are some tips to help make them idempotent:

- Avoid nested if statements and loops around workflow steps.
- Visualize your workflows with `@oselvar/c4`. (Coming soon).
- If you use D1 (Sqlite), `UNIQUE` constraints might help you avoid inserting duplicate data.

## Services

Just write your services as normal with the following changes:

1. Replace the import of 'cloudflare:workers' with 'cloudflare-workflow-events:services'
2. Replace the use of 'this.env' with 'this.adapters'

## Adapters

cloudflare-workflow-events requires your application to decouple the business logic from the Cloudflare Workers runtime
by using _adapters_.

For example, if your application needs to store PDFs in a KV store, your business logic will access
a `PDFStore` adapter, not the `this.env.PDF_STORE` object.

An adapter is an interface that defines the methods your business logic will use.

```typescript
interface PDFStore {
  storePDF(id: string, pdf: PDF): Promise<void>;
  getPDF(id: string): Promise<PDF>;
}
```

You will have two implementations of the `PDFStore` interface:

1. A production implementation that uses a `KVNamespace` instance
2. A stub implementation (used for testing) that uses a `Map` instance

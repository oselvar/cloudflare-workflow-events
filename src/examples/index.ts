import { Hono } from "hono";

import { serveSSE } from "../index";
export { WorkflowEvents } from "../WorkflowEvents";
export { DemoWorkflow } from "./DemoWorkflow";

const app = new Hono<{ Bindings: Env }>();

app.get("/:instanceId/sse", async (c) => {
  const instanceId = c.req.param("instanceId");
  const workflowEventsNs = c.env.WORKFLOW_EVENTS;
  return serveSSE(instanceId, c.req.raw, workflowEventsNs);
});

app.post("/", async (c) => {
  const workflow = c.env.DEMO_WORKFLOW;
  const { id } = await workflow.create();
  return Response.redirect(new URL(`/${id}/sse`, c.req.url), 302);
});

export default app;

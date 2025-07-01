export function serveSSE(
  instanceId: string,
  request: Request,
  workflowEventsNs: DurableObjectNamespace,
) {
  const workflowEvents = workflowEventsNs.get(workflowEventsNs.idFromName(instanceId));
  return workflowEvents.fetch("http://0.0.0.0/sse", request);
}

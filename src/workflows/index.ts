import type { ServerSentEventWithId } from "../SSETarget";

export type StepEvent = {
  type: "started" | "completed" | "failed";
  step: string;
  taskId: string;
  timestamp: string;
  error?: string;
};

export type StepEventWithId = ServerSentEventWithId<StepEvent>;

/**
 * Whether or not to send an event notification for a given step
 */
export type ShouldDispatch = (step: string) => boolean;

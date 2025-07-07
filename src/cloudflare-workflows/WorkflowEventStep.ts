import type {
  WorkflowSleepDuration,
  WorkflowStep,
  WorkflowStepConfig,
  WorkflowStepEvent,
  WorkflowTimeoutDuration,
} from "cloudflare:workers";

import type { WorkflowEvents } from "../examples";
import type { ServerSentEventWithId } from "../hono/SSETarget";

export type StepMethod = "do" | "sleep" | "sleepUntil" | "waitForEvent";

export type StepEvent = {
  type: "started" | "completed" | "failed";
  method: StepMethod;
  step: string;
  timestamp: string;
  error?: string;
};

export type StepEventWithId = ServerSentEventWithId<StepEvent>;

/**
 * Whether or not to send an event notification for a given step
 */
export type ShouldNotify = (step: string) => boolean;

export class WorkflowEventStep<Env extends object> implements WorkflowStep {
  private readonly workflowEvents: DurableObjectStub<WorkflowEvents<Env>>;

  constructor(
    private readonly step: WorkflowStep,
    workflowEventsNs: DurableObjectNamespace<WorkflowEvents<Env>>,
    instanceId: string,
    private readonly shouldNotify: ShouldNotify = () => true,
  ) {
    this.workflowEvents = workflowEventsNs.get(workflowEventsNs.idFromName(instanceId));
  }

  async do<T extends Rpc.Serializable<T>>(
    name: string,
    configOrTask: WorkflowStepConfig | (() => Promise<T>),
    callback?: () => Promise<T>,
  ): Promise<T> {
    return this.withEvents("do", name, () =>
      this.step.do(name, configOrTask as WorkflowStepConfig, callback as () => Promise<T>),
    );
  }

  async sleep(name: string, duration: WorkflowSleepDuration): Promise<void> {
    return this.withEvents("sleep", name, () => this.step.sleep(name, duration));
  }

  async sleepUntil(name: string, timestamp: Date | number): Promise<void> {
    return this.withEvents("sleepUntil", name, () => this.step.sleepUntil(name, timestamp));
  }

  async waitForEvent<T extends Rpc.Serializable<T>>(
    name: string,
    options: {
      type: string;
      timeout?: WorkflowTimeoutDuration | number;
    },
  ): Promise<WorkflowStepEvent<T>> {
    return this.withEvents("waitForEvent", name, () => this.step.waitForEvent(name, options));
  }

  private async withEvents<R>(
    method: StepMethod,
    step: string,
    callback: () => Promise<R>,
  ): Promise<R> {
    const addEvent = this.shouldNotify(step);
    if (!addEvent) {
      return callback();
    }
    await this.workflowEvents.dispatchEvent({
      type: "started",
      method: method,
      step,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await callback();
      await this.workflowEvents.dispatchEvent({
        type: "completed",
        method: method,
        step,
        timestamp: new Date().toISOString(),
      });
      return result;
    } catch (error) {
      await this.workflowEvents.dispatchEvent({
        type: "failed",
        method: method,
        step,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

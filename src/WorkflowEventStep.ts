import type {
  WorkflowSleepDuration,
  WorkflowStep,
  WorkflowStepConfig,
  WorkflowStepEvent,
  WorkflowTimeoutDuration,
} from "cloudflare:workers";

import type { StepMethod, WorkflowEvents } from "./WorkflowEvents";

export class WorkflowEventStep<Env extends object> implements WorkflowStep {
  private readonly workflowEvents: DurableObjectStub<WorkflowEvents<Env>>;

  constructor(
    private readonly step: WorkflowStep,
    workflowEventsNs: DurableObjectNamespace<WorkflowEvents<Env>>,
    instanceId: string,
  ) {
    this.workflowEvents = workflowEventsNs.get(
      workflowEventsNs.idFromName(instanceId),
    );
  }

  async do<T extends Rpc.Serializable<T>>(
    name: string,
    configOrTask: WorkflowStepConfig | (() => Promise<T>),
    callback?: () => Promise<T>,
  ): Promise<T> {
    return this.withEvents("do", name, async () => {
      return await this.step.do(
        name,
        configOrTask as WorkflowStepConfig,
        callback as () => Promise<T>,
      );
    });
  }

  async sleep(name: string, duration: WorkflowSleepDuration): Promise<void> {
    return this.withEvents("sleep", name, async () => {
      return await this.step.sleep(name, duration);
    });
  }

  async sleepUntil(name: string, timestamp: Date | number): Promise<void> {
    return this.withEvents("sleepUntil", name, async () => {
      return await this.step.sleepUntil(name, timestamp);
    });
  }

  async waitForEvent<T extends Rpc.Serializable<T>>(
    name: string,
    options: {
      type: string;
      timeout?: WorkflowTimeoutDuration | number;
    },
  ): Promise<WorkflowStepEvent<T>> {
    return this.withEvents("waitForEvent", name, async () => {
      return await this.step.waitForEvent(name, options);
    });
  }

  private async withEvents<R>(
    method: StepMethod,
    step: string,
    task: () => Promise<R>,
  ): Promise<R> {
    await this.workflowEvents.addEvent({
      name: "started",
      method: method,
      step,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await task();
      await this.workflowEvents.addEvent({
        name: "completed",
        method: method,
        step,
        timestamp: new Date().toISOString(),
      });
      return result;
    } catch (error) {
      await this.workflowEvents.addEvent({
        name: "failed",
        method: method,
        step,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

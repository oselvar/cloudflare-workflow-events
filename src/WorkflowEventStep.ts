import type {
  WorkflowStep,
  WorkflowStepConfig,
  WorkflowStepEvent,
  WorkflowTimeoutDuration,
} from "cloudflare:workers";

import type { WorkflowEvents } from "./WorkflowEvents";

export class WorkflowEventStep implements WorkflowStep {
  constructor(
    private readonly step: WorkflowStep,
    private readonly workflowEventsNs: DurableObjectNamespace<
      WorkflowEvents<Env>
    >,
    private readonly instanceId: string,
  ) {}

  async do<T>(
    label: string,
    configOrTask: WorkflowStepConfig | (() => Promise<T>),
    task?: () => Promise<T>,
  ): Promise<T> {
    const workflowEvents = this.workflowEventsNs.get(
      this.workflowEventsNs.idFromName(this.instanceId),
    );
    await workflowEvents.addEvent({
      type: "step_started",
      step: label,
      timestamp: new Date().toISOString(),
    });

    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const result = await this.step.do(label, configOrTask, task);
      await workflowEvents.addEvent({
        type: "step_completed",
        step: label,
        timestamp: new Date().toISOString(),
      });
      return result as T;
    } catch (error) {
      await workflowEvents.addEvent({
        type: "step_failed",
        step: label,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  sleep(name: string, duration: WorkflowSleepDuration): Promise<void> {
    return this.step.sleep(name, duration);
  }

  sleepUntil(name: string, timestamp: Date | number): Promise<void> {
    return this.step.sleepUntil(name, timestamp);
  }

  waitForEvent<T extends Rpc.Serializable<T>>(
    name: string,
    options: {
      type: string;
      timeout?: WorkflowTimeoutDuration | number;
    },
  ): Promise<WorkflowStepEvent<T>> {
    return this.step.waitForEvent(name, options);
  }
}

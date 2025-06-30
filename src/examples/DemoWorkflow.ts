import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

import { WorkflowEventStep } from "../WorkflowEventStep";

export class DemoWorkflow extends WorkflowEntrypoint<Env> {
  override async run(event: WorkflowEvent<unknown>, step: WorkflowStep) {
    step = new WorkflowEventStep(
      step,
      this.env.WORKFLOW_EVENTS,
      event.instanceId,
    );
    await step.do("first step", async () => {
      await step.sleep("zzz", "2 seconds");
    });

    await step.do("second step", async () => {
      await step.sleep("zzz", "3 seconds");
    });

    await step.do("third step", async () => {
      await step.sleep("zzz", "1 second");
    });
  }
}

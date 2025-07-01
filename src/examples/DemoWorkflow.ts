import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import { WorkflowEventStep } from "../WorkflowEventStep";

export class DemoWorkflow extends WorkflowEntrypoint<Env> {
  override async run(event: WorkflowEvent<unknown>, step: WorkflowStep) {
    step = new WorkflowEventStep(step, this.env.WORKFLOW_EVENTS, event.instanceId);

    for (let i = 0; i < 20; i++) {
      await step.do(`step ${i}`, async () => {
        await step.sleep(`sleep_${i}`, "2 second");
      });
    }
  }
}

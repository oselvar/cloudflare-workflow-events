import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import { WorkflowEventStep } from "../WorkflowEventStep";

export class DemoWorkflow extends WorkflowEntrypoint<Env> {
  override async run(event: WorkflowEvent<unknown>, step: WorkflowStep) {
    step = new WorkflowEventStep(step, this.env.WORKFLOW_EVENTS, event.instanceId);

    for (let i = 0; i < 20; i++) {
      if (i % 3 === 2) {
        const event = await step.waitForEvent(`wait for event ${i}`, {
          type: "waiting",
          timeout: "1 minute",
        });
        // eslint-disable-next-line no-console
        console.log("Received event:", event);
      }
      await step.sleep(`sleep_${i}`, "2 second");

      await step.do(`step ${i}`, async () => {
        // eslint-disable-next-line no-console
        console.log(`Running step ${i}`);
      });
    }
  }
}

import { Repository } from "typeorm";
import { WorkflowEngineConfig } from "./WorkflowEngineConfig";

/**
 * Generic Workflow Engine to handle workflow transitions.
 * TRequest     = Workflow request entity (e.g. LeaveRequest)
 * TStep        = Workflow step entity (e.g. LeaveStep)
 * TTransition  = Workflow transition entity (e.g. LeaveTransition)
 * TUser        = User entity
 */
export class WorkflowEngine<
  TRequest extends object,
  TStep extends object,
  TTransition extends { action: string; fromStep: TStep; toStep: TStep },
  TUser extends { id: number }
> {
  constructor(
    private requestRepo: Repository<TRequest>,
    private transitionRepo: Repository<TTransition>,
    private userRepo: Repository<TUser>,
    private config: WorkflowEngineConfig<TRequest, TStep, TTransition>
  ) {}

  /**
   * Process a workflow action (e.g., approve, reject, escalate).
   * @param requestId - ID of the workflow request to process
   * @param userId - ID of the user performing the action
   * @param action - Action being performed (must match a transition)
   * @param comment - Optional comment
   */
  async process(
    requestId: number,
    userId: number,
    action: string,
    comment?: string
  ): Promise<void> {
    // Load the request including its current step
    const request = await this.requestRepo.findOneOrFail({
      where: { id: requestId } as any,
      relations: this.config.requestRelations ?? [],
    });

    const currentStepId = this.config.getStepId(request);

    // Load all transitions from the current step
    const transitions = await this.transitionRepo.find({
      where: { fromStep: { id: currentStepId } } as any,
      relations: this.config.transitionRelations ?? [],
    });

    // Find the matching transition based on action name
    const transition = transitions.find(t => t.action === action);
    if (!transition) {
      throw new Error(`Invalid action '${action}' for current step`);
    }

    // Optional: check condition function if provided
    if (this.config.canTransition && !(await this.config.canTransition(transition, request))) {
      throw new Error(`Transition not allowed based on condition`);
    }

    // Update request's current step
    this.config.setStep(request, transition.toStep);

    // Optionally set status
    if (this.config.setStatus) {
      this.config.setStatus(request, action);
    }

    // Save the updated request
    await this.requestRepo.save(request);

    // Save history if supported
    if (this.config.saveHistory) {
      const user = await this.userRepo.findOneByOrFail({ id: userId });
      await this.config.saveHistory({
        user,
        request,
        from: transition.fromStep,
        to: transition.toStep,
        action,
        comment,
      });
    }
  }
}

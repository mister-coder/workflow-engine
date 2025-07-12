import { AppDataSource } from "../data-source";
import { LeaveRequest } from "../entities/leave/LeaveRequest";
import { LeaveHistory } from "../entities/leave/LeaveHistory";
import { WorkflowEngine } from "../engine/workflow.engine";
import { User } from "../entities/User";

/**
 * Service for managing leave requests
 */
export class LeaveRequestService {
  private requestRepo = AppDataSource.getRepository(LeaveRequest);
  private historyRepo = AppDataSource.getRepository(LeaveHistory);
  private userRepo = AppDataSource.getRepository(User);

  // Load the leave workflow blueprint
  private engine = new WorkflowEngine("leave");

  /**
   * Create a new leave request in "Draft" state
   */
  async createRequest(data: {
    subject: string;
    startDate: string;
    endDate: string;
    createdById: number;
  }): Promise<LeaveRequest> {
    const user = await this.userRepo.findOneByOrFail({ id: data.createdById });

    const request = new LeaveRequest();
    request.subject = data.subject;
    request.startDate = data.startDate;
    request.endDate = data.endDate;
    request.createdBy = user;
    request.currentStepKey = "DRAFT";
    request.status = "pending";

    return this.requestRepo.save(request);
  }

  /**
   * Perform an action (e.g. submit, approve, reject) on a request
   */
  async performAction(requestId: number, action: string, performedById: number, comment?: string) {
    const request = await this.requestRepo.findOneOrFail({
      where: { id: requestId },
      relations: ["createdBy"],
    });

    // Determine next step from engine
    const nextStepKey = this.engine.getNextStepKey(request.currentStepKey, action);
    if (!nextStepKey) {
      throw new Error(`Action "${action}" is not valid from step "${request.currentStepKey}".`);
    }

    // Log transition to history
    const history = new LeaveHistory();
    history.request = request;
    history.fromStepKey = request.currentStepKey;
    history.toStepKey = nextStepKey;
    history.action = action;
    history.performedBy = await this.userRepo.findOneByOrFail({ id: performedById });
    history.comment = comment ?? "";

    await this.historyRepo.save(history);

    // Update the request with new step
    request.currentStepKey = nextStepKey;
    request.status =
      nextStepKey === "COMPLETED" ? "approved" :
      nextStepKey === "REJECTED" ? "rejected" :
      "pending";

    await this.requestRepo.save(request);
  }

  /**
   * Return all available actions for the request's current step
   */
  async getAvailableActions(requestId: number) {
    const request = await this.requestRepo.findOneOrFail({ where: { id: requestId } });
    return this.engine.getAvailableTransitions(request.currentStepKey);
  }
}

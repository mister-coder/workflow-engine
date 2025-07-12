import { AppDataSource } from "../data-source";
import { LeaveRequest } from "../entities/leave/LeaveRequest";
import { LeaveHistory } from "../entities/leave/LeaveHistory";
// import { LeaveRequestChange } from "../entities/leave/LeaveRequest.ts";
import { User } from "../entities/User";
import { GenericWorkflowService } from "./baseWorkflow.service";

export class LeaveRequestService extends GenericWorkflowService<LeaveRequest> {
  constructor() {
    super(
      "leave",
      AppDataSource.getRepository(LeaveRequest),
      AppDataSource.getRepository(User),
      AppDataSource.getRepository(LeaveHistory),
    //   AppDataSource.getRepository(LeaveRequestChange)
    );
  }

  // optionally override methods for custom logic
}

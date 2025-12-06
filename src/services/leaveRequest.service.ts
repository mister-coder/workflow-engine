import { AppDataSource } from "../data-source";
import { LeaveRequest } from "../entities/leave/LeaveRequest";
import { LeaveHistory } from "../entities/leave/LeaveHistory";
import { LeaveRequestSnapshot } from "../entities/leave/LeaveRequestSnapshot";
import { Child } from "../entities/leave/child";
import { ChildSnapshot } from "../entities/leave/childSnapshot";
import { SecondChild } from "../entities/leave/secondChild";
import { SecondChildSnapshot } from "../entities/leave/secondChildSnapshot";
import { User } from "../entities/User";
import { GenericWorkflowService } from "./baseWorkflow.service";

export class LeaveRequestService extends GenericWorkflowService<LeaveRequest> {
  constructor() {
    super(
      "leave",
      AppDataSource.getRepository(LeaveRequest),
      AppDataSource.getRepository(User),
      AppDataSource.getRepository(LeaveHistory),
      AppDataSource.getRepository(LeaveRequestSnapshot),
      'request',
      // child table configs
      [
        {
          repo: AppDataSource.getRepository(Child),
          snapshotRepo: AppDataSource.getRepository(ChildSnapshot),
          foreignKey: "child",
          relation: "children",
          children: [
            {
              repo: AppDataSource.getRepository(Child),
              snapshotRepo: AppDataSource.getRepository(ChildSnapshot),
              foreignKey: "subChild",
              relation: "subChild",
            }
          ]
        },
        {
          repo: AppDataSource.getRepository(SecondChild),
          snapshotRepo: AppDataSource.getRepository(SecondChildSnapshot),
          foreignKey: "secondChild",
          relation: "secondChildren",
        }
      ]
    );
  }

  // optionally override methods for custom logic
}

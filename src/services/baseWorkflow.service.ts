import { Repository } from "typeorm";
import { WorkflowEngine } from "../engine/workflow.engine";
import { User } from "../entities/User";
import { DeepPartial } from "typeorm";

export class GenericWorkflowService<T extends { id: number; currentStepKey: string; status: string }> {
  private engine: WorkflowEngine;
  private entityRepo: Repository<T>;
  private userRepo: Repository<User>;
  private snapshotRepo: any;    // later make a proper type
  private historyRepo: any;   // later make a proper type
  private foreignIdName: any;   // later make a proper type

  constructor(
    workflowKey: string,
    entityRepo: Repository<T>,
    userRepo: Repository<User>,
    historyRepo: any,
    snapshotRepo: any,
    foreignIdName: string
  ) {
    this.engine = new WorkflowEngine(workflowKey);
    this.entityRepo = entityRepo;
    this.userRepo = userRepo;
    this.historyRepo = historyRepo;
    this.snapshotRepo = snapshotRepo;
    this.foreignIdName = foreignIdName;
  }

  /**
   * Create a new request
   */
  async create(data: DeepPartial<T>, userId: number): Promise<T> {
    const initialStepKey: any = this.engine.getInitialStepKey();
    const user = await this.userRepo.findOneByOrFail({ id: userId });
    const entity = this.entityRepo.create(data);
    (entity as any).createdBy = user;
    entity.currentStepKey = initialStepKey?.key ?? "draft";
    entity.status = initialStepKey?.name ?? "draft";

    // Save the record
    const savedRequest = await this.entityRepo.save(entity);

    // update the object to become appropriate for the snapshot 
    // by removing the id and replacing it with the parent entity id
    const {id, ...rest} = savedRequest;

    const updatedSavedRequest = {
        [this.foreignIdName]: savedRequest, ...rest
    }

    await this.createSnapshot(updatedSavedRequest, user);

    return savedRequest;
  }

  /**
   * Create a snapshot of the workflow state
   */
  protected async createSnapshot(data: Record<string, any>, takenBy: User) {
    if (!this.snapshotRepo) return;

    const snapshot = this.snapshotRepo.create({
        ...data,
        createdBy: takenBy
    });

    await this.snapshotRepo.save(snapshot);
  }

  /**
   * Perform an action on a workflow entity
   */
  async performAction(id: number, action: string, performedById: number, comment?: string) {
    const entity = await this.entityRepo.findOneOrFail({
      where: { id } as any,
      relations: ["createdBy"],
    });

    const nextStepKey = this.engine.getNextStepKey(entity.currentStepKey, action);
    if (!nextStepKey) {
      throw new Error(`Invalid action "${action}" from step "${entity.currentStepKey}".`);
    }

    const user = await this.userRepo.findOneByOrFail({ id: performedById });

    // Save transition history
    const historyRecord = this.historyRepo.create({
      request: entity,
      fromStepKey: entity.currentStepKey,
      toStepKey: nextStepKey,
      action,
      performedBy: user,
      comment,
    });
    await this.historyRepo.save(historyRecord);

    // Update entity
    entity.currentStepKey = nextStepKey;
    entity.status =
      nextStepKey === "COMPLETED" ? "approved" :
      nextStepKey === "REJECTED" ? "rejected" :
      "pending";

    await this.entityRepo.save(entity);
  }

/**
 * Update a request and save a snapshot of the changes
 */
async update(id: any, data: DeepPartial<T>, userId: number)//: Promise<T> 
{
    // Find the existing request
    const existing = await this.entityRepo.findOneByOrFail({ id });
  
    // Find the user who is performing the update
    const user = await this.userRepo.findOneByOrFail({ id: userId });
  
    // Merge the update into the existing request
    const updatedEntity = this.entityRepo.merge(existing, data);
  
    // Update metadata
    (updatedEntity as any).updatedBy = user;
  
    // Save the updated entity
    const saved = await this.entityRepo.save(updatedEntity);
  
    // Prepare data for snapshot: use the foreign key and exclude the entity's own ID
    const { id: entityId, ...rest } = saved;
    const snapshotData = {
      ...rest,
      [this.foreignIdName]: entityId,
    };
  
    // Create a snapshot of the update
    await this.createSnapshot(snapshotData, user);
  
    return saved;
  }

  /**
   * List allowed transitions from current step
   */
  async getAvailableActions(id: number) {
    const entity = await this.entityRepo.findOneOrFail({ where: { id } as any });
    return this.engine.getAvailableTransitions(entity.currentStepKey);
  }

  /**
   * List change history
   */
  async getChanges(id: number) {
    return this.snapshotRepo.find({
      where: { request: { id } },
      relations: ["changedBy"],
      order: { changedAt: "ASC" },
    });
  }
}

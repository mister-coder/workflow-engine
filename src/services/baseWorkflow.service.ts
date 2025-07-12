import { Repository } from "typeorm";
import { WorkflowEngine } from "../engine/workflow.engine";
import { User } from "../entities/User";
import { DeepPartial } from "typeorm";

export class GenericWorkflowService<T extends { id: number; currentStepKey: string; status: string }> {
  private engine: WorkflowEngine;
  private entityRepo: Repository<T>;
  private userRepo: Repository<User>;
  private changeRepo: any;    // later make a proper type
  private historyRepo: any;   // later make a proper type

  constructor(
    workflowKey: string,
    entityRepo: Repository<T>,
    userRepo: Repository<User>,
    historyRepo: any,
    // changeRepo: any
  ) {
    this.engine = new WorkflowEngine(workflowKey);
    this.entityRepo = entityRepo;
    this.userRepo = userRepo;
    this.historyRepo = historyRepo;
    // this.changeRepo = changeRepo;
  }

  /**
   * Create a new request
   */
  async create(data: DeepPartial<T>, userId: number): Promise<T> {
    const user = await this.userRepo.findOneByOrFail({ id: userId });
    const entity = this.entityRepo.create(data);
    (entity as any).createdBy = user;
    entity.currentStepKey = "DRAFT";
    entity.status = "pending";
    return this.entityRepo.save(entity);
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
   * Update fields on the entity and record changes
   */
  async update(id: number, updates: Partial<T>, performedById: number) {
    const entity = await this.entityRepo.findOneOrFail({
      where: { id } as any,
      relations: ["createdBy"],
    });

    const user = await this.userRepo.findOneByOrFail({ id: performedById });

    const changes = [];

    for (const [field, newValue] of Object.entries(updates)) {
      if (field in entity) {
        const oldValue = (entity as any)[field];
        if (oldValue !== newValue) {
          changes.push({
            request: entity,
            field,
            oldValue: oldValue?.toString() ?? null,
            newValue: newValue?.toString() ?? null,
            changedBy: user,
          });
          (entity as any)[field] = newValue;
        }
      }
    }

    await this.entityRepo.save(entity);

    if (changes.length > 0) {
      await this.changeRepo.save(changes);
    }
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
    return this.changeRepo.find({
      where: { request: { id } },
      relations: ["changedBy"],
      order: { changedAt: "ASC" },
    });
  }
}

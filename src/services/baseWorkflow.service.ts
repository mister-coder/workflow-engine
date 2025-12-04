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

  private childConfigs: {
    repo: Repository<any>;
    snapshotRepo: Repository<any>;
    foreignKey: string;
  }[];

  constructor(
    workflowKey: string,
    entityRepo: Repository<T>,
    userRepo: Repository<User>,
    historyRepo: any,
    snapshotRepo: any,
    foreignIdName: string,
    childConfigs: {
      repo: Repository<any>;
      snapshotRepo: Repository<any>;
      foreignKey: string;
    }[] = []
  ) {
    this.engine = new WorkflowEngine(workflowKey);
    this.entityRepo = entityRepo;
    this.userRepo = userRepo;
    this.historyRepo = historyRepo;
    this.snapshotRepo = snapshotRepo;
    this.foreignIdName = foreignIdName;
    this.childConfigs = childConfigs;
  }

  /**
   * Create a new request
   */
  async create(data: DeepPartial<T>, userId: number): Promise<T> {
    return this.entityRepo.manager.transaction(async (manager) => {
      const initialStepKey: any = this.engine.getInitialStepKey();
      const user = await manager.findOneByOrFail(User, { id: userId });
      const entity = manager.create(this.entityRepo.target, data);
      (entity as any).createdBy = user;
      entity.currentStepKey = initialStepKey?.key ?? "draft";
      entity.status = initialStepKey?.name ?? "draft";

      // Extract children
      const extractedChildren = this.extractChildren(data);

      // Save the record
      const savedRequest = await this.entityRepo.save(entity);

      // update the object to become appropriate for the snapshot 
      // by removing the id and replacing it with the parent entity id
      const {id, ...rest} = savedRequest;

      const updatedSavedRequest = {
          [this.foreignIdName]: savedRequest, ...rest
      }

      await this.createSnapshot(updatedSavedRequest, user);
      
      await this.saveChildren(manager, savedRequest.id, extractedChildren);

      return savedRequest;
    });
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
   * Extract child table data from the main data object
   */
  private extractChildren(data: any) {
    const result: Record<string, any[]> = {};

    this.childConfigs.forEach((cfg) => {
      let name = cfg.repo.metadata.tableName;

      // Convert snake case to camelCase if needed
      name = name.replace(/([-_][a-z])/g, (group) => {
        return group.toUpperCase()
        .replace('-', '')
        .replace('_', '');
      });

      if (Array.isArray(data[name])) {
        result[name] = data[name];
        delete data[name];
      } else {
        result[name] = [data[name]];
      }
    });

    return result;
  }
  
  /**
   * Save child table records
   */
  private async saveChildren(manager: any, parentId: number, extracted: any) {
    for (const cfg of this.childConfigs) {
      let table = cfg.repo.metadata.tableName;

      // Convert snake case to camelCase if needed
      table = table.replace(/([-_][a-z])/g, (group) => {
        return group.toUpperCase()
        .replace('-', '')
        .replace('_', '');
      });

      const rows = extracted[table];
      
      if (!rows || rows.length === 0) continue;

      // Map each child row to include foreign key to parent
      const mapped = rows.map((child: any) => ({
        ...child,
        [this?.foreignIdName]: parentId,
      }));

      // Save child records
      const savedChild = await manager.save(cfg.repo.target, mapped);

      // Save snapshots for each child along with foreign key to parent

      savedChild.forEach(async (child: any) => {
        await manager.save(cfg.snapshotRepo.target, {
          ...child,
          [cfg.foreignKey]: child.id,
        });
      })
    }
  }
  
  /**
   * Update child table records
   */
  private async updateChildren(manager: any, parentId: number, extracted: any) {
    for (const cfg of this.childConfigs) {
      let table = cfg.repo.metadata.tableName;

      // Determine the next version
      const previousMax = await manager
        .getRepository(cfg.repo.target)
        .createQueryBuilder("child")
        .where(`child.${this.foreignIdName} = :pid`, { pid: parentId })
        .select("MAX(child.version)", "max")
        .getRawOne();

      // Mark all existing children inactive
      await manager.update(
        cfg.repo.target,
        { [this.foreignIdName]: parentId },
        { isActive: false }
      );

      const nextVersion = (previousMax?.max || 0) + 1;

      // Convert snake case to camelCase if needed
      table = table.replace(/([-_][a-z])/g, (group) => {
        return group.toUpperCase()
        .replace('-', '')
        .replace('_', '');
      });

      const rows = extracted[table];
      
      if (!rows || rows.length === 0) continue;

      // Map each child row to include foreign key to parent
      const mapped = rows.map((child: any) => ({
        ...child,
        [this?.foreignIdName]: parentId,
        version: nextVersion,
        isActive: true,
      }));

      // Save child records
      const savedChild = await manager.save(cfg.repo.target, mapped);

      // Save snapshots for each child along with foreign key to parent

      savedChild.forEach(async (child: any) => {
        await manager.save(cfg.snapshotRepo.target, {
          ...child,
          [cfg.foreignKey]: child.id,
        });
      })
    }
  }

  /**
   * Perform an action on a workflow entity
   */
  async performAction(id: number | number[], action: string, performedById: number, comment?: string) {
    // Normalize to array
    const idArray = Array.isArray(id) ? id : [id];

    if (idArray.length === 0) {
      throw new Error("No record ids provided.");
    }

    const user = await this.userRepo.findOneByOrFail({ id: performedById });
    
    const results: {
      id: number;
      success: boolean;
      error?: string;
    }[] = [];
    
    await this.entityRepo.manager.transaction(async (manager) => {
      for (const id of idArray) {
        try {

          const entity = await manager.findOneOrFail(this.entityRepo.target, {
            where: { id } as any,
            relations: ["createdBy"],
          });

          // const nextStepKey = this.engine.getNextStepKey(entity.currentStepKey, action);
          // if (!nextStepKey) {
          //   throw new Error(`Invalid action "${action}" from step "${entity.currentStepKey}".`);
          // }

          const transition = this.engine.getTransition(entity.currentStepKey, action);
          if (!transition) {
            throw new Error(`Invalid action "${action}" from step "${entity.currentStepKey}".`);
          }

          const nextStepKey = transition.toStepKey;

          // Save transition history
          const historyRecord = manager.create(this.historyRepo.target, {
            request: entity,
            fromStepKey: entity.currentStepKey,
            toStepKey: nextStepKey,
            action,
            performedBy: user,
            comment,
          });
          await manager.save(this.historyRepo.target, historyRecord);

          // Update entity
          entity.currentStepKey = nextStepKey;
          entity.status =
            nextStepKey === "COMPLETED" ? "approved" :
            nextStepKey === "REJECTED" ? "rejected" :
            transition?.status ?? "pending";  // take status from transition if available in workflow definition

          await manager.save(entity);
          
          results.push({ id, success: true });
        } catch (err: any) {
          results.push({ id, success: false, error: err.message });
        }
      }
    });

    // If called with a single ID, return a single result object instead of an array
    return Array.isArray(id) ? results : results[0];
  }

/**
 * Update a request and save a snapshot of the changes
 */
async update(id: any, data: DeepPartial<T>, userId: number)/*: Promise<T> */{
    return this.entityRepo.manager.transaction(async (manager) => {
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

      // Extract children
      const extractedChildren = this.extractChildren(data);
      
      await this.updateChildren(manager, saved?.id, extractedChildren);
    
      return saved;
    });
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

  /**
   * Get alias for child table in queries
   */
  private getChildAlias(cfg: any) {
    return cfg.repo.metadata.tableName; // simple, clean alias
  }

  /**
   * 
   * Get many requests with active children joined
   */
  async getMany(filter: Record<string, any> = {}) {
    const qb = this.entityRepo
      .createQueryBuilder("parent")
      .where(filter);

    // JOIN all child tables
    for (const cfg of this.childConfigs) {
      const alias = this.getChildAlias(cfg);

      qb.leftJoinAndSelect(
        `${cfg.repo.metadata.tableName}`,      // child table
        alias,                                // alias
        `${alias}.${this.foreignIdName} = parent.id AND ${alias}.isActive = true`
      );
    }
    return qb.getMany();
  }

  /**
   * Get one request with active children joined
   */
  async getOne(filter: Record<string, any>) {
    const qb = this.entityRepo
      .createQueryBuilder("parent")
      .where(filter);

    // JOIN all child tables
    for (const cfg of this.childConfigs) {
      const alias = this.getChildAlias(cfg);

      qb.leftJoinAndSelect(
        `${cfg.repo.metadata.tableName}`,
        alias,
        `${alias}.${this.foreignIdName} = parent.id AND ${alias}.isActive = true`
      );
    }
    return qb.getOne();
  }
}

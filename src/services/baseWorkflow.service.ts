import { Repository, SelectQueryBuilder } from "typeorm";
import { WorkflowEngine } from "../engine/workflow.engine";
import { User } from "../entities/User";
import { DeepPartial } from "typeorm";

export interface ChildConfig {
  repo: Repository<any>;
  snapshotRepo?: Repository<any>;
  foreignKey: string;
  relation: string;
  children?: ChildConfig[];   // recursion works here  
  write?: boolean;
}

interface WorkflowCreateOptions {
  startStepKey?: string;
  // comment?: string;
  // source?: "api" | "import" | "system";
  // skipPermissionCheck?: boolean;
  // statusOverride?: string;
  // metadata?: Record<string, any>;
}

export interface GetOneOptions {
  userRole?: string;
  includeAvailableActions?: boolean;
  enforceViewPermission?: boolean;
  includeReadOnly?: boolean;
}

export interface GetManyOptions {
  userRole?: string;
  enforceViewPermission?: boolean;
  includeReadOnly?: boolean;
}

interface EnforceViewableQueryOptions {
  userRole?: string;          
  enforceViewPermission?: boolean;
}

/**
 * Aggregate Options Method Contract
 */
export interface AggregateOptions {
  groupBy: string[];
  aggregates: {
    alias: string;                      // output name
    fn: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
    field?: string;                     // optional (COUNT can omit)
  }[];
}

export class GenericWorkflowService<T extends { id: number; currentStepKey: string; status: string }> {
  private engine: WorkflowEngine;
  private entityRepo: Repository<T>;
  private userRepo: Repository<User>;
  private snapshotRepo: any;    // later make a proper type
  private historyRepo: any;   // later make a proper type
  private foreignIdName: any;   // later make a proper type

  private childConfigs: ChildConfig[];


  constructor(
    workflowKey: string,
    entityRepo: Repository<T>,
    userRepo: Repository<User>,
    historyRepo: any,
    snapshotRepo: any,
    foreignIdName: string,
    childConfigs: ChildConfig[] = []
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
  async create(data: DeepPartial<T>, userId: number, options: WorkflowCreateOptions = {}): Promise<T> {
    return this.entityRepo.manager.transaction(async (manager) => {
      // WARNING: The following operation will modify the entity and may affect related data.
      const initialStepKey: any = this.engine.getInitialStepKey();
      const step = options.startStepKey
        ? this.engine.getStepOrThrow(options.startStepKey)
        : this.engine.getInitialStepKey();

      const user = await manager.findOneByOrFail(User, { id: userId });
      const entity = manager.create(this.entityRepo.target, data);
      (entity as any).createdBy = user;
      entity.currentStepKey = step?.key ?? "draft";
      entity.status = step?.name ?? "draft";

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
      // Skip if write is false
      if (!cfg.write) continue;

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

      if (cfg.snapshotRepo) {
        for (const child of savedChild) {
          await manager.save(cfg.snapshotRepo.target, {
            ...child,
            [cfg.foreignKey]: child.id,
          });
        }
        // savedChild.forEach(async (child: any) => {
        //   await manager.save(cfg?.snapshotRepo?.target, {
        //     ...child,
        //     [cfg.foreignKey]: child.id,
        //   });
        // })
      }
    }
  }
  
  /**
   * Update child table records
   */
  private async updateChildren(manager: any, parentId: number, extracted: any) {
    for (const cfg of this.childConfigs) {
      // Skip if write is false
      if (!cfg.write) continue;
      
      let table = cfg.repo.metadata.tableName;

      // Determine the next version
      const previousMax = await manager
        .getRepository(cfg.repo.target)
        .createQueryBuilder("child")
        .where(`child.${this.foreignIdName} = :pid`, { pid: parentId })
        .select("MAX(child.version)", "max")
        .getRawOne();

      // Mark all existing children inactive
    if (cfg.snapshotRepo) {
      await manager.update(
        cfg.repo.target,
        { [this.foreignIdName]: parentId },
        { isActive: false }
      );
    }

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
        [this.foreignIdName]: parentId,
        ...(cfg.snapshotRepo ? { version: nextVersion, isActive: true } : {}),
      }));

      // Save child records
      const savedChild = await manager.save(cfg.repo.target, mapped);

      // Save snapshots for each child along with foreign key to parent

      if (cfg.snapshotRepo) {
        for (const child of savedChild) {
          await manager.save(cfg.snapshotRepo.target, {
            ...child,
            [cfg.foreignKey]: child.id,
          });
        }
      }
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
    
      // Extract children before merging (prevent cascade updates)
      const extractedChildren = this.extractChildren(data);
      
      // Merge the update into the existing request (without children)
      const updatedEntity = this.entityRepo.merge(existing, data);
    
      // Update metadata
      (updatedEntity as any).updatedBy = user;
    
      // Save the updated entity (children won't be cascaded)
      const saved = await this.entityRepo.save(updatedEntity);
    
      // Prepare data for snapshot: use the foreign key and exclude the entity's own ID
      const { id: entityId, ...rest } = saved;
      const snapshotData = {
        ...rest,
        [this.foreignIdName]: entityId,
      };
    
      // Create a snapshot of the update
      await this.createSnapshot(snapshotData, user);

      // Update children explicitly using updateChildren
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
   * List allowed transitions for user role from current step
   */
  async getAvailableActionsForUser(id: number, userRole: string) {
    const entity = await this.entityRepo.findOneOrFail({ where: { id } as any });
    return this.engine.getAvailableActionsForUser(entity.currentStepKey, userRole)?.map(t => t.action);
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
  async getMany(filter: Record<string, any> = {}, options?: GetManyOptions) {
    const qb = this.entityRepo
      .createQueryBuilder("parent")
      // .where(filter);

    this.joinChildren(this.childConfigs, qb, "parent");

    // Filter out records where the currentStepKey is not viewable for the role
    if (
      options?.enforceViewPermission &&
      options?.userRole
    ) {
      this.applyViewPermissions(qb, "parent", options);
    }

    this.applyExtendedFilters(qb, "parent", filter);
    
    return qb.getMany();
  }

  /**
   * Get one request with active children joined
   */
  async getOne(filter: Record<string, any>, options?: GetOneOptions) {
    const qb = this.entityRepo
      .createQueryBuilder("parent")
      // .where(filter);

    this.joinChildren(this.childConfigs, qb, "parent");

    // Filter out records where the currentStepKey is not viewable for the role
    if (
      options?.enforceViewPermission &&
      options?.userRole
    ) {
      this.applyViewPermissions(qb, "parent", options);
    }

    this.applyExtendedFilters(qb, "parent", filter);
    
    const entity = await qb.getOne();
    
    if (!entity) return null;

    // Get available actions for the user at the current Step
    if (
      options?.includeAvailableActions &&
      options?.userRole
    ) {
      const availableActions = await
        this.getAvailableActionsForUser(entity?.id, options.userRole);

      (entity as any).availableActions = availableActions;
    }

    // Add isReadOnly prepoerty based on user permissions
    if (
      options?.includeReadOnly &&
      options?.userRole
    ) {
      (entity as any).isReadOnly =
        this.isReadOnlyForUser(entity.currentStepKey, options.userRole);
    }

    return entity;
    // return qb.getOne();
  }

  /**
   * Recursively join child tables
   */
  private joinChildren = (configs: ChildConfig[], qb: any, parentAlias: string) => {
    for (const cfg of configs) {
      const alias = cfg.relation;

      qb.leftJoinAndSelect(`${parentAlias}.${cfg.relation}`, alias);

      if (cfg.children) {
        this.joinChildren(cfg.children, qb, alias);
      }
    }
  };

  /**
   * Apply filter to the GET methods
   */
  private applyFilters(
    qb: any,
    alias: string,
    filter: Record<string, any>
  ) {
    for (const key in filter) {
      const value = filter[key];

      // CASE 1 - Array IN (...)
      if (Array.isArray(value)) {
        if (value.length === 0) {
          // Prevent invalid SQL: IN ()
          qb.andWhere("1 = 0");
          continue;
        }

        const paramName = `${alias}_${key}`;
        qb.andWhere(
          `${alias}.${key} IN (:...${paramName})`,
          { [paramName]: value }
        );
        continue;
      }

      // CASE 2 - Nested filter apply to child alias
      if (typeof value === "object" && value !== null ) {
        const childAlias = key; // must match cfg.relation alias
        this.applyFilters(qb, childAlias, value);
        continue;
      }

      // CASE 3 - Primitive filter on this alias
      const paramName = `${alias}_${key}`;
      qb.andWhere(`${alias}.${key} = :${paramName}`, {
        [paramName]: value,
      });
    }
  }

  /**
   * Similar to the function above but with extra operators
   */
  private applyExtendedFilters(
    qb: any,
    alias: string,
    filter: Record<string, any>
  ) {
    let paramIndex = 0;

    for (const key in filter) {
      const value = filter[key];

      // CASE 1 - Array IN (backward compatible)
      if (Array.isArray(value)) {
        if (value.length === 0) {
          qb.andWhere("1 = 0");
          continue;
        }

        const paramName = `${alias}_${key}_${paramIndex++}`;
        qb.andWhere(
          `${alias}.${key} IN (:...${paramName})`,
          { [paramName]: value }
        );
        continue;
      }

      // CASE 2 - Operator object
      if (this.isOperatorObject(value)) {
        this.applyOperatorFilter(qb, alias, key, value, paramIndex++);
        continue;
      }

      // CASE 3 - Nested relation
      if (typeof value === "object" && value !== null) {
        const childAlias = key; // must match join alias
        this.applyExtendedFilters(qb, childAlias, value);
        continue;
      }

      // CASE 4 - Primitive equality
      const param = `${alias}_${key}_${paramIndex++}`;
      qb.andWhere(`${alias}.${key} = :${param}`, {
        [param]: value,
      });
    }
  }

  /**
   * Operator Detection Helper
   */
  private isOperatorObject(value: any): boolean {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }

    const operators = new Set([
      "eq", "ne",
      "gt", "gte",
      "lt", "lte",
      "in", "between",
      "like", "ilike",
    ]);

    return Object.keys(value).some(k => operators.has(k));
  }

  /**
   * Operator application function
   */
  // Sample operators in actions
  // {
  //   status: "APPROVED",                // =
  //   createdAt: { gt: "2024-01-01" },   // >
  //   amount: { between: [1000, 5000] }, // BETWEEN
  //   id: { in: [1, 2, 3] },              // IN
  //   duration: { lte: 8 },               // <=
  // }
  private applyOperatorFilter(
    qb: any,
    alias: string,
    key: string,
    ops: Record<string, any>,
    paramIndex: number
  ) {
    const column = `${alias}.${key}`;

    for (const op in ops) {
      const param = `${alias}_${key}_${op}_${paramIndex}`;

      switch (op) {
        case "gt":
          qb.andWhere(`${column} > :${param}`, { [param]: ops[op] });
          break;
        case "gte":
          qb.andWhere(`${column} >= :${param}`, { [param]: ops[op] });
          break;
        case "lt":
          qb.andWhere(`${column} < :${param}`, { [param]: ops[op] });
          break;
        case "lte":
          qb.andWhere(`${column} <= :${param}`, { [param]: ops[op] });
          break;
        case "in":
          qb.andWhere(`${column} IN (:...${param})`, { [param]: ops[op] });
          break;
        case "between":
          qb.andWhere(
            `${column} BETWEEN :${param}_1 AND :${param}_2`,
            {
              [`${param}_1`]: ops[op][0],
              [`${param}_2`]: ops[op][1],
            }
          );
          break;
        case "like":
          qb.andWhere(`${column} LIKE :${param}`, { [param]: `%${ops[op]}%` });
          break;
        case "ilike":
          qb.andWhere(`${column} ILIKE :${param}`, { [param]: `%${ops[op]}%` });
          break;
        case "eq":
          qb.andWhere(`${column} = :${param}`, { [param]: ops[op] });
          break;
        case "ne":
          qb.andWhere(`${column} != :${param}`, { [param]: ops[op] });
          break;
      }
    }
  }


  /**
   * Apply Aggregate Functions to GET queries
   * Please only use for analytics
   */
  // Sample parameter
  // {
  //     groupBy: ["currentStepKey"],
  //     aggregates: [
  //       { fn: "COUNT", field: "durationInHours", alias: "count" }
  //     ],
  //   }
  async aggregate(
    filter: Record<string, any> = {},
    options: AggregateOptions
  ) {
    const qb = this.entityRepo.createQueryBuilder("parent");

    qb.select([]);

    // GROUP BY columns
    options.groupBy.forEach((field) => {
      const col = field.includes(".") ? field : `parent.${field}`;
      qb.addSelect(col, field.replace(".", "_"));
      qb.addGroupBy(col);
    });

    // AGGREGATES
    options.aggregates.forEach((agg) => {
      const field = agg.field
        ? agg.field.includes(".")
          ? agg.field
          : `parent.${agg.field}`
        : "parent.id";

      qb.addSelect(`${agg.fn}(${field})`, agg.alias);
    });

    // WHERE
    this.applyFilters(qb, "parent", filter);

    return qb.getRawMany();
  }
  
  /**
   * If user has view permissions, allow them to query records with the given steps
   */
  private applyViewPermissions(
    qb: any,
    alias: string,
    options?: EnforceViewableQueryOptions
  ) {
    if (!options?.enforceViewPermission || !options.userRole) {
      return;
    }

    const viewableSteps =
      this.engine.getViewableStepsForRole(options.userRole);

    if (!viewableSteps.length) {
      qb.andWhere("1 = 0"); // hard deny
      return;
    }

    qb.andWhere(
      `${alias}.currentStepKey IN (:...viewSteps)`,
      { viewSteps: viewableSteps }
    );
  }

  /**
   * check if the user has update permissions upon GET in the given step
   */
  private isReadOnlyForUser(stepKey: string, userRole?: string): boolean {
    if (!userRole) return false; // backward compatible

    const perms = this.engine.getStep(stepKey)?.permissions?.update;

    if (!perms || perms.length === 0) return false; // no restriction

    return !perms.includes(userRole);
  }


  async getPermission(key: string) {
    const step = this.engine.getStep(key);
    return step?.permissions || {};
  }

  async validateStepPermission(stepKey: string, user: string, action: "view" | "create" | "update") {
    const step = this.engine.getStep(stepKey);
    if (!step) throw new Error(`Step not found: ${stepKey}`);

    const perms = step.permissions?.[action];
    if (!perms || perms.length === 0) return; // No restrictions => allow

    if (perms.includes(user)) 
      return true;
    else
      return false;
      // throw new Error(`User role "${user}" is not allowed to ${action} at step "${stepKey}"`);
    
  }
}

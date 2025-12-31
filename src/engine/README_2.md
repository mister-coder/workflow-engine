# Generic Workflow Engine
<sub>Authored by Muhammad (muhammad) Ragialla 31/12/2025</sub>
<br>
<br>
<br>
A lightweight, class-based declarative state machine engine for building customizable, multi-user approval workflows.
All workflow behavior is defined externally using JSON blueprints, making workflows portable, editable, and independent of application code.

The engine is designed to power request-driven processes and any multi-step lifecycle requiring deterministic transitions and auditability.

## Purpose
The Generic Workflow Engine executes request flows using a finite state machine model defined declaratively.

Rather than hard-coding workflow logic, each workflow is described using a JSON blueprint that declares:

1. The valid steps in the process

2. The allowed transitions between those steps

3. The actions that trigger each transition

The engine interprets this declaration at runtime and enforces it consistently.


## State Machine Model
A workflow consists of steps (states) and transitions (actions).
For any given state and action, the next state is deterministic. If no transition is defined, the action is rejected.

This guarantees that requests cannot skip steps or move to undefined states.

Example

From a request workflow blueprint:

```
[DRAFT] --submit--> [CHAMP_REVIEW]
[CHAMP_REVIEW] --approve--> [HEAD_REVIEW]
[HEAD_REVIEW] --approve--> [COMPLETED]
[CHAMP_REVIEW] --reject--> [REJECTED]
[HEAD_REVIEW] --reject--> [REJECTED]
```

Only the transitions declared in the blueprint are permitted.

### Declarative
A declarative workflow model makes behavior explicit and predictable.
Workflow changes are made by editing configuration rather than code, enabling safer iteration, easier review, and consistent enforcement across environments.


## Workflow Definition (JSON Blueprint)

Each workflow is defined using a declarative JSON blueprint.
This file describes the complete state machine: its steps, transitions, actions, and optional permissions.

Blueprints live outside application code and are loaded at runtime by the WorkflowEngine.

```
/workflows/{workflowKey}.workflow.json
```

### Top-Level Structure

```
{
  "workflowKey": "leave",
  "steps": [],
  "transitions": []
}
```

The blueprint is composed of:

1. A unique workflow identifier

2. A list of steps (states)

3. A list of transitions between steps

## Steps
A step represents a state in the workflow lifecycle.

```
{
  "key": "DRAFT",
  "name": "Draft",
  "permissions": {
    "view": ["Champ", "Head"],
    "create": ["Champ"],
    "update": ["Head"]
  },
  "domainOwner": ["Champ"]
}
```

## Step Fields

```
| Field         | Description                                |
| ------------- | ------------------------------------------ |
| `key`         | Unique identifier for the step             |
| `name`        | Human-readable label                       |
| `permissions` | Optional role-based access rules           |
| `domainOwner` | Optional metadata (not used by the engine) |

```

## Transitions
A transition defines a valid movement from one step to another.
```
{
  "fromStepKey": "DRAFT",
  "toStepKey": "MANAGER_REVIEW",
  "action": "submit",
  "status": "submitted",
  "permissions": ["Employee"]
}
```

## Transition Fields

```
| Field         | Description                                  |
| ------------- | -------------------------------------------- |
| `fromStepKey` | Source step                                  |
| `toStepKey`   | Target step                                  |
| `action`      | Action name triggering the transition        |
| `status`      | Optional status applied after transition     |
| `permissions` | Optional roles allowed to perform the action |
```
If permissions is omitted, the action is available to all roles.

## Determinism & Validation
For any given combination of:
1. currentStepKey
2. action

there must be at most one transition.

If no matching transition exists, the engine rejects the action.
This prevents invalid state changes and enforces workflow correctness.

## Status Resolution
When a transition is executed:

1. If a status is defined on the transition, it is applied
2. If no status is defined, the human-readable name of the step is taken as the status
3. Otherwise, a default status is inferred by the service

This allows status logic to remain declarative and workflow-specific.

## Initial Step

The first step in the steps array is treated as the initial step unless overridden during creation.
```
create(data, userId, { startStepKey: "HR_REVIEW" })
```

### Example Blueprint
```
{
  "workflowKey": "leave",
  "steps": [
    { "key": "DRAFT", "name": "Draft" },
    { "key": "CHAMP_REVIEW", "name": "Champ Review" },
    { "key": "HEAD_REVIEW", "name": "HEAD Review" },
    { "key": "COMPLETED", "name": "Completed" },
    { "key": "REJECTED", "name": "Rejected" }
  ],
  "transitions": [
    { "fromStepKey": "DRAFT", "toStepKey": "CHAMP_REVIEW", "action": "submit" },
    { "fromStepKey": "CHAMP_REVIEW", "toStepKey": "HEAD_REVIEW", "action": "approve" },
    { "fromStepKey": "HEAD_REVIEW", "toStepKey": "COMPLETED", "action": "approve" },
    { "fromStepKey": "CHAMP_REVIEW", "toStepKey": "REJECTED", "action": "reject" },
    { "fromStepKey": "HEAD_REVIEW", "toStepKey": "REJECTED", "action": "reject" }
  ]
}
```


## Workflow Engine

The WorkflowEngine is a lightweight, stateless interpreter for workflow blueprints.

It is responsible for loading workflow definitions from disk and enforcing the rules declared in the JSON blueprint. The engine contains no persistence logic and does not mutate application state.

### Responsibilities

The engine provides:

1. Workflow loading and validation
2. Step and transition resolution
3. Action availability checks
4. Role-based visibility and action filtering

### Loading Workflows

Workflows are loaded at runtime using a workflow key:
```
const engine = new WorkflowEngine("request");
```

This resolves and parses:
```
/workflows/request.workflow.json
```

Blueprints are cached per engine instance.


### Step Resolution

Steps are resolved by their **key**.

```
engine.getStep("CHAMP_REVIEW");
engine.getStepName("CHAMP_REVIEW");
```

The engine can also validate step existence and throw if a step is invalid.

### Transition Resolution

Transitions are resolved using the current step and an action:

```
engine.getTransition("DRAFT", "submit");
```

If no transition exists, the action is invalid.

The engine guarantees determinism by selecting at most one transition per **(step, action)** pair.


### Available Actions

The engine can list all transitions available from a step:

```
engine.getAvailableTransitions("CHAMP_REVIEW");
```

Or filter actions by role:
```
engine.getAvailableActionsForUser("HEAD_REVIEW", "champion");
```

Transition-level permissions are enforced declaratively based on the blueprint.


### Permissions & Visibility
Step-level permissions control:
1. Which steps are viewable for a role
2. Whether a step is editable or read-only

```
engine.getViewableStepsForRole("champion");
```

The engine does not enforce persistence rules but exposes permission data for higher layers to apply.

### Initial Step Resolution

The initial step defaults to the first step defined in the blueprint:

```
engine.getInitialStepKey();
```

This behavior can be overridden by the service layer during creation.



## GenericWorkflowService

**GenericWorkflowService** binds a declarative workflow definition to a persistent domain entity.
It is responsible for executing workflow actions, enforcing workflow rules, managing persistence, and coordinating history and snapshots.

Each concrete workflow (e.g. Requests) extends this service with its own entity and repositories.

### Role in the Architecture

The service sits between:

1. The WorkflowEngine (rules & transitions)
2. The database layer (TypeORM repositories)
3. The API layer (controllers / routes)

It translates declarative workflow rules into transactional database operations.


### Entity Requirements

A workflow entity must contain at least:

```
{
  id: number;
  currentStepKey: string;
  status: string;
}
```

These fields allow the service to determine:
1. Current workflow state
2. Valid transitions
3. Available actions
4. Read/write permissions

### Creation

Creating a new workflow record initializes it at a starting step and persists an initial snapshot.

```
create(data, userId, { startStepKey?: string })
```

Behavior:
1. Resolves the initial step from the blueprint (or override)
2. Sets currentStepKey and status
3. Persists the entity in a transaction
4. Creates an immutable snapshot of the initial state
5. Saves configured child entities

### Performing Actions

Actions move a request from one step to another.

```
performAction(id, action, performedById)
```

For each action:
1. The current step is resolved
2. The transition is validated via the workflow engine
3. History is recorded
4. The entity’s step and status are updated atomically

Bulk actions are supported by passing an array of IDs.

### History Tracking

Every successful transition creates a history record capturing:
1. Source step
2. Target step
3. Action
4. User

This provides a complete audit trail of workflow progression.

### Updates & Snapshots

Updating a workflow entity:

1. Merges changes cascading child updates depending on the **write** option passed
2. Persists the new state
3. Creates a snapshot capturing the full entity state
4. Updates child entities explicitly if configured

Snapshots are immutable and version-safe.

### Querying Records
getOne

```
getOne(filter, options)
```
Supports:

1. Joining active children
2. Enforcing step-based view permissions
3. Resolving available actions for a role
4. Resolving read-only state dynamically

### getMany
```
getMany(filter, options)
```
Supports:
1. Recursive child joins
2. Advanced filtering (operators, ranges, nesting)
3. Role-based visibility enforcement

### Read-Only Resolution

Read-only status is computed at query time based on:
1. Current step
2. Step-level update permissions
3. User role

```
isReadOnly = !step.permissions.update.includes(role)
```

This allows the UI to reflect editability without duplicating logic.

### Aggregation
The method supports analytics-style aggregation queries:

```
aggregate(filter, {
  groupBy: ["currentStepKey"],
  aggregates: [{ fn: "COUNT", alias: "count" }]
})
```

Aggregation logic is isolated and should not be used for transactional operations.

## Child & Snapshot System

The engine includes a robust mechanism for handling nested child entities and immutable snapshots, ensuring full auditability and safe data evolution over time.

Purpose
1. Maintain historical accuracy of workflow records.
2. Enable rollback and reconstruction of any workflow state.
3. Support nested relationships without losing consistency.
4. Allow selective write control for child tables.

Child Entities

Child entities are dependent data tables linked to a parent workflow record. They represent subcomponents of a request, such as:
1. Line items in a request
2. Attachments or sub-tasks in a request

Child entities are defined via ChildConfig:

```
interface ChildConfig {
  repo: Repository<any>;           // TypeORM repository for child table
  snapshotRepo?: Repository<any>;  // Optional repository for snapshot storage
  foreignKey: string;              // Name of the key linking to the parent
  relation: string;                // Relation name for querying
  children?: ChildConfig[];        // Nested child configs for recursion
  write?: boolean;                 // Indicates if children can be modified
}
```

#### Key Features

1. Nested Children
- Supports recursive configurations, allowing multiple levels of nested data.
- Example: children → subChild → subSubChild.

2. Write Control
- write: false ensures child data is read-only and not updated during service operations.
- write: true allows creation and updates, with snapshots captured for each change.

3. Relation Handling
- relation matches the property name on the entity.
- Used in leftJoinAndSelect queries to include children in GET operations.

### Snapshots

Snapshots are immutable copies of entities and children at a specific point in time.

#### Behavior

1. Created on:
- Entity creation
- Entity updates
- Writable child updates

2. Versioning
- Child snapshots track a version number.
- On updates, existing active child records are marked inactive.
- New child records are assigned a new version.

3. Parent Linkage
- Each snapshot references the parent via the foreignKey.
- Ensures reconstruction of full entity state at any point in time.

#### Example Workflow
1. Parent Record Creation
- Extract children from payload.
- Save parent entity.
- Create snapshots for parent and writable children.

2. Parent Record Update
- Extract children and mark previous active child versions inactive.
- Save new child versions with incremented version.
- Create snapshots for parent and updated children.

3. Nested Children
- Snapshots propagate recursively for nested children.
- Each snapshot remains immutable, capturing the exact state at creation.

## Permissions & Access Control

The workflow engine supports granular, role-based access control (RBAC) at both step-level and transition-level, ensuring that users only see and act on what they are allowed to. All access rules are declared in the workflow JSON blueprint, keeping enforcement deterministic, transparent, and fully auditable.

### Step-Level Permissions

Each workflow step can optionally define which roles are allowed to view, create, or update the entity in that step:


```
{
  "key": "DRAFT",
  "name": "Draft",
  "permissions": {
    "view": ["CHAMP", "HEAD"],
    "create": ["CHAMP"],
    "update": ["CHAMP"]
  }
}
```
```
| Permission | Description                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------- |
| `view`     | Roles that can see this step when querying entities. If omitted, all roles can view.               |
| `create`   | Roles that can create new entities starting at this step.                                          |
| `update`   | Roles that can update entities currently in this step. Entities are read-only for all other roles. |
```

### Read-Only Enforcement

When retrieving entities via getOne or getMany, the service automatically exposes an isReadOnly flag based on the update permission for the current user role:

```
const entity = await workflowService.getOne({ id: 1 }, {
  userRole: 'Employee',
  includeReadOnly: true
});

console.log(entity.isReadOnly); // true if user cannot update in current step
```

The isReadOnly property allows UI layers to disable fields, buttons, or actions without querying additional permission endpoints.

### Transition-Level Permissions
Transitions can also define role-based permissions. These determine who can perform an action to move the workflow from one step to another:

```
{
  "fromStepKey": "HR_REVIEW",
  "toStepKey": "COMPLETED",
  "action": "approve",
  "permissions": ["Employee", "Manager", "HR"]
}
```

1. If permissions is omitted, the action is available to all roles.
2. Transition-level permissions are enforced at execution time by the service’s performAction method. Unauthorized users attempting the action will receive an error.

```
await workflowService.validateStepPermission(
  'CHAMP_REVIEW', 
  'CHAMP', 
  'update'
); // true if Employee can update in HR_REVIEW
```

### Role Visibility

Roles can also be used to filter which entities are visible:

```
const entities = await workflowService.getMany({}, {
  userRole: "Employee",
  enforceViewPermission: true
});
```

1. Only entities in steps that the role has **view** permission for will be returned.
2. If a role has no viewable steps, queries automatically return an empty set.

### Enforcement Philosophy
1. Declarative over procedural: All permissions are defined in the JSON blueprint, not hard-coded.
2. Immutable audit trail: Read-only enforcement ensures that users without update rights cannot modify historical workflow states.
3. Layered checks:
- Step-level view controls what the user can query.
- Step-level update determines read-only status.
- Transition-level permissions determine actionable transitions.
4. Service-enforced, not engine-enforced: The WorkflowEngine exposes permission data; the GenericWorkflowService enforces it against database operations.


## Adding a New Workflow

This guide describes all steps to add a new workflow type to the engine, including entities, snapshots, history, service, API, permissions, and JSON workflow metadata.

1. Define the Database Entities
### Main Workflow Entity

Create a new entity (e.g., ExpenseRequest) in /entities/<workflow>/.

Standard fields:
- id (primary key)
- status (workflow status)
- createdAt / updatedAt
- Workflow-specific fields

Relations:
- owner → User
- children → child entities

```
@Entity()
export class ExpenseRequest extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User)
  createdBy: User;

  @Column()
  currentStepKey: string;  

  @Column()
  status: string;   

  @ManyToOne(() => User)
  owner: User;

  @OneToMany(() => ExpenseChild, child => child.expenseRequest)
  children: ExpenseChild[];

  @OneToMany(() => ExpenseHistory, history => history.request)
  history: ExpenseHistory[];
}
```

### Child Entities
Child entities store structured sub-data.
- Include a foreign key to the parent workflow entity.
- Nested sub-children follow the same pattern.


```
@Entity()
export class ExpenseChild extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => ExpenseRequest, request => request.children)
  expenseRequest: ExpenseRequest;

  @Column()
  description: string;
}
```

### Snapshot Entities
Snapshots are a copy of the main entity and are immutable, used for audit/logging.
- One snapshot entity per workflow or child entity.

```
@Entity()
export class ExpenseSnapshot extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User)
  createdBy: User;

  @Column()
  currentStepKey: string;  

  @Column()
  status: string;

  @Column()
  parentId: string; // original record ID
}
```

### History Entity
Tracks all workflow actions and transitions.
- Includes: workflowId, userId, action, payload (optional), timestamp.

```
@Entity()
export class ExpenseHistory extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => ExpenseRequest, request => request.history)
  expenseRequest: ExpenseRequest;

  @Column()
  workflowId: string;
  
  @Column()
  fromStepKey: string;

  @Column()
  toStepKey: string;

  @ManyToOne(() => User)
  performedBy: User;

  @Column()
  action: string;

  @CreateDateColumn()
  timestamp: Date;
}
```

### Create the Workflow Service

Extend **GenericWorkflowService<YourWorkflowEntity>**.

1. Pass repositories for:
- Main entity
- User
- History
- Snapshot
- Children (with snapshots)

```
export class ExpenseRequestService extends GenericWorkflowService<ExpenseRequest> {
  constructor() {
    super(
      "expense",
      AppDataSource.getRepository(ExpenseRequest),
      AppDataSource.getRepository(User),
      AppDataSource.getRepository(ExpenseHistory),
      AppDataSource.getRepository(ExpenseSnapshot),
      "request",
      [
        {
          repo: AppDataSource.getRepository(ExpenseChild),
          snapshotRepo: AppDataSource.getRepository(ExpenseChildSnapshot),
          write: true,
          foreignKey: "expenseItem",
          relation: "children",
        }
      ]
    );
  }
}
```

### Workflow JSON Schema

Define workflow metadata, steps, actions, permissions, and child configurations.
1. Stored in **/workflows/<workflow>.json**
2. Drives UI, API validation, and workflow engine logic

```
{
    "workflowKey": "leave",
    "steps": [
      { "key": "DRAFT", "name": "Draft","permissions": { "view": ["Employee", "Manager"], "create": ["Employee"], "update": ["Employee"] }, "domainOwner": ["Employee"] },
      { "key": "MANAGER_REVIEW", "name": "Manager Review" },
      { "key": "HR_REVIEW", "name": "HR Review" },
      { "key": "COMPLETED", "name": "Completed" },
      { "key": "REJECTED", "name": "Rejected" }
    ],
    "transitions": [
      { "fromStepKey": "DRAFT", "toStepKey": "MANAGER_REVIEW", "action": "submit", "status": "submitted" },
      { "fromStepKey": "MANAGER_REVIEW", "toStepKey": "HR_REVIEW", "action": "approve" },
      { "fromStepKey": "HR_REVIEW", "toStepKey": "COMPLETED", "action": "approve", "status": "approved by HR", "permissions": ["Employee", "Manager", "HR"] },
      { "fromStepKey": "HR_REVIEW", "toStepKey": "CANCELED", "action": "cancel", "status": "canceled by HR", "permissions": ["Employee", "Manager", "HR"] },
      { "fromStepKey": "MANAGER_REVIEW", "toStepKey": "REJECTED", "action": "reject", "status": "rejected by HR" },
      { "fromStepKey": "HR_REVIEW", "toStepKey": "REJECTED", "action": "reject" }
    ]
  }
  
```

### Expose CRUD & Workflow APIs
```
| API                | Method | Endpoint                   | Service Method |
| ------------------ | ------ | -------------------------- | -------------- |
| Create workflow    | POST   | /api/<workflow>            | create         |
| Update workflow    | PATCH  | /api/<workflow>/:id        | update         |
| Get one workflow   | GET    | /api/<workflow>/:id        | getOne         |
| Get many workflows | GET    | /api/<workflow>            | getMany        |
| Perform action     | POST   | /api/<workflow>/:id/action | performAction  |
| Aggregate          | POST   | /api/<workflow>/aggregate  | aggregate      |
```


Authored by: Muhammad (muhammad) Ragialla
Date: 31/12/2025
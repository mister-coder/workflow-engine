# Generic Workflow Engine
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

## Design Notes
1. Blueprints are purely declarative
2. JSON encodes the Business Logic
4. Multiple workflows can coexist independently

## Blueprint JSON Example

 {

   "workflowKey": "leave",

   "steps": [

     { "key": "DRAFT", "name": "Draft" },

     { "key": "MANAGER_REVIEW", "name": "Manager Review" },

     { "key": "HR_REVIEW", "name": "HR Review" },

     { "key": "COMPLETED", "name": "Completed" },

     { "key": "REJECTED", "name": "Rejected" }

   ],

   "transitions": [

     { "fromStepKey": "DRAFT", "toStepKey": "MANAGER_REVIEW", "action": "submit" },

     { "fromStepKey": "MANAGER_REVIEW", "toStepKey": "HR_REVIEW", "action": "approve" },

     { "fromStepKey": "HR_REVIEW", "toStepKey": "COMPLETED", "action": "approve" },

     { "fromStepKey": "MANAGER_REVIEW", "toStepKey": "REJECTED", "action": "reject" },

     { "fromStepKey": "HR_REVIEW", "toStepKey": "REJECTED", "action": "reject" }

   ]

 }


## API Endpoints
Method	Endpoint	Description
- GET	/workflows/:key	Get workflow blueprint
- POST	/workflows/:key/init	Create a new workflow instance
- POST	/workflows/:key/next	Trigger transition on an instance
- GET	/workflows/:key/history/:id	Get transition history

## Features
- JSON-powered state machines

- History tracking of transitions and updates

- Side effect hooks before/after transitions

- Easy to visualize and debug

Type-safe with TypeScript

## Diagram of a State Machine (Visual Representation)

---

[DRAFT] --submit--> [MANAGER_REVIEW] --approve--> [HR_REVIEW] --approve--> [COMPLETED]
---
        \                          \ --reject--> [REJECTED]        
---
         \ --reject--> [REJECTED]


## Components Overview
### WorkflowEngine
This is the core logic that reads a JSON blueprint and handles:

- Getting valid actions from a current step
- Getting the next step for a given action
- Getting the initial step
- Validation of transitions

Use it when you want to manipulate workflows dynamically from JSON.

### BaseWorkflowService
This is a generic, reusable service class that handles:

- Performing transitions (submit, approve, reject, etc.)
- Tracking transition and field update history
- Triggering side effects before/after actions
- DRY logic that works across different workflow types
- You subclass this when building services for specific workflows (e.g., LeaveRequest).

### WorkflowService
This is a concrete service that extends BaseService and plugs in the workflow blueprint, entity, and history logic for a specific use case like:

`
export class LeaveRequestService extends BaseService<LeaveRequest> {
  constructor() {
    super(LeaveRequest, leaveWorkflowBlueprint);
  }
}
`

Use this to add custom behavior per workflow.

### How to Add a New Workflow
- Create JSON blueprint in blueprints/
- Create an Entity (e.g., LeaveRequest.ts)
- Create a Service that extends BaseService
- Add API routes (optional)

Done! You now have a full workflow engine for your entity.

### Example Usage
`
const service = new LeaveRequestService();

await service.transition(123, 'approve', currentUser);
`
<!-- 🔄 Side Effects
Side effects can be registered and triggered:

Before transition (e.g., validate form)

After transition (e.g., send notification)

You can plug these into the service for better separation of concerns. -->

🧩 Future Features
- Complete log history
- Role-based access control
- Side effects
- Cycles handling
- Conditional logic per step/action
- Notifications and escalations
- Scheduled transitions
- Workflow visual builder (graph editor)
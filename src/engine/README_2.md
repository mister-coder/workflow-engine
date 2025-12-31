# Generic Workflow Engine
A lightweight, class-based declarative state machine engine for building customizable, multi-user approval workflows.
All workflow behavior is defined externally using JSON blueprints, making workflows portable, editable, and independent of application code.

The engine is designed to power request-driven processes and any multi-step lifecycle requiring deterministic transitions and auditability.

## What Is This?
The Generic Workflow Engine executes request flows using a finite state machine model defined declaratively.

Rather than hard-coding workflow logic, each workflow is described using a JSON blueprint that declares:

1. The valid steps in the process

2. The allowed transitions between those steps

3. The actions that trigger each transition

The engine interprets this declaration at runtime and enforces it consistently.


## State Machine Model
### Basic Terms:
A workflow consists of steps (states) and transitions (actions).
For any given state and action, the next state is deterministic. If no transition is defined, the action is rejected.

This guarantees that requests cannot skip steps or move to undefined states.

### Example:
This example from leave.json blueprint defines a state machine like this:

- [DRAFT] --submit--> [MANAGER_REVIEW]
- [MANAGER_REVIEW] --approve--> [HR_REVIEW]
- [HR_REVIEW] --approve--> [COMPLETED]
- [MANAGER_REVIEW] --reject--> [REJECTED]
- [HR_REVIEW] --reject--> [REJECTED]
The system enforces that only valid transitions (defined in the blueprint) are allowed.

The workflow cannot jump between unrelated states.

## Why a State Machine?
Using a state machine brings the following benefits:

- Predictable: Every state and transition is explicitly defined.

- Auditable: Transition history can be tracked clearly.

- Safe: Invalid actions are automatically blocked.

- Flexible: You can model simple or complex flows using the same JSON structure.

- Visualizable: You can render the graph easily using tools like Mermaid or D3.js.

## Folder Structure
.

├── blueprints/                # JSON files defining each workflow

│   └── leave.json             # Example: leave request workflow

├── src/

│   ├── engine/                # Core state machine engine

│   │   └── WorkflowEngine.ts

│   ├── services/              # Workflow orchestration (e.g. transitions, history)

│   ├── controllers/           # Express handlers

│   ├── routes/                # API endpoints

│   ├── models/                # TypeORM entities: Request, History, etc.

│   ├── utils/                 # Utility functions (e.g., load blueprint)

│   ├── app.ts                 # Express app setup

│   └── server.ts              # App entry point

├── workflow.types.ts          # Shared types/interfaces

└── README.md

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
# Generic Workflow Engine (Node.js + JSON Blueprints)
A lightweight, class-based state machine engine for handling customizable, multi-user approval workflows. All workflow logic is defined externally in JSON blueprints — making it highly portable, editable, and environment-agnostic.


## What Is This?
The Generic Workflow Engine powers request flows — such as leave requests, approvals, and any multi-step process — using a finite state machine.


Each state is a step in the process (e.g., "DRAFT", "MANAGER_REVIEW"), and transitions define how to move from one state to another using an action (e.g., "submit", "approve", "reject").


## Understanding the State Machine
### Basic Terms:
Concept	Description

- State	A named step in a process (e.g., "DRAFT", "HR_REVIEW").
- Transition	A rule that describes movement from one state to another via an action.
- Action	A trigger that causes a state transition (e.g., "submit", "approve").
- Initial State	The starting point of the workflow.
- Final State(s)	One or more states where no further transitions exist.

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
🧱 Blueprint JSON Example

- {
-   "workflowKey": "leave",
-   "steps": [
-     { "key": "DRAFT", "name": "Draft" },
-     { "key": "MANAGER_REVIEW", "name": "Manager Review" },
-     { "key": "HR_REVIEW", "name": "HR Review" },
-     { "key": "COMPLETED", "name": "Completed" },
-     { "key": "REJECTED", "name": "Rejected" }
-   ],
-   "transitions": [
-     { "fromStepKey": "DRAFT", "toStepKey": "MANAGER_REVIEW", "action": "submit" },
-     { "fromStepKey": "MANAGER_REVIEW", "toStepKey": "HR_REVIEW", "action": "approve" },
-     { "fromStepKey": "HR_REVIEW", "toStepKey": "COMPLETED", "action": "approve" },
-     { "fromStepKey": "MANAGER_REVIEW", "toStepKey": "REJECTED", "action": "reject" },
-     { "fromStepKey": "HR_REVIEW", "toStepKey": "REJECTED", "action": "reject" }
-   ]
- }


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

[DRAFT] --submit--> [MANAGER_REVIEW] --approve--> [HR_REVIEW] --approve--> [COMPLETED]
        \                          \--reject--> [REJECTED]
         \--reject--> [REJECTED]

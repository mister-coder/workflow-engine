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

Examples:
This example from leave.json blueprint defines a state machine like this:

css
Copy
Edit
[DRAFT] --submit--> [MANAGER_REVIEW]
[MANAGER_REVIEW] --approve--> [HR_REVIEW]
[HR_REVIEW] --approve--> [COMPLETED]
[MANAGER_REVIEW] --reject--> [REJECTED]
[HR_REVIEW] --reject--> [REJECTED]
The system enforces that only valid transitions (defined in the blueprint) are allowed.

The workflow cannot jump between unrelated states.

✅ Why a State Machine?
Using a state machine brings the following benefits:

Predictable: Every state and transition is explicitly defined.

Auditable: Transition history can be tracked clearly.

Safe: Invalid actions are automatically blocked.

Flexible: You can model simple or complex flows using the same JSON structure.

Visualizable: You can render the graph easily using tools like Mermaid or D3.js.

📁 Folder Structure
bash
Copy
Edit
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
json
Copy
Edit
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
🛠 Installation
bash
Copy
Edit
git clone https://github.com/your-org/generic-workflow-engine.git
cd generic-workflow-engine
npm install
🚀 Run the App
bash
Copy
Edit
npm run dev   # starts Express server (e.g. http://localhost:3000)
🧪 API Endpoints
Method	Endpoint	Description
GET	/workflows/:key	Get workflow blueprint
POST	/workflows/:key/init	Create a new workflow instance
POST	/workflows/:key/next	Trigger transition on an instance
GET	/workflows/:key/history/:id	Get transition history

✨ Features
JSON-powered state machines

History tracking of transitions and updates

Side effect hooks before/after transitions

Easy to visualize and debug

Type-safe with TypeScript

🧠 Want to Visualize?
You can convert the JSON to a graph using:

Mermaid.js

Graphviz

D3.js

Example Mermaid diagram:

lua
Copy
Edit
stateDiagram-v2
    DRAFT --> MANAGER_REVIEW: submit
    MANAGER_REVIEW --> HR_REVIEW: approve
    HR_REVIEW --> COMPLETED: approve
    MANAGER_REVIEW --> REJECTED: reject
    HR_REVIEW --> REJECTED: reject
🧑‍💻 Contributing
Feel free to open issues or submit PRs. Please keep blueprints and transitions deterministic.

📄 License
MIT — use freely, modify confidently!

Let me know if you want this README exported to a file or if you'd like a Swagger/OpenAPI spec to accompany your API.








You said:
add a diagram of the state machine


ChatGPT said:
Here’s an updated README.md section with a diagram of the state machine using Mermaid.js — a simple way to visualize workflows in markdown.

🧭 State Machine Diagram
This is a visual representation of the example workflow from leave.json.

You can render this diagram using Mermaid Live Editor or compatible markdown tools (like VSCode with a Mermaid plugin, GitHub-flavored markdown viewers, or tools like Obsidian).

<details> <summary>🧠 View Mermaid Diagram</summary>
mermaid
Copy
Edit
stateDiagram-v2
    direction LR
    [*] --> DRAFT
    DRAFT --> MANAGER_REVIEW: submit
    MANAGER_REVIEW --> HR_REVIEW: approve
    HR_REVIEW --> COMPLETED: approve
    MANAGER_REVIEW --> REJECTED: reject
    HR_REVIEW --> REJECTED: reject
</details>
🗺️ Legend:
States: DRAFT, MANAGER_REVIEW, etc.

Transitions: arrows showing actions like submit, approve, reject

[*]: Initial entry point (the starting state)

You can generate more diagrams by converting any workflow JSON into this format using a small script or directly mapping the transitions.


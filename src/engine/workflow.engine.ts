import * as fs from "fs";
import * as path from "path";

/**
 * Type for a single step in a workflow
 */
export interface WorkflowStep {
  key: string;      // Unique code for the step (e.g. DRAFT)
  name: string;     // Human-readable name
}

/**
 * Type for a transition between steps
 */
export interface WorkflowTransition {
  fromStepKey: string;
  toStepKey: string;
  action: string;
  status?: string;
}

/**
 * The entire workflow blueprint as stored in JSON
 */
export interface WorkflowDefinition {
  workflowKey: string;
  steps: WorkflowStep[];
  transitions: WorkflowTransition[];
}

/**
 * Generic workflow engine capable of reading JSON blueprints
 */
export class WorkflowEngine {
  private workflow: WorkflowDefinition;

  constructor(workflowKey: string) {
    this.workflow = this.loadWorkflowBlueprint(workflowKey);
  }

  /**
   * Loads a JSON blueprint file from disk
   * @param workflowKey e.g. 'leave'
   */
  private loadWorkflowBlueprint(workflowKey: string): WorkflowDefinition {
    const filePath = path.join(__dirname, "..", "workflows", `${workflowKey}.workflow.json`);
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  }

  /**
   * Get all allowed transitions from a given step
   */
  getAvailableTransitions(currentStepKey: string): WorkflowTransition[] {
    return this.workflow.transitions.filter(
      t => t.fromStepKey === currentStepKey
    );
  }

  // Get initial step key
  getInitialStepKey(): any | null 
  {
    return this.workflow.steps[0] ?? null;
  }

  /**
   * Determine the next step for a given action
   * Returns null if the action is invalid
   */
  getNextStepKey(currentStepKey: string, action: string): string | null {
    const transition = this.workflow.transitions.find(
      t => t.fromStepKey === currentStepKey && t.action === action
    );
    return transition?.toStepKey ?? null;
  }

  /**
   * 
   * Determine the transition status for a given action
   */
  getTransition(fromStepKey: string, action: string) {
    return this.workflow.transitions.find(
      t => t.fromStepKey === fromStepKey && t.action === action
    );
  }

  /**
   * Resolve a step key to its human-readable name
   */
  getStepName(stepKey: string): string {
    return this.workflow.steps.find(s => s.key === stepKey)?.name || stepKey;
  }
}

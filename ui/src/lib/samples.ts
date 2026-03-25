export interface WorkflowSample {
  id: string;
  name: string;
  description: string;
  yaml: string;
  path?: string;
}

const cstackAutoplanYaml = `save-autoplan-brief:
  input: STDIN
  model: NA
  action:
    - Pass through the planning brief unchanged.
  output: examples/c-stack/artifacts/autoplan/brief.md

load-brief-for-ceo-review:
  input: examples/c-stack/artifacts/autoplan/brief.md
  model: NA
  action:
    - Pass through the planning brief unchanged.
  output: STDOUT

run-ceo-review:
  input: STDIN
  process:
    workflow_file: examples/c-stack/plan-ceo-review.yaml

save-ceo-review:
  input: STDIN
  model: NA
  action:
    - Pass through the CEO review unchanged.
  output: examples/c-stack/artifacts/autoplan/ceo-review.md

load-brief-for-eng-review:
  input: examples/c-stack/artifacts/autoplan/brief.md
  model: NA
  action:
    - Pass through the planning brief unchanged.
  output: STDOUT

run-eng-review:
  input: STDIN
  process:
    workflow_file: examples/c-stack/plan-eng-review.yaml

save-eng-review:
  input: STDIN
  model: NA
  action:
    - Pass through the engineering review unchanged.
  output: examples/c-stack/artifacts/autoplan/eng-review.md

load-brief-for-design-review:
  input: examples/c-stack/artifacts/autoplan/brief.md
  model: NA
  action:
    - Pass through the planning brief unchanged.
  output: STDOUT

run-design-review:
  input: STDIN
  process:
    workflow_file: examples/c-stack/plan-design-review.yaml

save-design-review:
  input: STDIN
  model: NA
  action:
    - Pass through the design review unchanged.
  output: examples/c-stack/artifacts/autoplan/design-review.md

synthesize-autoplan:
  input:
    - examples/c-stack/artifacts/autoplan/brief.md
    - examples/c-stack/artifacts/autoplan/ceo-review.md
    - examples/c-stack/artifacts/autoplan/eng-review.md
    - examples/c-stack/artifacts/autoplan/design-review.md
  model: claude-code
  action: |
    Synthesize the planning brief plus the CEO, engineering, and design reviews
    into a single operating plan.
  output:
    - examples/c-stack/artifacts/autoplan/final-plan.md
    - STDOUT`;

const cstackReviewYaml = `save-review-input:
  input: STDIN
  model: NA
  action:
    - Pass through the review input unchanged.
  output: examples/c-stack/artifacts/review/input.md

parallel-process:
  claude-review:
    input: examples/c-stack/artifacts/review/input.md
    model: claude-code
    action: |
      Review this material for bugs, regressions, and missing tests.
    output: examples/c-stack/artifacts/review/claude-review.md

  gemini-review:
    input: examples/c-stack/artifacts/review/input.md
    model: gemini-cli
    action: |
      Review this material for reliability, observability, and performance concerns.
    output: examples/c-stack/artifacts/review/gemini-review.md

  codex-review:
    input: examples/c-stack/artifacts/review/input.md
    model: openai-codex
    action: |
      Review this material for implementation risks and maintainability issues.
    output: examples/c-stack/artifacts/review/codex-review.md

synthesize-review:
  input:
    - examples/c-stack/artifacts/review/input.md
    - examples/c-stack/artifacts/review/claude-review.md
    - examples/c-stack/artifacts/review/gemini-review.md
    - examples/c-stack/artifacts/review/codex-review.md
  model: claude-code
  action: |
    Synthesize these review notes into one actionable review.
  output:
    - examples/c-stack/artifacts/review/final-review.md
    - STDOUT`;

const architecturePlanningYaml = `parallel-process:
  claude-system-design:
    input: STDIN
    model: claude-code
    action: |
      Analyze the requirements and provide a system design.
    output: $CLAUDE_SYSTEM_DESIGN

  gemini-patterns:
    input: STDIN
    model: gemini-cli
    action: |
      Recommend patterns, technologies, and best practices.
    output: $GEMINI_PATTERNS

  codex-implementation:
    input: STDIN
    model: openai-codex
    action: |
      Analyze implementation structure and testing strategy.
    output: $CODEX_IMPLEMENTATION

synthesize-architecture:
  input: |
    Claude: $CLAUDE_SYSTEM_DESIGN
    Gemini: $GEMINI_PATTERNS
    Codex: $CODEX_IMPLEMENTATION
  model: claude-code
  action: |
    Synthesize the architecture analyses into one cohesive plan.
  output: STDOUT`;

const creatorCheckerYaml = `loops:
  feature-creator:
    name: feature-creator
    stateful: true
    max_iterations: 3
    checkpoint_interval: 1
    output_state: $CREATOR_RESULT
    steps:
      - implement:
          input: NA
          model: claude-code
          action: |
            Implement the requested feature.
          output: STDOUT

  code-checker:
    name: code-checker
    depends_on: [feature-creator]
    input_state: $CREATOR_RESULT
    stateful: true
    max_iterations: 1
    exit_condition: pattern_match
    exit_pattern: "^(PASS|FAIL)"
    steps:
      - review:
          input: STDIN
          model: claude-code
          action: |
            Validate the implementation and output PASS or FAIL.
          output: STDOUT

workflow:
  creator:
    type: loop
    loop: feature-creator
    role: creator

  checker:
    type: loop
    loop: code-checker
    role: checker
    validates: creator
    on_fail: rerun_creator`;

const cstackPlanCeoYaml = `save-ceo-review-brief:
  input: STDIN
  model: NA
  action:
    - Pass through the planning brief unchanged.
  output: examples/c-stack/artifacts/plan-ceo-review/brief.md

parallel-process:
  claude-ceo-strategy:
    input: examples/c-stack/artifacts/plan-ceo-review/brief.md
    model: claude-code
    action: |
      You are the CEO reviewer inside c-stack.

      Review this plan for ambition, clarity, and ruthless prioritization.
    output: examples/c-stack/artifacts/plan-ceo-review/claude-ceo.md

  gemini-business-lens:
    input: examples/c-stack/artifacts/plan-ceo-review/brief.md
    model: gemini-cli
    action: |
      You are the business and GTM reviewer inside c-stack.

      Review this plan for market leverage and business impact.
    output: examples/c-stack/artifacts/plan-ceo-review/gemini-business.md

  codex-scope-lens:
    input: examples/c-stack/artifacts/plan-ceo-review/brief.md
    model: openai-codex
    action: |
      You are the scope-and-delivery reviewer inside c-stack.

      Review this plan for execution realism.
    output: examples/c-stack/artifacts/plan-ceo-review/codex-scope.md

synthesize-ceo-review:
  input:
    - examples/c-stack/artifacts/plan-ceo-review/brief.md
    - examples/c-stack/artifacts/plan-ceo-review/claude-ceo.md
    - examples/c-stack/artifacts/plan-ceo-review/gemini-business.md
    - examples/c-stack/artifacts/plan-ceo-review/codex-scope.md
  model: claude-code
  action: |
    Synthesize these notes into a single CEO review memo.
  output:
    - examples/c-stack/artifacts/plan-ceo-review/final-review.md
    - STDOUT`;

const cstackPlanEngYaml = `save-eng-review-brief:
  input: STDIN
  model: NA
  action:
    - Pass through the planning brief unchanged.
  output: examples/c-stack/artifacts/plan-eng-review/brief.md

parallel-process:
  claude-architecture-review:
    input: examples/c-stack/artifacts/plan-eng-review/brief.md
    model: claude-code
    action: |
      You are the engineering manager inside c-stack.

      Review this plan for system boundaries and technical risk.
    output: examples/c-stack/artifacts/plan-eng-review/claude-architecture.md

  gemini-platform-review:
    input: examples/c-stack/artifacts/plan-eng-review/brief.md
    model: gemini-cli
    action: |
      You are the platform and systems reviewer inside c-stack.

      Review this plan for scalability, observability, and production readiness.
    output: examples/c-stack/artifacts/plan-eng-review/gemini-platform.md

  codex-delivery-review:
    input: examples/c-stack/artifacts/plan-eng-review/brief.md
    model: openai-codex
    action: |
      You are the delivery-focused principal engineer inside c-stack.

      Review this plan for implementation sequencing.
    output: examples/c-stack/artifacts/plan-eng-review/codex-delivery.md

synthesize-eng-review:
  input:
    - examples/c-stack/artifacts/plan-eng-review/brief.md
    - examples/c-stack/artifacts/plan-eng-review/claude-architecture.md
    - examples/c-stack/artifacts/plan-eng-review/gemini-platform.md
    - examples/c-stack/artifacts/plan-eng-review/codex-delivery.md
  model: claude-code
  action: |
    Synthesize these notes into a single engineering review.
  output:
    - examples/c-stack/artifacts/plan-eng-review/final-review.md
    - STDOUT`;

const cstackPlanDesignYaml = `save-design-review-brief:
  input: STDIN
  model: NA
  action:
    - Pass through the planning brief unchanged.
  output: examples/c-stack/artifacts/plan-design-review/brief.md

parallel-process:
  claude-product-design:
    input: examples/c-stack/artifacts/plan-design-review/brief.md
    model: claude-code
    action: |
      You are the product design reviewer inside c-stack.

      Review this plan for product taste and user clarity.
    output: examples/c-stack/artifacts/plan-design-review/claude-design.md

  gemini-accessibility-design:
    input: examples/c-stack/artifacts/plan-design-review/brief.md
    model: gemini-cli
    action: |
      You are the UX systems reviewer inside c-stack.

      Review this plan for accessibility, consistency, and multi-device behavior.
    output: examples/c-stack/artifacts/plan-design-review/gemini-ux.md

  codex-ui-implementation:
    input: examples/c-stack/artifacts/plan-design-review/brief.md
    model: openai-codex
    action: |
      You are the frontend implementation reviewer inside c-stack.

      Review this plan for component-level execution quality.
    output: examples/c-stack/artifacts/plan-design-review/codex-ui.md

synthesize-design-review:
  input:
    - examples/c-stack/artifacts/plan-design-review/brief.md
    - examples/c-stack/artifacts/plan-design-review/claude-design.md
    - examples/c-stack/artifacts/plan-design-review/gemini-ux.md
    - examples/c-stack/artifacts/plan-design-review/codex-ui.md
  model: claude-code
  action: |
    Synthesize these notes into a single design review.
  output:
    - examples/c-stack/artifacts/plan-design-review/final-review.md
    - STDOUT`;

export const workflowSamples: WorkflowSample[] = [
  {
    id: "cstack-autoplan",
    name: "c-stack autoplan",
    description: "A composed review flow that runs CEO, engineering, and design reviews.",
    yaml: cstackAutoplanYaml,
    path: "examples/c-stack/autoplan.yaml",
  },
  {
    id: "cstack-review",
    name: "c-stack review",
    description: "A parallel multi-agent review stage with a synthesis step.",
    yaml: cstackReviewYaml,
    path: "examples/c-stack/review.yaml",
  },
  {
    id: "architecture-planning",
    name: "Architecture planning",
    description: "Parallel design analysis followed by synthesis.",
    yaml: architecturePlanningYaml,
    path: "examples/multi-agent/architecture-planning.yaml",
  },
  {
    id: "creator-checker",
    name: "Creator checker",
    description: "A named loop orchestration pattern with creator/checker validation.",
    yaml: creatorCheckerYaml,
    path: "examples/agentic-loop/creator-checker.yaml",
  },
];

export const workflowSampleLibrary: Record<string, string> = {
  "examples/agentic-loop/creator-checker.yaml": creatorCheckerYaml,
  "examples/c-stack/autoplan.yaml": cstackAutoplanYaml,
  "examples/c-stack/plan-ceo-review.yaml": cstackPlanCeoYaml,
  "examples/c-stack/plan-design-review.yaml": cstackPlanDesignYaml,
  "examples/c-stack/plan-eng-review.yaml": cstackPlanEngYaml,
  "examples/c-stack/review.yaml": cstackReviewYaml,
  "examples/multi-agent/architecture-planning.yaml": architecturePlanningYaml,
};

import { describe, expect, it } from 'vitest';
import { validateMermaidStateDiagram } from '../verify-architecture.js';

describe('validateMermaidStateDiagram', () => {
  it('should reject content completely missing stateDiagram-v2', () => {
    const content = '# Title\nSome documentation text without diagram.';
    const errors = validateMermaidStateDiagram('modules/test/flow.docs.md', content);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('missing mandatory Mermaid state diagram (stateDiagram-v2)');
  });

  it('should reject content with stateDiagram-v2 keyword but no fenced mermaid block', () => {
    const content = '# Title\nHere is stateDiagram-v2 mentioned in prose.';
    const errors = validateMermaidStateDiagram('modules/test/flow.docs.md', content);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('contains no valid fenced ```mermaid code block');
  });

  it('should reject state diagram missing initial entry transition', () => {
    const content = `# Title
\`\`\`mermaid
stateDiagram-v2
    StateA --> StateB : next
    StateB --> StateC : confirm
    StateC --> [*] : done
\`\`\`
`;
    const errors = validateMermaidStateDiagram('modules/test/flow.docs.md', content);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('missing initial entry transition ([*] -->)'))).toBe(true);
  });

  it('should reject state diagram missing terminal exit transition', () => {
    const content = `# Title
\`\`\`mermaid
stateDiagram-v2
    [*] --> StateA : start
    StateA --> StateB : next
    StateB --> StateC : process
\`\`\`
`;
    const errors = validateMermaidStateDiagram('modules/test/flow.docs.md', content);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('missing terminal transition (--> [*])'))).toBe(true);
  });

  it('should reject state diagram with fewer than 3 transitions', () => {
    const content = `# Title
\`\`\`mermaid
stateDiagram-v2
    [*] --> StateA : start
    StateA --> [*] : done
\`\`\`
`;
    const errors = validateMermaidStateDiagram('modules/test/flow.docs.md', content);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('must contain at least 3 state transitions'))).toBe(true);
  });

  it('should reject state diagram with unbalanced braces in sub-states', () => {
    const content = `# Title
\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle
    state InProgress {
        Prompt --> Action
    Idle --> InProgress : start
    InProgress --> [*] : done
\`\`\`
`;
    const errors = validateMermaidStateDiagram('modules/test/flow.docs.md', content);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('unbalanced sub-state braces'))).toBe(true);
  });

  it('should accept a valid stateDiagram-v2 with >= 3 transitions, entry and exit', () => {
    const content = `# Title
## State Machine
\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle: initiate
    Idle --> Prompt: request input
    Prompt --> Confirm: valid input
    Confirm --> Completed: user confirms
    Completed --> [*]: terminate
\`\`\`
`;
    const errors = validateMermaidStateDiagram('modules/test/flow.docs.md', content);

    expect(errors).toHaveLength(0);
  });

  it('should accept a valid stateDiagram-v2 with nested sub-states and balanced braces', () => {
    const content = `# Flow Documentation
\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> InProgress : /command
    
    state InProgress {
        [*] --> PromptInput
        PromptInput --> Validating : input
        Validating --> PromptInput : retry
        Validating --> ReviewCard : ok
    }
    
    ReviewCard --> Success : confirm
    ReviewCard --> Cancelled : cancel
    Success --> [*]
    Cancelled --> [*]
\`\`\`
`;
    const errors = validateMermaidStateDiagram('modules/test/flow.docs.md', content);

    expect(errors).toHaveLength(0);
  });
});

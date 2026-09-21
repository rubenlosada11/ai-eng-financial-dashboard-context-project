# Agent Guidance

Agents working on this project **must**:

- Look for **work instructions and rules** in the directory:  
  `./.agents/rules`

- Look for available **agent skills** in the directory:  
  `./.agents/skills`

- Look for **community skills installed with `npx skills`** (project scope, pinned in `skills-lock.json`) in:  
  `./.claude/skills`

- Look for **project-specific skills** written for this repository in:  
  `./.skills`  
  _(Claude Code does not auto-discover this directory: read the `SKILL.md` and follow it. Start with `./.skills/dashboard-pre-merge-qa/SKILL.md` before opening or merging a PR.)_

- Look for the **project memory bank** in:  
  `./memory-bank`  
  _(if the directory exists)_

Before taking action (analyzing code, modifying files, or generating outputs), always review the latest files in these locations to ensure compliance with project conventions, context, and operational constraints.

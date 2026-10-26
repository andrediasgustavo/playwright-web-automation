---
description: Split a QA goal across parallel subagents
agent: qa-lead
---

Break this goal into independent parallel tasks and execute them: $ARGUMENTS

Follow the `parallel-agent-orchestration` skill.

1. Produce a short plan with disjoint file ownership per task.
2. Launch the tasks with the `qa_parallel_agents` tool, choosing the cheapest
   adequate tier for each (`qa_pick_model` if unsure).
3. Integrate the results yourself and run the suite once with `qa_run_tests`.
4. Report what changed, test results, and any remaining risk.

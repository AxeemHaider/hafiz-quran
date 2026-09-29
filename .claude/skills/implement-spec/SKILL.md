---
name: implement-spec
description: "Implement the result of /to-spec and /to-tickets in code."
disable-model-invocation: true
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

Read the issue tracker from `docs/agents/issue-tracker.md`.

The goal is the entire spec implemented on a single **integration branch**, merged into `main` and pushed, with every ticket closed.

**Never open a pull request** — not a draft, not at the end. This repo lands work by merging the integration branch into `main` and pushing. Because no PR closes the issues, close each ticket and the spec explicitly with `gh issue close`.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

**Implementer subagents** should be run in the background where possible for maximum concurrency.

## Steps

1. Read the spec and tickets to understand the task graph.

2. (optional) Use an **exploration subagent** to conduct any exploration required by the tickets - relevant codebase files or external documentation. Ensure the exploration subagent can save files - it should save its markdown notes in a directory outside the repo, accessible by all future subagents. This lets **implementer subagents** focus on implementation rather than exploration.

3. Create the integration branch off an up-to-date `main` (`git pull` first).

4. Use **implementer subagents** to implement each ticket, each in its own worktree on its own branch. Each implementer subagent:
   - confirms its worktree is based on the integration branch before starting, and resets onto it if not;
   - calls the Skill tool with `tdd` to build the ticket;
   - merges the integration branch tip into its own branch before reporting done

5. Once an **implementer subagent** completes, merge its work to the integration branch with a **merger subagent**.

6. If this changes the **frontier** of available tickets, kick off more **implementer subagents** to work on the new tickets. This allows for maximum concurrency.

7. Once all tickets are complete, call the Skill tool with `code-review` on the integration branch. Fix all issues raised by the code review in a single **implementer subagent**.

8. Run `npx expo lint` and `npx tsc --noEmit` on the integration branch and fix any failures. Then land it: switch to `main`, `git pull`, merge the integration branch (fast-forward if possible), and `git push`. Every commit ends with the attribution trailer from the system reminder.

9. Close each ticket with `gh issue close <n> --comment "..."` naming the commit(s) on `main` that resolved it, then close the spec the same way.

10. Clean up all **implementer subagent** worktrees and delete the merged ticket branches and integration branch locally.

# Stacked pull request demo

This documentation-only demo shows how two small pull requests can be reviewed in sequence in the Asteroid Shooter repository.

## Stack

1. **Overview:** adds this document and targets `main`.
2. **Review checklist:** adds `STACKED-PR-REVIEW.md` and targets the overview branch.

The second branch includes the first branch's commit. Its pull request shows only the additional checklist because its base is the overview branch.

## Review and merge order

Review the overview first, then the checklist. Both pull requests are drafts for demonstration purposes.

If you choose to merge the demo, merge the overview first. Then retarget the checklist pull request to `main` and verify its diff before merging. If the overview was squash-merged or rebased, rebase the checklist's own commit onto `main` to avoid carrying the original overview commit into the diff.

These changes do not affect either game's behavior.

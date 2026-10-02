# Stacked PR review checklist

Use this checklist with the [stack overview](STACKED-PR-DEMO.md).

## Before merging

- [ ] Confirm the overview PR targets `main`.
- [ ] Confirm the checklist PR targets the overview branch.
- [ ] Confirm the overview PR adds only `STACKED-PR-DEMO.md`.
- [ ] Confirm the checklist PR's Files changed tab adds only this checklist.
- [ ] Read both documents and confirm no game files changed.

## If merging the demo

- [ ] Mark the overview PR ready and merge it first.
- [ ] Retarget the checklist PR to `main`.
- [ ] If needed after a squash or rebase merge, rebase only the checklist commit onto `main`.
- [ ] Verify that the remaining diff contains only this checklist.
- [ ] Mark the checklist PR ready and merge it.

The demo can also be closed without merging.

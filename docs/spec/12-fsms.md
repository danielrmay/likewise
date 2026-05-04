# State Machines

This chapter specifies the lifecycle state machines for the
record types whose transitions are non-trivial: claims,
episodes, suggested actions, jobs, and node registrations. The
job FSM was already specified in
[Mesh Coordination](09-mesh-coordination.md#2-the-job-state-machine);
this chapter restates it for completeness.

For each FSM:

- States are listed with a brief description.
- Transitions are listed with the operation that causes them and
  any normative constraints.
- Cascading effects on other records are specified.

## 1. Claim FSM

A claim's lifecycle is the most consequential FSM in the
protocol because user-visible recommendations depend on whether
the underlying claims are believed.

### 1.1 States

| State | Meaning |
|-------|---------|
| `Hint` | Initial low-confidence guess. Not surfaced to the user. |
| `Claim` | The system is operating on this as a working belief. |
| `Fact` | User-confirmed. Frozen against subsequent automatic invalidation. |
| `Disputed` | The system has conflicting claims about the same subject and predicate; surfacing requires resolution. |
| `Rejected` | The user (or downstream evidence) has invalidated this claim. |
| `Superseded` | Replaced by a newer claim. |
| `Stale` | A supporting source was invalidated; the claim's evidential basis no longer holds. |

### 1.2 Transitions

| From | To | Cause | Constraint |
|------|----|----|----------|
| (creation) | `Hint` or `Claim` | `CreateClaim` op | Initial status. |
| `Hint` | `Claim` | `UpdateClaimStatus` | Confidence threshold passed. |
| `Claim` | `Fact` | `UserAssert(Confirm)` | User-authored. The claim is **frozen** — subsequent non-user `UpdateClaimStatus` ops MUST NOT change its status. |
| `Claim` | `Rejected` | `UserAssert(Reject)` | Triggers the cascade in Section 1.3. |
| `Claim` | `Disputed` | `UpdateClaimStatus` | Used when a conflicting claim of the same subject and predicate exists. |
| any non-`Fact` | `Superseded` | `SupersedeClaim` | The replacement claim's `claim_id` MUST already be on the log. |
| any non-`Fact` | `Stale` | derivation cascade | Triggered by `TombstoneEvidence` of a supporting evidence record or `Reject` of a supporting claim. |

### 1.3 Cascade on rejection

When a claim transitions to `Rejected` via a user assertion, the
implementation MUST traverse the derivation DAG forward and
invalidate every record that transitively depended on the
rejected claim:

- Dependent claims transition to `Stale`.
- Dependent episodes transition to `Stale` (Section 2).
- Dependent suggested actions transition to `Rejected`
  (Section 3).
- Dependent inference snapshots are tagged stale; their
  artefacts MAY be evicted on the next eviction pass.

The cascade is part of the same logical op apply (per I-8 in
[Invariants](11-invariants.md)).

### 1.4 Frozen-fact immunity

A claim with status `Fact` is **frozen**. The following
constraints apply:

- A non-user-authored op (`UpdateClaimStatus`,
  `UpdateClaimConfidence`, `SupersedeClaim`) targeting a
  frozen claim MUST be rejected.
- A `TombstoneEvidence` op MAY cascade into a frozen claim
  (Section 1.3) only if the op is itself authored by a node
  with user-assertion authority. Otherwise the cascade
  stops at the frozen claim's boundary.
- A `UserAssert(Reject)` op MAY override frozen state — the
  user retains the authority to change their mind.

## 2. Episode FSM

### 2.1 States

| State | Meaning |
|-------|---------|
| `Active` | The episode is current; surfaceable. |
| `Stale` | A supporting record was invalidated; episode no longer reflects reality. |
| `Archived` | The user has set the episode aside. |

### 2.2 Transitions

| From | To | Cause |
|------|----|----|
| (creation) | `Active` | `CreateEpisode` |
| `Active` | `Stale` | derivation cascade or `UpdateEpisode { status: Stale }` |
| `Active` or `Stale` | `Archived` | `UpdateEpisode { status: Archived }` |
| `Active` or `Stale` | (deleted) | `TombstoneEvidence` cascading to all supporting evidence |

A `Confirm` user assertion targeting an episode MAY freeze it
analogously to claim freezing (Section 1.4); v0.1 implementations
are not required to support episode freezing but SHOULD record
the user assertion for future use.

A `Reject` user assertion targeting an episode transitions it
to `Stale` and triggers the cascade.

## 3. Suggested-action FSM

### 3.1 States

| State | Meaning |
|-------|---------|
| `Proposed` | The system has surfaced the suggestion; the user has not yet acted. |
| `Approved` | The user accepted the suggestion. |
| `Executing` | A handler is performing the action. |
| `Completed` | The action finished successfully. |
| `Failed` | A handler reported failure. |
| `Rejected` | The user explicitly rejected the suggestion. |
| `Dismissed` | The user dismissed the suggestion (without rejecting it; it MAY resurface). |
| `Expired` | A time-window for relevance passed without user action. |

### 3.2 Transitions

| From | To | Cause |
|------|----|----|
| (creation) | `Proposed` | `CreateSuggestedAction` |
| `Proposed` | `Approved` | `UpdateActionStatus` (user-authored) |
| `Proposed` | `Rejected` | `UpdateActionStatus(Rejected)` (user-authored) |
| `Proposed` | `Dismissed` | `UpdateActionStatus(Dismissed)` (user-authored) |
| `Proposed` | `Expired` | `UpdateActionStatus(Expired)` (system-authored, when relevance window passes) |
| `Approved` | `Executing` | `UpdateActionStatus(Executing)` |
| `Executing` | `Completed` | `UpdateActionStatus(Completed)` with `execution_result` |
| `Executing` | `Failed` | `UpdateActionStatus(Failed)` with `execution_result` |
| `Dismissed` | `Proposed` | `UpdateActionStatus(Proposed)` (the system MAY resurface a dismissed action with new evidence) |

A `Reject` user assertion on a suggested action MUST move it to
`Rejected` and SHOULD prevent the system from re-proposing the
same action shape; the implementation SHOULD record this in
the lane-rule mechanism (per
[Operations](02-operations.md#71-userassert)).

## 4. Job FSM

Restated from [Mesh Coordination](09-mesh-coordination.md#2-the-job-state-machine)
for completeness.

| State | Meaning |
|-------|---------|
| `Pending` | Scheduled but not claimed. Eligible for claim. |
| `Claimed` | A worker holds the lease. |
| `Completed` | A `CompleteJob` op terminated the job. |

Transitions:

- `(creation) → Pending`: `ScheduleJob`.
- `Pending → Claimed`: `ClaimWork`.
- `Claimed → Pending`: `YieldWork` or `ExpireWork`.
- `Claimed → Completed`: `CompleteJob`.

`Completed` is terminal.

## 5. Node-registration FSM

A node's lifecycle in a mesh is governed by the UCAN delegation
graph rather than by an explicit state field, but the
observable states are useful to name.

### 5.1 States

| State | Meaning |
|-------|---------|
| `Pending` | The node has authored its bootstrap `DelegateUcan` but the receiving nodes have not yet observed it. |
| `Active` | The bootstrap delegation has been observed; the node may author and receive ops per its capability set. |
| `Suspended` | A delegation in the node's chain is no longer in force (typically due to a parent's `nbf`/`exp` window) but is not revoked. |
| `Revoked` | The node's authority has been retired by `RevokeUcan` of a parent in its chain. |

### 5.2 Transitions

| From | To | Cause |
|------|----|----|
| (creation) | `Pending` | First op authored by an unknown node |
| `Pending` | `Active` | Bootstrap `DelegateUcan` observed and verified |
| `Active` | `Suspended` | Time-bound delegation expired, but parent still valid |
| `Suspended` | `Active` | Renewed delegation issued |
| `Active` or `Suspended` | `Revoked` | `RevokeUcan` of a parent in the chain |

`Revoked` is **not** terminal in the sense that the same node
identity can later be re-admitted by a new delegation chain;
v0.1 implementations MAY treat `Revoked` as recoverable
provided they re-evaluate the entire authority chain at the
time of re-admission.

A node in `Suspended` MUST NOT have its newly-authored ops
applied to projections; the ops remain on the log but are
treated as if their authority chain were broken until the
suspension lifts.

A node in `Revoked` MUST have its previously-applied ops
re-evaluated per
[Capabilities](08-capabilities.md#53-on-transitive-revocation).

## 6. Status precedence under user assertions

Across all FSMs in this chapter, **user assertions take
precedence over machine-derived state.** Concretely:

- A `UserAssert(Confirm)` is a one-way trip toward stronger
  belief; the affected record is frozen against demotion.
- A `UserAssert(Reject)` is final; the affected record is
  invalidated and stays invalidated until a subsequent
  `UserAssert` overrides it.
- A user-authored `UpdateActionStatus` (or analogous op for
  other record types) takes precedence over any
  system-authored op of the same shape.

The mechanism by which the receiving node distinguishes
user-authored from system-authored ops is the authoring
node's capability set: a node holding `UserAssertion.Write`
without restriction (and bound to the user's own root) is
"user-bearing" in the sense the spec needs. The exact
implementation is in
[Capabilities](08-capabilities.md).

# Mesh Coordination

This chapter specifies how multiple nodes cooperate on a single
user's mesh: how work is scheduled and claimed, how the
designated coordinator's role differs from a peer's, how the
owner routes specific job kinds to specific nodes, and how
conflicts between concurrent claims are resolved.

The relevant operations were enumerated in
[Operations](02-operations.md); this chapter specifies their
semantics, state-machine effects, and authority requirements.

## 1. Roles in a mesh

A mesh has the following roles. A single node MAY hold more than
one role.

- **Owner.** The node that holds the user's root UCAN delegation.
  The owner is the only node authorised to author
  `DesignateCoordinator` and `RouteKind` ops (per
  [Capabilities](08-capabilities.md)). In a typical deployment
  the user's phone is the owner.
- **Coordinator.** The node currently designated to run the
  deterministic derivation pass. There is exactly one
  coordinator per mesh at a given log prefix. The owner
  designates the coordinator explicitly; there is no automatic
  election.
- **Worker.** Any node with `(Job, Claim)` authority. Workers
  claim and execute scheduled jobs.
- **Peer.** A node that is none of the above; it receives the
  log under whatever caveats apply to its delegation.

These roles are protocol-level. An implementation MAY add
finer-grained internal roles (an "ingestion" role, a
"surfacing" role); they are out of scope for v0.1.

## 2. The job state machine

A job is created by a `ScheduleJob` op and proceeds through the
following states:

```
   Pending  ──ClaimWork──►  Claimed  ──CompleteJob──►  Completed
      ▲                        │
      │                        ├──YieldWork────────►  Pending
      │                        │
      └────────ExpireWork──────┘  (when lease HLC-deadline passes)
```

Transitions:

- `ScheduleJob`: creates a job in `Pending`.
- `ClaimWork`: a `Pending` job becomes `Claimed`. Authored by
  the worker; carries `lease_duration_ms`.
- `CompleteJob`: a `Claimed` job becomes `Completed`. Authored
  by the current claimer.
- `YieldWork`: a `Claimed` job returns to `Pending`. Authored
  by the current claimer.
- `ExpireWork`: a `Claimed` job whose HLC-relative deadline
  has passed returns to `Pending`. May be authored by any
  node, not only the original claimer.

`Completed` is terminal. A job once completed is not
re-claimed; subsequent `ClaimWork` ops naming a completed job
MUST be rejected.

## 3. Lease expiry

A `ClaimWork` op carries `lease_duration_ms` and is authored at
HLC timestamp `claim_op.timestamp`. The lease's effective
deadline is:

```
deadline_wall_ms = claim_op.timestamp.wall_ms + lease_duration_ms
```

A job is **considered expired** at any point where some node's
HLC has `wall_ms > deadline_wall_ms`. Expiry is measured
against the HLC, not against any node's local wall clock; this
makes expiry robust to clock skew across the mesh (see
[Clocks](05-clocks.md)).

Any node MAY emit an `ExpireWork` op once it observes expiry.
Multiple nodes MAY emit concurrent `ExpireWork` ops for the
same job; the receiving nodes apply them idempotently.

A claimer that wishes to extend its lease MUST do so by emitting
a fresh `ClaimWork` op (with a new `op_id` and current
timestamp) before the previous deadline. There is no separate
lease-renewal op in v0.1.

## 4. Conflicting claims

Two workers may emit `ClaimWork` ops for the same `Pending` job
concurrently. The receiving node resolves the conflict by HLC
total order: the `ClaimWork` with the smaller HLC value is the
**winner**, and subsequent `ClaimWork` ops on the same job
while it is `Claimed` MUST be rejected.

If both ops have an indistinguishable HLC value (which is only
possible if the HLC tick discipline is violated; see
[Clocks](05-clocks.md)), the receiver MUST reject both ops as
an integrity failure rather than picking arbitrarily.

A worker whose `ClaimWork` was rejected SHOULD NOT immediately
re-attempt; it SHOULD wait for the current lease to expire
(after which the job is `Pending` again) or for a `YieldWork`
op from the current claimer.

## 5. RouteKind

A `RouteKind` op directs all jobs of a given `kind` to a single
node. While a route is set:

- The owner-authored `RouteKind` is the authoritative target.
- A `ClaimWork` op naming a job whose `kind` is routed MUST be
  rejected unless the claimer matches the routed target.
- A worker whose `(Job, Claim)` capability admits the kind but
  who is not the routed target MUST NOT successfully claim
  routed jobs.

`RouteKind` ops follow last-write-wins semantics by HLC total
order: the most recent `RouteKind` for a given `kind` is in
force. Setting `route` to `None` clears the directive; the kind
returns to the default "any eligible worker may claim."

`RouteKind` is owner-only; per
[Capabilities](08-capabilities.md), an op carrying a
`RouteKind` payload from a non-owner MUST be rejected.

A useful pattern enabled by `RouteKind`: a phone with no GPU
schedules synthesis jobs and routes them to a server with a
GPU. The phone never claims those jobs because the route
restricts claiming to the server. The same delegation graph
that authorises the server to do the work also authorises it to
read the prompt context.

## 6. DesignateCoordinator

The coordinator is the node responsible for the deterministic
derivation pass: the part of the inference pipeline that two
nodes seeing the same op log MUST agree about. This typically
includes auto-observation of evidence, entity resolution, and
the rhythm pass (see the reference implementation's pipeline
documentation for examples).

`DesignateCoordinator` ops:

- MUST be authored by the mesh owner.
- Take effect at their HLC timestamp.
- May be re-issued at any time to change coordinator. The most
  recent `DesignateCoordinator` op (by HLC total order) is in
  force.

There is exactly one coordinator at any HLC timestamp. A node
that is not the coordinator MUST NOT author derivation ops
that the coordinator would normally author. An op that violates
this rule MUST be rejected on receive.

An implementation MAY track the "non-coordinator drift" — the
case where the coordinator has been quiet for an unusually long
time — and surface it to the owner so the owner can re-designate.
v0.1 does not specify an automatic re-designation; the owner
remains in control.

## 7. Causal dependencies between jobs

The `causal_deps` field on every operation (introduced in
[Operations](02-operations.md)) carries a possibly-empty set of
predecessor `OpId`s. For job ops, `causal_deps` is the
mechanism for **DAG chaining**: a synthesis job can depend on
the completion of a tool-use job by including the tool-use
job's `CompleteJob` op id in its `causal_deps`.

A node receiving a job op with non-empty `causal_deps` MUST:

- Verify each dependency is present on the local log (the op
  was either authored locally or received from a peer).
- Defer applying the dependent op to its projections until all
  dependencies are present and applied.

Job dependencies form a DAG. A cycle in the dependency graph is
a protocol violation; an implementation that detects one MUST
reject the offending op.

## 8. The work roster

Implementations maintain a **work roster** projection that
tracks each job's current state, claimer, and lease deadline.
The roster is derived from the op log per the rules in this
chapter. The protocol does not specify the roster's storage
shape; it specifies only the queries the roster must answer:

- "What is the current state of job X?"
- "Which jobs of kind K are currently `Pending` and admitted by
  any active route?"
- "Which `Claimed` jobs are past their deadline?"

These queries are sufficient to drive the worker loop:
periodically check the roster for `Pending` jobs the local
node may claim, attempt to claim them, execute, and emit
`CompleteJob` (or `YieldWork`).

## 9. Worker etiquette

These are SHOULD-level recommendations for worker
implementations to keep the mesh healthy:

- A worker SHOULD NOT claim more jobs than it can complete
  within the lease duration.
- A worker SHOULD emit `YieldWork` if it knows it cannot
  complete a job (low battery, going to sleep, handler error).
- A worker SHOULD NOT race other workers for `Pending` jobs.
  After a `ClaimWork` is accepted by some node, other workers
  SHOULD back off until expiry or yield.
- A worker SHOULD jitter its claim cadence to avoid
  thundering-herd effects in a mesh with many concurrent
  workers.

## 10. Job kinds

The `kind` field on a job is a typed work-kind string. The
protocol does not constrain the namespace, but recommends
reverse-DNS-prefix style. Examples used by the reference
implementation:

- `cortex.extract.tier1` — per-evidence deterministic extraction.
- `cortex.enrich.tier2` — per-entity interpretive enrichment.
- `cortex.synthesize.window` — per-window episode synthesis.
- `cortex.action.<verb>` — action-execution handlers.
- `cortex.tool.<name>` — tool-use handlers feeding inference.

A job kind is application-defined (the kind tells a handler what
to do); the protocol's interest is solely in routing claims by
prefix. An implementation MAY register handlers for kinds it
recognises and ignore kinds it does not — claims for unrecognised
kinds simply never arrive at the unrecognising node.

## 11. Inference snapshots and job provenance

When a job's handler invokes a model, the resulting
`InferenceSnapshot` artefact (per
[Operations](02-operations.md#83-createartifact)) is emitted
alongside the job's `CompleteJob` op. The snapshot's
`source_job` field links back to the job, and the snapshot is
referenced from any claims, episodes, or suggested actions the
job produced.

This is what makes inference auditable at the mesh level. Every
LLM call produced by any worker is logged on the same
append-only log every node sees, with the same authority
requirements as any other op.

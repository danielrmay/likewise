# Invariants

The invariants in this chapter are the non-negotiable rules of the
protocol. Every other normative statement in the specification
exists to make one of these rules implementable; an
implementation that violates any of them is non-conformant
regardless of which other sections it satisfies.

This chapter is the canonical, formal version of the rules
introduced informally in
[Concepts](../concepts.md#the-six-rules-in-plain-english) and
[Motivation](../motivation.md#the-non-negotiable-rules).

## I-1. Log canonicality

**Only operations on the log mutate canonical state.** No other
mutation source is admissible. Any state held by an
implementation that is not derivable from the op log is, by
definition, not part of the user's knowledge graph.

Concretely:

- A projection MUST NOT carry a field that has no derivation
  rule from the log.
- An external integration (a UI, a scheduler, a third-party
  bridge) MUST mediate every mutation through the op-log layer.
- Any apparent state — a notification badge, a cached
  thumbnail — that lives outside the log is a presentation
  artefact, not a fact.

## I-2. Projection disposability

**All projections are reconstructable from the op log.** No
projection's content may be load-bearing in a way that prevents
rebuild.

Implementations MUST be able to drop any projection and rebuild
it from the log alone. The rebuild is specified in
[Projections](10-projections.md#4-rebuild-from-log).

## I-3. Transitive provenance to evidence

**Every user-visible claim, episode, and suggested action has a
chain back to evidence.**

Concretely:

- A claim's `provenance` field references the supporting
  evidence and supporting claims.
- An episode's `evidence_ids`, `claim_ids`, and `entity_ids`
  fields are populated.
- A suggested action's `supporting_claims`, `supporting_evidence`,
  and `derivation_job` fields are populated.

For each link in the chain, the referenced record MUST be
present on the log (or be a tombstoned record whose absence is
itself an op).

A derived record without provenance to evidence is malformed
and MUST be rejected.

## I-4. Derivation is a DAG

**The derivation graph is a directed acyclic graph.** A claim
MUST NOT (transitively) cite itself. An operation that would
introduce a cycle into the derivation graph MUST be rejected.

The entity-resolution graph (which entity merges into which) is
*not* required to be acyclic; cycles in entity resolution are
resolved deterministically per
[Mesh Coordination](09-mesh-coordination.md#4-conflicting-claims).

The DAG-ness of derivation is what makes invalidation
decidable: a tombstone or rejection cascades forward along
outgoing edges in finite steps.

## I-5. Sync converges operations, not projections

**Two nodes that have applied the same set of operations agree on
canonical state.** Differences in projection materialisation are
permitted — implementations may differ in salience algorithms or
indexing strategies — but the underlying truth they project from
MUST be the same.

A v0.1 conformance test consists in part of:

1. Send the same op log to two implementations.
2. Verify their detail projections answer the same get-by-id
   queries identically.

Implementations whose detail projections disagree on facts
derivable from a shared log are non-conformant.

## I-6. Per-author HLC monotonicity

**No author produces two operations with the same HLC value.**
Within a single author's stream of authored ops, HLC values
MUST be strictly monotonically increasing.

This is enforced by the tick discipline in
[Clocks](05-clocks.md#4-the-tick-discipline). A receiving node
that observes two ops with identical `(wall_ms, logical, node)`
from the same author MUST treat the condition as an integrity
failure — the authoring node violated the protocol — and reject
both ops.

The frontier-based sync cursor depends on this invariant.

## I-7. Authentic authorship

**Every authored operation is signed by its author, or is a
deliberately sanitised op admitted by an authority chain.**

There are exactly two ways for an op to appear unsigned on the
wire:

1. The op has been sanitised under a `sanitize` caveat per
   [UCAN and Caveats](07-ucan-and-caveats.md). Such an op
   carries a sanitisation marker.
2. The op is the bootstrap `DelegateUcan` that establishes a
   new node's binding, where authentication is provided by
   the embedded UCAN's own signature rather than by the op
   envelope's.

An op that arrives unsigned without satisfying one of these
conditions MUST be rejected.

## I-8. Atomic tombstone cascade

**Removing evidence cascades atomically through derived data.**

When `TombstoneEvidence` (or `CascadeTombstone`) is applied,
every claim, entity merge, episode, suggested action, and
inference snapshot that transitively depended on the tombstoned
evidence MUST be invalidated as part of the same logical apply.
A receiver MUST NOT observe a state in which the evidence is
gone but its dependents remain "live" in projections.

Implementation strategies (single transaction, op-batched
apply, idempotent retry) are at the implementation's
discretion; the observable atomicity is what the spec
requires.

## I-9. Inference is recorded (when audit is in force)

**A node performing inference under audit MUST emit an
`InferenceSnapshot` artefact for every model call.**

Audit is *in force* in two cases:

1. **The node is operating under the user's root delegation.**
   The reference implementation, and any implementation a user
   runs on their own devices, falls into this category. For
   such nodes, audit is the default and is normative for v0.1
   conformance — an inference call without a corresponding
   snapshot is a violation regardless of what other invariants
   the implementation satisfies. This is what makes the user's
   own personal mesh auditable end-to-end.

2. **The node is operating under a delegation whose caveats
   require audit.** A user delegating to an organisation's
   node MAY attach an `audit_inference` caveat (specified in
   [UCAN and Caveats](07-ucan-and-caveats.md)) requiring the
   delegated node to emit snapshots for inference performed
   against the delegated data. In this case, the snapshots
   are themselves visible on the log the user receives back
   from the delegated node, completing the audit loop across
   organisational boundaries.

A delegated node operating *without* an audit caveat is not
required by this invariant to record its internal inference.
Whatever the delegated node does with the data it received —
training, summarisation, classification, recommendation — is
governed by the delegation's other caveats and by whatever
out-of-band agreements the user and the delegated party have.
This is a deliberate scope choice: the protocol's role is to
let the user decide whether audit applies, not to mandate it
for every party that ever processes a piece of the user's
graph.

When audit is in force, every derived claim, every materialised
record (including episodes and suggested actions where they
exist as application-layer conventions), and every other
inference output MUST link to its producing snapshot via the
record's provenance fields or via `causal_deps`. The "how did
it know?" question has, when audit is in force, a literal
answer consisting of evidence and claims.

The snapshot artefact's required content (model identity,
retrieved context, prompt, output, telemetry) is specified in
[Inference Audit §2](13-inference-audit.md#2-the-likewiseinferencesnapshot-artefact).

## I-10. Authority is verified per op

**An operation is admitted to projections only if its authoring
node held the necessary capability at the operation's
timestamp.**

Authority is verified by walking the chain of UCAN delegations
from the authoring node to the user's root, at the operation's
HLC timestamp. Operations whose chain is incomplete, expired,
not yet active, or revoked MUST NOT enter projections.

When a delegation is revoked retroactively (per
[Capabilities](08-capabilities.md#53-on-transitive-revocation)),
ops that no longer authorise MUST be removed from projections,
even though their op-log entries are preserved.

## A note on enforcement

These ten invariants are not aspirational. An implementation
that violates any of them produces a system in which the user
cannot trust what the system says about them — which is the
condition the protocol exists to prevent.

A v0.1 conformance test consists of demonstrating that each
invariant holds under a battery of concrete operations and
sequences. The seven scenarios planned to ship with the
reference implementation (see
[Implementations](../implementations.md)) are intended to
collectively cover I-1 through I-10. Until those scenarios are
public, the path to "behaviourally conformant for v0.1" is to
construct equivalent coverage from this chapter's invariants
directly.

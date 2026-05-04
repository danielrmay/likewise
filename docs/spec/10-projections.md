# Projections

A projection is a materialised read view derived from the
operation log. This chapter specifies the projection contract:
what each projection MUST be able to answer, what relationships
between projections are load-bearing, and what implementations
are free to optimise.

The chapter fills the gap that v0.1 implementations had handled
implicitly: an explicit statement of which projection-related
behaviours an implementation MUST provide and which it MAY
choose internally.

## 1. The disposability invariant

A conformant implementation's projections MUST be **fully
reconstructable from the operation log** as it stands at any
point in time.

Concretely:

- An implementation MUST be able to rebuild every projection
  from the log alone. There MUST NOT exist any state in a
  projection that has no derivation rule from the log.
- An implementation MUST NOT modify projections by any means
  other than applying operations. UI actions, schedulers,
  caches, and external systems MUST go through the op-log
  layer.
- A projection MAY be discarded at any time and rebuilt on
  demand. An implementation MAY persist projections for
  performance, but persisting them MUST NOT change the log's
  authority over their content.

This invariant is the load-bearing reason that the protocol can
guarantee the user owns their derived data: nothing the system
believes about the user lives outside the log.

## 2. The three substrate projections

The protocol defines three projections **by the queries they
answer**, not by their storage strategy. An implementation MUST
provide each of the three query surfaces; it MAY combine the
underlying storage as it sees fit, provided each surface
remains queryable as specified.

A fourth projection, *salience*, is used by the reference
implementation to surface records to a user. It is an
application-layer convention rather than substrate, and is
specified in
[Annex: Application Conventions §A.3](annex-conventions.md#a3-salience-projection).
A node that does not surface records to a user — for example,
an organisation's node consuming a scoped slice — has no need
to implement it.

### 2.1 Inference projection

**Purpose.** Assemble a model context window for an inference
call.

**Required queries.**

- *Window context.* Given a time window, return the evidence,
  claims, entities, and episodes a model should receive as
  context for synthesising over that window.
- *Per-entity context.* Given an entity, return the relevant
  claim stack and supporting evidence for an inference call
  centred on that entity.

**Constraints.**

- The inference projection MUST be designed for assembly into
  prompt-shaped data structures, not for UI rendering.
- It MUST track *which* claims and evidence are framing tags
  versus narrative content. Implementations MUST be able to
  produce both shapes.
- It SHOULD be cheap to update incrementally as new ops arrive,
  because it is consulted on every inference call.

The inference projection's content is not the prompt itself —
the prompt is constructed by the implementation's inference
pipeline. The projection's responsibility is to provide
*correct context*; the pipeline's responsibility is to assemble
it.

### 2.2 Detail projection

**Purpose.** Answer per-id user-interface lookups.

**Required queries.**

- *Get by id.* Given an `EntityId`, `EpisodeId`, `ClaimId`,
  `ActionId`, or `EvidenceId`, return all user-visible fields
  for that record: title, label, claim text, status,
  confidence, provenance links, supporting evidence summary.
- *List by predicate.* Given an entity and a predicate, return
  the current claims of that predicate on that entity (with
  effective status applied).
- *Provenance trace.* Given any derived record, return the
  chain of supporting operations transitively to evidence.

**Constraints.**

- The detail projection MUST be durable (typically on-disk).
  Every conformant node carries it, regardless of whether the
  node is rendering a UI.
- It MUST rebuild from the log when missing or corrupted.
- It MUST honour user assertions: a `Reject` user-assertion
  MUST cause subsequent reads of the affected claim to return
  the rejected status, regardless of underlying derivation
  state.
- Reads MUST be keyed direct lookups. Implementations MAY add
  secondary indices for richer queries; the v0.1 spec does
  not require them.

The detail projection is the only projection a v0.1 conformant
node MUST persist across restarts.

### 2.3 Debug-graph projection

**Purpose.** Full-graph inspection for tooling and verification.

**Required queries.**

- *Full graph dump.* Return all entities, claims, evidence
  references, and edges between them as of the current log
  prefix.
- *Cycle detection.* Identify cycles in the derivation graph
  (which MUST NOT exist).

**Constraints.**

- The debug-graph projection is OPTIONAL in production
  deployments.
- An implementation that includes it SHOULD make it available
  via inspection tooling (a CLI, an admin endpoint).

The protocol provides this projection because being able to
ask "show me the entire graph" is a load-bearing debugging
capability for a system the user is asked to trust.

## 3. The non-collapse rule

An implementation MAY combine the underlying storage of
multiple projections — for example, keeping a single SQLite
file with separate tables for the detail and inference
projections — but it MUST NOT fold the **read interfaces** such
that one projection's query semantics contaminate another.

In particular:

- An inference-context query MUST NOT return UI-shaped detail
  records.
- A detail-by-id query MUST NOT carry inference-window
  framing tags as if they were claim content.
- An implementation that adds an application-layer projection
  (such as the salience projection in
  [Annex §A.3](annex-conventions.md#a3-salience-projection))
  MUST NOT fold its read interface into a substrate projection.

The reason for the rule is observable: collapsing produces a
single fat object that is too slow for ranking, too lossy for
UI, and too memory-hungry for inference contexts.
Implementations that have tried it have re-discovered why the
distinction exists; the spec encodes the lesson normatively.

## 4. Rebuild from log

Every conformant implementation MUST provide a *rebuild
operation* that:

1. Drops or otherwise invalidates the current state of all
   projections.
2. Replays the entire op log in HLC total order, applying each
   op to all three substrate projections (and to any
   application-layer projections the implementation maintains).
3. Reaches a steady state in which subsequent op application
   continues normally.

Rebuild is the recovery mechanism for projection corruption
and the verification mechanism for new implementations
(rebuilding from a known log and comparing the result to the
reference implementation's output is the strongest test of
projection correctness). Rebuild SHOULD be deterministic up
to algorithm-internal choices: the same implementation must
produce the same projection from the same log every time, and
two implementations that satisfy this chapter's contract must
agree on every fact derivable from the log even if they
internally choose different ranking or scoring strategies in
their application-layer projections.

## 5. Per-projection authority

When two projections produce conflicting answers about the
same fact, the **detail projection wins for user-visible
display**, and the **inference projection wins for model
context**. The debug-graph projection — and any
application-layer projection an implementation chooses to
maintain — MUST NOT supply authoritative answers about the
user's data.

If the detail and inference projections disagree about a
user-visible field, the implementation has a bug. The spec
considers them obligated to agree on every fact derivable from
the log.

## 6. The frontier and projection state

A node's causal frontier (per [Sync](04-sync.md)) is itself a
projection — it summarises the maximum HLC seen per author,
which is computable from the op log alone. Implementations MUST
maintain the frontier consistently with the log: after applying
op `O` to projections, the frontier MUST reflect `O`'s
timestamp.

A node SHOULD persist the frontier to avoid re-scanning the
entire log on startup, but a node that does not persist it MUST
recompute it correctly on the first sync exchange.

## 7. Capability filtering and projection

Operations rejected by the authorise-and-filter pipeline (per
[Capabilities](08-capabilities.md)) MUST NOT enter projections.
The integrity of "everything in projections is authorised" is
load-bearing for any reasoning about projections under
capability evolution: when a delegation is revoked, the
re-evaluation step (per
[Capabilities](08-capabilities.md#53-on-transitive-revocation))
MUST remove from projections any record whose authority chain
no longer authorises it, even though the underlying log entry
is preserved.

## 8. Informative: storage strategies

> Informative section. Does not impose requirements.

A reference-implementation deployment uses:

- An in-memory window-segmented structure for the inference
  projection.
- A SQLite database with a per-id table for the detail
  projection.
- A separate `petgraph::StableGraph` for the debug-graph
  projection (rebuilt on demand rather than maintained).
- An in-memory hash map for the application-layer salience
  projection's scores (see
  [Annex §A.3](annex-conventions.md#a3-salience-projection)).

Other deployments might combine them differently. The contract
above is the only thing the protocol requires.

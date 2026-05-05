# Operations

This chapter enumerates the operation variants defined for v0.1.
Every state change in a Likewise mesh is one of these
variants. The wire encoding of an operation is specified in
[Wire Format](03-wire-format.md); this chapter describes payloads
and their semantics.

## 1. The operation envelope

Every operation, regardless of payload variant, MUST carry the
fields described below. Implementations MAY use any in-memory
representation; the wire-format chapter specifies the canonical
serialisation that signatures are computed over.

| Field | Required | Purpose |
|-------|----------|---------|
| `id` | yes | An `OpId`. ULID-shaped, time-sortable, globally unique within the mesh. |
| `schema_version` | yes | The op-payload schema version. Future revisions of this specification MAY introduce new payload-format versions; recipients MUST migrate on read. |
| `timestamp` | yes | A hybrid logical clock value. See [Clocks](05-clocks.md). |
| `node_id` | yes | The originating node's `NodeId`. |
| `causal_deps` | yes | A possibly-empty set of `OpId` predecessors the author wishes to mark as explicit causal dependencies. May be empty when the author is willing to rely solely on the HLC ordering. |
| `payload` | yes | One of the typed variants enumerated below. |
| `signature` | conditional | Detached JWS over the canonical encoding of the op with the signature field cleared. Required for all ops except those that have been intentionally sanitised by an authorised filter; see [UCAN and Caveats](07-ucan-and-caveats.md). |

A receiving node MUST reject any operation whose envelope is
malformed, whose `id` collides with an op already in the log under
the same `node_id` and `timestamp`, or whose signature is invalid
in a context where one was required.

## 2. Payload categories

The v0.1 substrate vocabulary partitions operations into seven
categories:

- **Evidence operations** record raw inputs.
- **Entity operations** create, alias, merge, and split entities.
- **Claim operations** create and evolve claims.
- **Job operations** schedule, claim, and complete units of work.
- **Artifact operations** create and evict generic byproducts of
  derivation, including the inference-snapshot artefacts used by
  Part 2.
- **User-assertion operations** carry the user's overrides on
  derived state.
- **Mesh operations** govern delegation, revocation, coordination,
  and routing.

Two further op types — `CreateEpisode`/`UpdateEpisode` and
`CreateSuggestedAction`/`UpdateActionStatus` — are
application-layer conventions used by the reference implementation
to surface the substrate to a user. They are documented in
[Annex: Application Conventions](annex-conventions.md), not here.
A node that does not surface the graph to a user — for example,
an organisation's node consuming a scoped slice — has no need to
implement them.

Subsequent sections describe each variant. Field types use
informal names; their precise wire encodings are in
[Wire Format](03-wire-format.md).

## 3. Evidence operations

### 3.1 IngestEvidence

Creates an immutable evidence record.

| Field | Purpose |
|-------|---------|
| `evidence_id` | An `EvidenceId`. |
| `content_hash` | BLAKE3 hash of the canonical content bytes. |
| `source_type` | Short identifier for the upstream system (e.g. `"calendar"`, `"photo"`, `"contact"`). |
| `source_anchor` | Stable upstream identifier (calendar UID, photo asset id, message id). |
| `metadata_snapshot` | Optional structured metadata extracted at ingest time (timestamp, location, participants). |

Receiving nodes MUST treat the `(evidence_id, content_hash)` pair
as fixed for the lifetime of the mesh. The bytes referenced by
`content_hash` MAY be absent on a given node.

### 3.2 TombstoneEvidence

Removes an evidence record from active circulation. The original
ingest op is preserved on the log; only the application of new
operations against the tombstoned record changes.

| Field | Purpose |
|-------|---------|
| `evidence_id` | The evidence being tombstoned. |
| `reason` | One of `UserRequest`, `Privacy`, `DataExpiry`, or another well-known string introduced in a future minor version. |

A `TombstoneEvidence` op MUST trigger the derivation cascade
defined in [State Machines](12-fsms.md): every claim, episode,
suggested action, and inference snapshot that transitively
depends on the tombstoned evidence is invalidated atomically.

## 4. Entity operations

### 4.1 CreateEntity

Introduces a new entity into the mesh.

| Field | Purpose |
|-------|---------|
| `entity_id` | An `EntityId`. |
| `entity_type` | `Person`, `Place`, `Organisation`, `Device`, `Account`, `Document`, `Concept`, `Commitment`, `Event`. Future minor versions MAY add types. |
| `initial_label` | Human-readable name. |
| `source_claims` | The claims that motivated the creation, if any. |

### 4.2 AddEntityAlias

Adds an alternative label for an existing entity.

| Field | Purpose |
|-------|---------|
| `entity_id` | The target entity. |
| `alias` | Alternative label. |

### 4.3 MergeEntities

Resolves two or more entities to a single survivor. The survivor
absorbs the consumed entities' claims, with redirection so that
references to the consumed entities continue to resolve.

| Field | Purpose |
|-------|---------|
| `survivor` | The `EntityId` that persists. |
| `consumed` | The `EntityId`s being absorbed. |
| `rationale` | Free-form prose explaining why they are the same. |

When two `MergeEntities` ops conflict (each consumes an entity the
other survives), the receiving node MUST resolve the conflict
deterministically by `OpId` ordering. The full rule is given in
[Mesh Coordination](09-mesh-coordination.md).

A `MergeEntities` op authored by a user-assertion authority MUST
take precedence over machine-derived merges, regardless of `OpId`
order.

### 4.4 SplitEntity

Reverses a prior merge.

| Field | Purpose |
|-------|---------|
| `original` | The entity to split. |
| `new_entities` | The set of entities the split produces. |
| `rationale` | Free-form prose explaining why they are different. |

## 5. Claim operations

A claim is the protocol's unit of asserted belief about an
entity. Claims have a status (Hint, Claim, Fact, Disputed,
Rejected, Superseded, Stale) whose transitions are specified in
[State Machines](12-fsms.md).

### 5.1 CreateClaim

| Field | Purpose |
|-------|---------|
| `claim_id` | A `ClaimId`. |
| `claim_type` | `Attribute`, `Relationship`, `Membership`, `Temporal`, `Spatial`, `Behavioral`, `Derived`. |
| `subject` | The `EntityId` the claim is about. |
| `predicate` | A predicate from the centralised vocabulary. The vocabulary is part of the specification; future minor versions MAY add predicates. |
| `object` | One of: an `EntityId`, text, a number, a boolean, a timestamp, or a structured object. |
| `initial_status` | Typically `Hint` or `Claim`. |
| `confidence` | A confidence vector with multiple components. |
| `provenance` | The supporting evidence, claims, and jobs. |

### 5.2 UpdateClaimStatus

| Field | Purpose |
|-------|---------|
| `claim_id` | Target claim. |
| `new_status` | New status from the lifecycle. |
| `rationale` | Optional free-form prose. |

### 5.3 UpdateClaimConfidence

| Field | Purpose |
|-------|---------|
| `claim_id` | Target claim. |
| `new_confidence` | Updated confidence vector. |

### 5.4 SupersedeClaim

| Field | Purpose |
|-------|---------|
| `old_claim_id` | The claim being replaced. |
| `new_claim_id` | The replacement, which MUST already exist on the log. |
| `rationale` | Free-form prose. |

A claim with status `Fact` (i.e. user-confirmed) is **frozen**
and MUST NOT be superseded by a non-user-assertion-authored
op. User assertions MAY override frozen claims.

## 6. Job operations

The job vocabulary lets multiple nodes cooperate on the same
unit of work without external coordination. The full
state-machine semantics are in
[Mesh Coordination](09-mesh-coordination.md); the table below
specifies the payload shape only.

### 6.1 ScheduleJob

Declares that a job exists and may be claimed.

| Field | Purpose |
|-------|---------|
| `job_id` | A `JobId`. |
| `kind` | A typed work-kind string (e.g. `cortex.synthesize.window`). The protocol does not constrain the namespace, but implementations SHOULD use a reverse-DNS-style prefix for portability. |
| `payload` | Opaque bytes the eventual handler interprets. |
| `policy_envelope` | Policy and capability constraints attached at scheduling time. |

### 6.2 ClaimWork

A node takes responsibility for executing a scheduled job.

| Field | Purpose |
|-------|---------|
| `job_id` | The job being claimed. |
| `claimer` | The `NodeId` of the claiming node. |
| `lease_duration_ms` | How long the lease lasts. |

The lease's effective expiry is computed against the **HLC
wall component**, not against any node's local wall clock.
See [Mesh Coordination](09-mesh-coordination.md).

### 6.3 CompleteJob

Records that a job finished and its outputs are on the log.

| Field | Purpose |
|-------|---------|
| `job_id` | The job. |
| `output_claims` | Claims produced. |
| `output_artifacts` | Artefacts produced. |
| `telemetry` | Duration, token counts, model latency. |

### 6.4 YieldWork

A claimer voluntarily releases a job before completion.

| Field | Purpose |
|-------|---------|
| `job_id` | The job. |
| `claimer` | MUST match the current claimer's `NodeId`. |
| `reason` | Free-form prose. |

### 6.5 ExpireWork

Any node MAY emit an `ExpireWork` op once a lease's HLC-relative
deadline has passed. The op moves the job back to the unclaimed
state.

| Field | Purpose |
|-------|---------|
| `job_id` | The job. |
| `expired_claimer` | MUST match the current claimer's `NodeId`. |
| `reason` | Conventionally `"deadline_passed"`. |

## 7. User-assertion operations

The user is the final authority on facts about themselves. A
user assertion takes precedence over machine-derived state and
MUST be respected by the receiving node's projection logic.

### 7.1 UserAssert

| Field | Purpose |
|-------|---------|
| `assertion_type` | `Confirm`, `Reject`, `Edit`, `Pin`, `Hide`, `LaneRule`. |
| `target` | A `Claim`, `Entity`, or semantic-lane reference. |
| `semantic_lane` | Optional lane qualifier. |

Effects by assertion type:

- `Confirm` — promotes the target claim to `Fact`. The claim
  becomes frozen against subsequent automated invalidation.
- `Reject` — sets the target claim to `Rejected` and triggers
  the derivation cascade.
- `Edit` — creates a versioned replacement claim that the
  receiving node MUST treat as superseding the original.
- `Pin` — freezes the target without altering its current
  status.
- `Hide` — display-layer directive; the claim persists on the
  log but is excluded from user-facing surfaces.
- `LaneRule` — blocks or requires confirmation for derivations
  in a named semantic lane. The set of lane-rule effects is
  specified in [State Machines](12-fsms.md).

User-assertion ops are authored by a node that holds a
write capability on the relevant resource with no caveats
restricting `UserAssertion`. Implementations MAY in addition
require that the authoring node corresponds to a "user-bearing"
role established by mesh policy; the v0.1 specification does not
mandate this.

## 8. Artifact operations

Artefacts are generic machine-produced byproducts of derivation:
embeddings, transcripts, OCR text, and the inference snapshots
that record model calls. The artefact mechanism is substrate;
specific artefact types layered on top of it (notably
`likewise.inference.snapshot`, used by [Part 2](09-mesh-coordination.md))
inherit lifecycle and storage from this section.

### 8.1 CreateArtifact

| Field | Purpose |
|-------|---------|
| `artifact_id` | An `ArtifactId`. |
| `artifact_type` | Short identifier (`"image_embedding"`, `"ocr_text"`, `"transcript"`, `"likewise.inference.snapshot"`, ...). |
| `source_job` | Optional link to the producing job. |
| `inputs_used` | Evidence inputs. |
| `content_hash` | BLAKE3 of the artefact content. |
| `content_inline` | Optional inline bytes for small artefacts. |
| `model_id`, `model_version` | Optional. Required for inference-snapshot artefacts. |
| `size_bytes` | Content size. |
| `ttl_ms` | Optional time-to-live, after which the artefact is eligible for eviction. |

The `likewise.inference.snapshot` artifact type is specified in
detail in [Inference Audit](13-inference-audit.md).

### 8.2 EvictArtifact

Drops the content of an artefact (the metadata is retained on
the log).

| Field | Purpose |
|-------|---------|
| `artifact_id` | Target artefact. |

## 8a. Application-layer ops (informative pointer)

The reference implementation also emits `CreateEpisode`,
`UpdateEpisode`, `CreateSuggestedAction`, and
`UpdateActionStatus` as part of its user-facing surface. These
are documented in
[Annex: Application Conventions](annex-conventions.md). They are
not part of the substrate vocabulary; a substrate-only
implementation that receives them on the wire MAY accept and
store them on the log without maintaining any projection state
for them.

## 9. Mesh operations

### 9.1 DesignateCoordinator

Owner-only. Names the node responsible for the deterministic
derivation pass. There is no automatic election; coordinator
selection is an explicit user act.

| Field | Purpose |
|-------|---------|
| `coordinator` | The `NodeId` that should run the deterministic pipeline. |

A `DesignateCoordinator` op authored by any node other than the
mesh owner MUST be rejected.

### 9.2 DelegateUcan

Carries a UCAN delegation in the op log.

| Field | Purpose |
|-------|---------|
| `ucan_cid` | The `ContentHash` of the token bytes. Acts as the delegation's identity. |
| `ucan_bytes` | The detached-JWS UCAN token. |

A `DelegateUcan` op authored by a node that has not yet been
seen on the log MAY be accepted unsigned, on the condition
that the embedded UCAN binds the authoring `NodeId` to the
issuer's DID. This is the bootstrap path by which a new node's
key first becomes known to the mesh; see
[UCAN and Caveats](07-ucan-and-caveats.md).

### 9.3 RevokeUcan

| Field | Purpose |
|-------|---------|
| `ucan_cid` | The content hash of the delegation being revoked. |

A `RevokeUcan` op MUST be authored by the issuer of the
delegation it revokes (or by a node with write authority over
that DID's delegations under a still-valid parent). Receiving
nodes MUST prune the subgraph of delegations beneath the
revoked one and MUST re-evaluate the authorisation of any ops
whose authority depended on it.

### 9.4 RouteKind

Owner-only. Routes a class of jobs to a specific node.

| Field | Purpose |
|-------|---------|
| `kind` | The work-kind string. |
| `route` | An optional `NodeId`. Omitting the value clears the directive. |

While a route is set, only the named node MAY successfully
emit a `ClaimWork` op for that kind. Other nodes' claim ops
MUST be rejected. Routes follow last-write-wins semantics by
op timestamp.

A `RouteKind` op authored by any node other than the mesh
owner MUST be rejected.

## 10. Operation indexing

Implementations MUST be able to retrieve operations from the log
by `OpId`, by `(node_id, timestamp)`, and by author-frontier
(see [Sync](04-sync.md)). They MAY provide additional indices
for efficient projection rebuilds.

## 11. Reserved variants

Future minor versions of this specification MAY introduce new
op variants. An implementation that encounters an unknown variant
on the wire MUST reject the op, log the rejection, and continue
processing subsequent ops. It MUST NOT corrupt its log by
dropping unknown variants silently or by guessing at their
semantics.

The reserved-prefix convention for namespacing third-party
extensions is described in
[Open Issues](99-open-issues.md); a stable extension mechanism
is anticipated but not normative in v0.1.

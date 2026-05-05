# Annex: Application Conventions

This annex describes conventions the reference
implementation uses to surface the substrate to a user. The
material here is **non-normative**. A v0.1 conformant node MAY
implement these conventions, MAY substitute alternatives, or MAY
omit them entirely.

The substrate (Part 1) and the inference pipeline (Part 2) are
deliberately separable from the question of "how is this surfaced
to a user." Different applications will make different choices
about that question. The conventions in this annex are one set of
choices that ship with the reference implementation; recording
them here lets readers understand what the reference implementation
is doing without conflating those choices with the protocol's
load-bearing parts.

If you are implementing an interoperable node — for example, an
organization's node that synchronizes a scoped slice of a user's
graph — you can ignore this annex entirely. The substrate and the
inference pipeline are sufficient to participate in a Likewise
mesh. Applications that depend on the conventions in
this annex will simply not find the records they expect, and that
is allowed.

## A.1 Episode operations

Episodes are temporally-bounded clusters of related evidence,
entities, and claims. The reference implementation surfaces them
to a user as narrative units: a trip, a project, a relationship
arc, a meaningful day. They are *not* substrate primitives —
nothing in the data model or sync protocol requires them.

### A.1.1 CreateEpisode

| Field | Purpose |
|-------|---------|
| `episode_id` | An `EpisodeId`. |
| `title` | Short title. |
| `summary` | Optional longer description. |
| `temporal_start` | The episode's start time. |
| `temporal_end` | Optional end time; absence indicates ongoing. |
| `evidence_ids`, `claim_ids`, `entity_ids` | Supporting records. |
| `confidence` | Episode-quality score. |

Per-run inference provenance for an episode is carried by an
`InferenceSnapshot` artifact emitted alongside the
`CreateEpisode` op (when audit is in force per Part 2).
Implementations correlate episode and snapshot via `causal_deps`.

### A.1.2 UpdateEpisode

| Field | Purpose |
|-------|---------|
| `episode_id` | Target episode. |
| `title`, `summary`, `confidence` | Optional updates. |
| `status` | Optional transition (`Active`, `Stale`, `Archived`). |
| `claim_ids_add`, `evidence_ids_add` | Supporting records to add. |

### A.1.3 Episode FSM

| State | Meaning |
|-------|---------|
| `Active` | The episode is current; surfaceable. |
| `Stale` | A supporting record was invalidated; episode no longer reflects reality. |
| `Archived` | The user has set the episode aside. |

Transitions:

| From | To | Cause |
|------|----|----|
| (creation) | `Active` | `CreateEpisode` |
| `Active` | `Stale` | derivation cascade or `UpdateEpisode { status: Stale }` |
| `Active` or `Stale` | `Archived` | `UpdateEpisode { status: Archived }` |
| `Active` or `Stale` | (deleted) | `TombstoneEvidence` cascading to all supporting evidence |

A `Reject` user assertion targeting an episode transitions it to
`Stale` and triggers the substrate's derivation cascade (see
[Invariants](11-invariants.md#i-8-atomic-tombstone-cascade)).

A `Confirm` user assertion targeting an episode MAY freeze it
analogously to claim freezing; the convention does not specify
this further for v0.1.

## A.2 Suggested-action operations

Suggested actions are recommendations the system surfaces to a
user — "send this message," "review this calendar," "reconsider
this goal." They are pure UX: the system's outputs as visible to
the user, in a refutable, lifecycle-tracked form.

### A.2.1 CreateSuggestedAction

| Field | Purpose |
|-------|---------|
| `action_id` | An `ActionId`. |
| `title`, `description` | User-facing content. |
| `action_type` | Short identifier (`"set_reminder"`, `"create_album"`, `"draft_email"`, ...). |
| `source_episode` | The episode that motivated the action. |
| `supporting_claims`, `supporting_evidence` | Provenance. |
| `derivation_job` | The job that produced the action. Required when audit is in force; suggested actions then trace to inference. |
| `confidence` | Action-quality score. |

### A.2.2 UpdateActionStatus

| Field | Purpose |
|-------|---------|
| `action_id` | Target action. |
| `new_status` | `Proposed`, `Approved`, `Executing`, `Completed`, `Rejected`, `Dismissed`, `Failed`, `Expired`. |
| `execution_result` | Optional details. |

### A.2.3 Action FSM

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

Transitions:

| From | To | Cause |
|------|----|----|
| (creation) | `Proposed` | `CreateSuggestedAction` |
| `Proposed` | `Approved` | `UpdateActionStatus(Approved)` (user-authored) |
| `Proposed` | `Rejected` | `UpdateActionStatus(Rejected)` (user-authored) |
| `Proposed` | `Dismissed` | `UpdateActionStatus(Dismissed)` (user-authored) |
| `Proposed` | `Expired` | `UpdateActionStatus(Expired)` (system-authored, when relevance window passes) |
| `Approved` | `Executing` | `UpdateActionStatus(Executing)` |
| `Executing` | `Completed` | `UpdateActionStatus(Completed)` with `execution_result` |
| `Executing` | `Failed` | `UpdateActionStatus(Failed)` with `execution_result` |
| `Dismissed` | `Proposed` | `UpdateActionStatus(Proposed)` (the system may resurface a dismissed action with new evidence) |

A `Reject` user assertion on a suggested action SHOULD prevent
the system from re-proposing the same action shape; the
convention does not specify the exact mechanism for v0.1.

## A.3 Salience projection

The salience projection is a ranking-for-display surface used by
the reference implementation to decide which entities, episodes,
and suggested actions to show the user *now*.

It is not a substrate primitive: a node that is not surfacing
records to a user — for example, an organization's node consuming
a scoped slice of the graph — has no use for it. Implementations
that do surface records to users will need *some* such projection;
this section describes the shape the reference implementation
adopted, which alternative implementations may use as a starting
point.

### A.3.1 Required queries

For an implementation choosing to support the convention:

- *Top-N by salience.* Given a salience cap N and a time window,
  return the top N entities, episodes, or suggested actions
  ranked by a salience score.
- *Salience for an id.* Given an entity, episode, or suggested
  action, return its current salience score.

### A.3.2 Constraints

- The salience projection SHOULD be in-memory (or fast enough to
  the user that it functionally is).
- It SHOULD be small enough that an implementation can rebuild it
  from the log within seconds at the scale of a single user's
  data.
- It MUST NOT be used as a UI store: queries over salience return
  rankings, not display payloads. Display payloads come from the
  detail projection ([Projections, §2.3](10-projections.md#23-detail-projection)).

### A.3.3 Score composition

The reference implementation composes salience as a weighted sum
of components:

| Component | Weight | Meaning |
|-----------|--------|---------|
| Recency | 0.20 | How recently the underlying evidence arrived. |
| Corroboration | 0.20 | How many independent claims support the record. |
| Upcoming | 0.25 | Proximity to a user-visible time horizon (next event, deadline). |
| Open loops | 0.25 | Whether the record represents an unresolved commitment. |
| Affinity | 0.10 | A user-tunable weighting toward certain entity types. |

These weights are not part of the convention. They are recorded
here because they are the values the reference implementation
ships with; implementations adopting a salience projection are
free to choose their own.

## A.4 Why these are conventions, not substrate

The protocol's substrate is sufficient to express the user's
knowledge graph and synchronize it across nodes. The inference
pipeline (Part 2) is sufficient to perform distributed model
calls with auditable provenance. Together those two layers are
what makes it possible for the user to *own what the system says
about them* — the load-bearing claim of the protocol.

What episodes, suggested actions, and salience scores add is a
particular shape of *user-facing application*: narratives,
recommendations, and a ranking-for-display surface. Those shapes
are useful and the reference implementation provides them, but
they are not *constitutive of the protocol*. An implementation
without them is still a Likewise implementation; it is
just one that has chosen to surface the substrate differently.

The org-as-peer scenario is the cleanest example. A retailer
running a Likewise node holds a scoped delegation to a
user's grocery-rhythm claim. The retailer's node does not
surface anything to the user — it consumes a slice of state to
inform its own systems. Episodes, suggested actions, and salience
scoring are nonsense in that context. The substrate plus the
inference pipeline (if the retailer chooses to participate in
distributed inference) are sufficient.

## A.5 Compatibility expectations

If your implementation chooses to support these conventions, it
SHOULD do so in a way that interoperates with other
implementations that also support them. Specifically:

- Episode and SuggestedAction op variants SHOULD use the field
  shapes documented above so the reference implementation can
  consume them.
- The Episode and Action FSMs SHOULD follow the transitions
  documented above.
- Salience score composition is implementation-defined; there is
  no compatibility requirement.

If your implementation chooses *not* to support a convention,
ops of the unsupported types arriving on the wire from a
supporting peer SHOULD be silently ignored at the projection
layer. The substrate-level handling — signature verification,
authority check, application to the op log — proceeds as for
any other op; the implementation simply does not maintain the
projection state that the unsupported convention defines.

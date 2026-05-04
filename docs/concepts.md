# Concepts

This chapter is the mental model in depth. It is non-normative — the
[specification chapters](spec/00-conventions.md) are where the
must-haves live — but a reader who finishes this chapter should be
able to predict how a Likewise node would behave in most
situations, and should be able to read the spec without surprise.

## The shape

```
┌──────────────┐                       ┌──────────────┐
│   Evidence   │  immutable inputs;    │   Evidence   │
│  (immutable) │  hashed, not stored   │  (immutable) │
└──────┬───────┘  in-band              └──────┬───────┘
       │                                       │
       ▼                                       ▼
┌─────────────────────────────────────────────────────────┐
│                    Operation Log                        │
│   append-only, signed, hybrid-logical-clock ordered     │
│  ─ evidence ops ─ entity ops ─ claim ops ─ episode ─    │
│  ─ action ops ─ user assertions ─ job ops ─ ucan ─      │
└─────────────────────────────────────────────────────────┘
                          │
                          │ deterministic apply_op
                          ▼
┌─────────────────────────────────────────────────────────┐
│                     Projections                         │
│  ─ salience  ─ inference  ─ details  ─ debug graph ─    │
│         each rebuildable from the log alone             │
└─────────────────────────────────────────────────────────┘
                          │
                          │ surfaced through
                          ▼
                       Surface
              (cards, suggested actions, UI)
```

The diagram is the system. The log is canonical. The projections are
caches. The surface is the part the user touches. Everything below
that line — every claim, every recommendation, every episode — exists
because of an op that produced it, and that op is on the log.

## Evidence

Evidence is the raw material the system reasons over. A photo, a
calendar event, a contact card, a message thread, a location ping.
Evidence is **immutable**: once an evidence op lands on the log, the
content it points at does not change. Removing evidence is its own
op (`TombstoneEvidence`) which causes a derivation cascade — see
below — but the historical record of *what was once known* survives,
because removing operations would break the rebuild-from-log
invariant.

Evidence is referenced by **content hash** (BLAKE3). The hash is on
the log; the content itself need not be. An implementation may store
the photo bytes in a local blob store, in a peer's blob store, or
not at all. The protocol cares that the hash is there and is
verifiable; it does not mandate where the bytes live.

Each piece of evidence has a **source anchor**: a stable identifier
from the upstream system (calendar event UID, photo asset id) that
lets multiple nodes agree they are talking about the same external
fact, even if they extracted it slightly differently.

## Operations

An operation is a typed, signed message that mutates the log. It
carries:

- A **typed payload** (one of ~31 variants — evidence, entity, claim,
  episode, action, user assertion, job, capability, coordinator,
  routing).
- A **timestamp** in hybrid logical clock form: `(wall_ms, logical,
  node)`.
- An **author** node id.
- A **signature** by the author's key (RFC 7515 detached JWS,
  Ed25519, over the canonical encoding of the op with the signature
  field cleared).
- For sanitised ops: the signature is *cleared* on transit, signalling
  that the op has been intentionally redacted by an authorised
  caveat. Recipients distinguish "altered in transit" (corruption)
  from "deliberately sanitised by an authorised filter."

Why typed ops instead of a generic CRDT? Because the protocol's
content domain is narrow and well-understood. A typed vocabulary —
"create entity," "supersede claim," "tombstone evidence and cascade"
— gives an implementation the information it needs to maintain
projections and derivations without a generic merge engine. The
trade is expressivity: the protocol does not try to be a general
collaborative-document substrate. It tries to be a precise model of
a single user's knowledge graph.

## Time: the hybrid logical clock

Two devices that disagree about the wall clock should still agree
about what happened first. The protocol uses a hybrid logical clock
(HLC) for that: every op timestamp is `(wall_ms, logical, node)`,
and ordering is lexicographic over the triple. The wall component
keeps timestamps roughly aligned with human time; the logical
component handles bursts within a millisecond; the node id breaks
ties when two devices emit at the same `(wall, logical)`.

The clock has two disciplines, both normative:

- **Tick on emit.** Before a node writes a local op, it ticks its
  HLC, ensuring the new timestamp strictly dominates every prior
  timestamp the node knows about.
- **Recv on receive.** When a node receives a remote op, it advances
  its own HLC past the received timestamp.

If either discipline is violated, two nodes can disagree about the
order of operations they have both received. This is the kind of
quiet bug that is undetectable in test fixtures and devastating in
production.

## The causal frontier

A frontier is the per-author maximum-timestamp summary of what a node
has seen. When two nodes synchronise, they exchange frontiers and
ship each other the operations the other doesn't have. Because the
HLC induces a total order per author, "what you don't have" is a
clean set difference rather than a merkle-tree dance.

Frontiers are also the cursor for incremental sync. A node tells a
peer "send me everything past this frontier"; the peer streams the
matching ops and returns the resulting frontier as the cursor for
the next exchange.

## Entities

An entity is a stable identity for a thing in the user's life: a
person, a place, an organisation, a recurring commitment, a
project, a concept. Entities are not pre-defined by the protocol;
they are derived from evidence by the implementation's resolution
pass. The protocol specifies how an implementation merges or splits
entities and what provenance it must record when it does.

Entity identity is per-mesh, ULID-based, and survives across nodes —
once two nodes have synchronised the operation that created an
entity, they refer to it by the same id. Entity *labels* (the
human-readable name) are claims like any other and can change; the
id is what holds the cluster of claims together.

## Claims

A claim is a working hypothesis: a subject (often an entity), a
predicate (drawn from a centralized vocabulary), an object, a
confidence vector, and a set of supporting operations. "Sarah is a
close contact" is a claim. "Tuesdays are gym mornings" is a claim.

Claims have a **status** that reflects how strongly the system
believes them and whether the user has had a say:

- **Hint** — the system has noticed something but is not surfacing
  it yet.
- **Claim** — the system is operating on this as a working belief.
- **Fact** — the user has confirmed it; subsequent derivations may
  not silently override it.

Claims can be **superseded** (a newer op replaces an older claim
about the same subject and predicate) and **rejected** (user
assertion or downstream evidence invalidates them). Both
transitions are themselves operations on the log, so the history of
what the system used to believe is recoverable.

Confidence is a vector, not a scalar — the protocol carries
multiple components (e.g. evidential, derivational, temporal) so an
implementation can decide its own composition rule without losing
the underlying signal.

## The derivation DAG and provenance

Every claim links to the evidence and other claims it was derived
from — its **supporting operations**. Following those links forms a
directed acyclic graph rooted at evidence. The protocol enforces
that the derivation graph is a DAG (the entity-resolution graph may
have cycles; derivation may not), because cycles in derivation
would make invalidation undecidable.

When a piece of evidence is tombstoned, or a user rejects a claim,
the cascade walks the DAG forward and invalidates everything that
transitively depended on the source. This is what makes the
"refute" gesture in the surface mean something. The user is not
just hiding a card; they are marking a node in the graph dead, and
the system has to honour the consequences.

This is also what makes auditability mechanical. Asking "why does
the system believe X" is following the DAG backwards from the
claim to its supporting ops to the evidence at the leaves. There
is no narrative to consult — the trail is the trail.

## Episodes and suggested actions (application-layer)

The reference implementation also defines two op types that
exist purely to surface the substrate to a user. They are
*application-layer conventions*, not part of the substrate
proper, and live in
[Annex: Application Conventions](spec/annex-conventions.md). A
node that does not surface records to a user — for example, an
organisation peer — has no need to emit them.

An **episode** is a cluster of related evidence and claims with
temporal bounds: a trip, a project, a relationship, a day worth
remembering. Episodes are how the reference implementation
presents narrative instead of list.

A **suggested action** is a recommendation the system makes to
the user: send this message, review this calendar, reconsider
this goal. Suggested actions have their own lifecycle (proposed,
shown, acted, dismissed) and their own provenance link to the
inference call that produced them. They exist to make
recommendations refutable — a user's "stop suggesting this" is
itself an op that the inference pipeline must respect.

Both are documented because the reference implementation emits
them and other implementations may want to interoperate with
applications that consume them. They are not, however, what
makes a node Likewise-conformant; the substrate is.

## Projections

Reading the log directly to answer "what does the system know about
Sarah" would require a fold over millions of ops. Implementations
maintain projections: in-memory or on-disk views that an
op-application function keeps in sync with the log on every write.

The protocol distinguishes three substrate projections by
**purpose**, and the distinction is load-bearing:

- An **inference** projection is shaped for assembling a model
  context window. It is not a UI store; it is prompt furniture.
- A **detail** projection is durable, on-disk, and shaped for the
  user-facing reads ("show me everything you know about Sarah").
  It carries titles, labels, claim text, provenance links.
- A **debug-graph** projection exists for inspection tooling. It
  contains the full graph of entities and claims and is generally
  not maintained at production load.

A fourth projection — a **salience** projection used to rank
what is important *now* — is an application-layer convention,
not part of the substrate. The reference implementation provides
one; alternatives are free to substitute or omit.

The reason these are separate is that collapsing them produces a
single fat object that is too slow for ranking, too lossy for UI,
and too memory-hungry for inference contexts. Implementations are
free to optimise within each projection; they are not free to fold
them into one.

The **detail projection rebuilds from the log** when missing or
corrupted. This is the mechanism that closes the loop on the
"projections are disposable" rule: an implementation can lose
every cache and recover from the log alone.

## Capabilities

A capability is a triple `(resource, action, caveats)`:

- **Resource** — a class of operation or content (operations of a
  kind, evidence of a source type, claims with a predicate, jobs of
  a kind, episodes, artefacts, suggested actions, mesh
  coordination, registration).
- **Action** — what may be done (read, write, schedule, claim,
  complete).
- **Caveats** — narrowing constraints on the resource and action:
  - `source_types` — only evidence from these source types.
  - `predicates` — only claims with these predicates.
  - `kind_prefix` — only jobs whose kind starts with this prefix.
  - `time_range` — only ops with timestamps in this window.
  - `sanitize` — operations crossing this delegation must be passed
    through these field-level redactions: strip GPS, redact
    participants, truncate content bodies, strip custom metadata.

Capabilities are carried by **UCAN delegations** rooted at the
user. A capability is delegated by a parent, may be re-delegated by
the recipient if and only if the new delegation is *attenuated*
(its caveats are at least as restrictive as the parent's), and may
be **revoked** at any time. Revocation prunes the subgraph of
delegations beneath the revoked one and invalidates any
already-applied operations whose authority depended on the
revoked capability.

Sanitisation is the most subtle caveat. When an op crosses a
delegation that requires sanitisation, the relevant fields are
redacted *and the signature is cleared*. The recipient sees an
unsigned op tagged as sanitised, which is treated as a deliberate
filter and applied. An op without a signature that is *not* tagged
as sanitised is rejected — the missing signature would otherwise be
indistinguishable from corruption.

The capability machinery is symmetric: a delegation chain that
admits a personal device (the user's laptop, an inference server
the user runs at home) is structurally identical to one that admits
an *organisation* the user has chosen to invite in. A retailer
deploying a Likewise node, a clinic running a scheduling
assistant against a user-authorised slice of their calendar, an
employer's scheduling helper that sees only the predicates the
employee has consented to share — all of these are the same kind of
peer to the protocol. They differ only in the scope of the
delegation the user has signed. This is what makes
[consensual commercial data partnership](motivation.md#consensual-data-partnership)
a use case the protocol enables out of the box rather than a
separate machinery.

## Mesh coordination

Multiple nodes can do work for the same user. The protocol provides
a vocabulary for who claims what:

- **`ScheduleJob`** — declare that a unit of work needs to happen
  (e.g., "synthesise an episode for last week").
- **`ClaimWork`** — a node takes responsibility for a scheduled
  job, with a hybrid-logical-clock-relative lease.
- **`CompleteJob`** — the work is done; the result is written as
  follow-on ops the rest of the mesh receives on next sync.
- **`YieldWork`** — the claiming node is releasing the lease
  voluntarily.
- **`ExpireWork`** — the lease passed without a completion; another
  node may now claim.

Two further ops shape *who* does what:

- **`DesignateCoordinator`** — the user (or a delegate) designates
  the node responsible for the deterministic derivation pass. This
  is not an election; it is a declaration. The coordinator's
  output is what the mesh agrees to derive from a given log
  prefix.
- **`RouteKind`** — the user routes a class of jobs to a specific
  node. Once routed, only the target node may claim jobs of that
  kind. Used to direct heavy inference to a server while keeping
  the phone in charge of the log.

These ops use the same UCAN-shape capabilities as everything else:
scheduling a job requires `Schedule` on `Job`; claiming requires
`Claim` on `Job` with a `kind_prefix` caveat that admits the kind.

## Inference auditing

When a node operating under audit calls a model, the call itself
becomes an op. Specifically, a `likewise.inference.snapshot`
artefact is written to the log recording the retrieved context
(the evidence and claims fed into the prompt), the model
identity, telemetry (latency, token counts, backend), and the
output. Any claim or suggested action the call produced links
back to the snapshot.

Audit is in force in two cases: when the node is operating under
the user's root delegation (a node the user runs themselves),
and when the node is operating under a delegation whose
`audit_inference` caveat the user has set to `true`. A delegated
node operating without an audit caveat is not required by the
protocol to record its inference; what it does internally is
governed by the delegation's other caveats. The user retains the
choice; the protocol enforces it when chosen.

Snapshots are first-class artefacts and follow the same lifecycle:
they have TTLs, they can be evicted, they can be tombstoned with
their underlying evidence. While they exist, they are the
authoritative answer to "why did the system say that."

The full mechanism is specified in
[Inference Audit](spec/13-inference-audit.md).

## The six rules in plain English

These are the non-negotiable rules from the [Invariants](spec/11-invariants.md)
chapter, restated without normative language so the intent is clear:

1. **Only operations change the truth.** Caches and projections do
   not. Anything you can't reproduce by replaying the log is not
   real.
2. **Every claim has provenance.** No fact about the user appears
   without a chain back to evidence the user provided.
3. **Derivation is a DAG, and refutations cascade.** Marking
   something wrong has consequences the system has to honour.
4. **Sync converges operations, not projections.** Two nodes that
   have seen the same ops agree on truth, regardless of how each
   chose to materialise it.
5. **Every op is signed.** Identity is per-device, anchored at the
   user's root delegation. There are no anonymous writes.
6. **Inference is auditable.** On the user's own nodes, every model
   call is recorded as a referenceable op by default. On nodes
   the user has delegated to, audit is opt-in via a caveat the
   user attaches to the delegation.

A system that violates any of these breaks the user's ability to
own what it says about them. The rest of the spec exists to make
those rules precise enough to implement.

## Three layers, one specification

The specification is organised into three explicit layers that
match the architecture above:

- **Part 1: The substrate.** Evidence, claims, entities, sync,
  signatures, capabilities, the substrate projections. This is
  what every conformant node implements. It is sufficient on its
  own to express and synchronise a user-owned knowledge graph
  across an arbitrary set of authorised peers, including
  organisational peers.
- **Part 2: The inference pipeline.** Job scheduling and claiming,
  routing kinds to specific nodes, and the inference-snapshot
  artefact convention that gives the system its audit trail.
  An implementation that wants to participate in distributed
  audited inference implements Part 2 on top of Part 1; an
  implementation that doesn't (a substrate-only peer) ignores
  it entirely.
- **Annex: Application conventions.** Episodes, suggested
  actions, and the salience-ranking projection — the
  reference implementation's choices for surfacing the
  substrate to a user. These are not normative; alternative
  implementations are free to substitute their own application
  layer.

This split is load-bearing for the org-as-peer scenario: a
retailer's node implementing Part 1 (and optionally Part 2) is
fully conformant without ever touching the application
conventions. A user-facing node in the spirit of the reference
implementation will typically implement all three layers.

## Where to go next

- [Comparison](comparison.md) — how this protocol relates to other
  decentralized-data work.
- [Conventions](spec/00-conventions.md) — the start of the
  normative specification.

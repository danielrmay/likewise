# Comparison with adjacent work

This chapter is an honest contrast between Cortex Protocol and other
public work in the decentralized-data and personal-AI space. The aim
is not to persuade. It is to give a reader who already knows one of
these projects the shortest possible path to understanding what
Cortex Protocol does differently — and, importantly, where another
project does something better and Cortex Protocol should not be
chosen.

The protocol is young. Several of the projects below are not. None
of what follows is meant to disparage them; they are the reason
Cortex Protocol could be designed at all.

## Solid

Solid (Tim Berners-Lee's project, ongoing at MIT and Inrupt) returns
control of personal data to users by storing it in user-owned
**Pods** that any application can read or write with permission. The
goal is to break data silos so multiple apps can interoperate over
the same RDF graph the user owns.

A Pod is an HTTP server exposing Linked Data Platform containers and
RDF resources (Turtle, JSON-LD). Identity is **WebID** (an HTTP URI
that dereferences to a profile document) authenticated via Solid-OIDC.
Authorization is **Web Access Control** or **Access Control Policy**
— ACL documents attached to resources. Mutation is plain HTTP CRUD.
The Solid Notifications Protocol pushes resource updates over
WebSocket / WebHook.

**Where it overlaps with Cortex Protocol.** Both treat "your data,
your server" as the foundational stance. Both decentralize identity.
Both have capability-flavoured access control. Both expect external
applications to operate on a graph the user owns.

**Where it diverges.** Solid is CRUD-on-RDF-resources; Cortex Protocol
is an append-only signed-op log with deterministic projections.
Solid has no concept of evidence-claim-episode lineage, no causal
ordering (no HLC or vector clock), no per-op signatures, no inference
auditing, and no work routing. Pods assume an always-online HTTP
origin; Cortex Protocol expects a small mesh of user-owned devices
with intermittent connectivity. Solid leans on the open-world
semantics of RDF; Cortex Protocol's predicate vocabulary is
centralised and lint-enforced for the same reasons it has typed ops
in the first place.

**Sources:** [Solid Project](https://solidproject.org/),
[Solid Specification](https://solid.github.io/specification/),
[Solid Protocol](https://solidproject.org/TR/protocol).

## AT Protocol

AT Protocol (Bluesky) decentralizes social networking by giving each
user a portable, content-addressed repository that can move between
hosting providers (Personal Data Servers, or PDSes). Relays aggregate
a public firehose so anyone can build a feed, index, or app over the
network without a central gatekeeper.

Each user has a DID resolving to a signing key and service endpoint.
Their PDS holds a repo: a Merkle Search Tree of records (DAG-CBOR /
IPLD), each commit signed by the account key. Records conform to
**Lexicons** — typed JSON schemas named with NSIDs. Sync is via the
firehose (a WebSocket stream of commits) and CAR-file repo export
for migration.

**Where it overlaps with Cortex Protocol.** This is the closest cousin
in the list. Both: per-user signed log, content-addressed records,
account/key portability, schema-typed records (Lexicons play the
role Cortex Protocol's typed op variants play), single-author repos
with cryptographic verification independent of the host. The shape
"signed append-only repo plus sync from a frontier" is the same
pattern.

**Where it diverges.** AT Protocol is *public-by-default broadcast*
designed for global indexing — relays slurp everyone's firehose so
anyone can build a search engine over the network. Cortex Protocol
is *private-by-default mesh*, gated by UCAN delegations with
sanitisation caveats, where every op crossing the wire passes
through a capability filter. AT has no UCAN-style delegation, no
work scheduling or routing, no inference-snapshot artefacts, no
multi-projection materialisation, no evidence→claim→episode
derivation DAG, and no derived-data invalidation. AT records are
user-authored social objects; Cortex Protocol ops include
machine-derived hypotheses with provenance back to evidence and a
mechanism for the user to refute them.

If you want public discoverability and a thriving third-party
indexing ecosystem, AT Protocol is the right tool. If you want a
private mesh of a single user's own devices, the goals diverge
enough that they are not really competitors.

**Sources:** [AT Protocol](https://atproto.com/),
[AT Protocol Specification](https://atproto.com/specs/atp),
[Data Repositories](https://atproto.com/guides/data-repos).

## Nostr

Nostr ("Notes and Other Stuff Transmitted by Relays") is a
censorship-resistant publish-subscribe substrate. Users sign events
with a keypair and broadcast them to multiple relays; readers
subscribe to relays and verify signatures locally, so no single
relay can silence a user.

Identity is a secp256k1 keypair. The wire unit is an event with a
signed `(id, pubkey, created_at, kind, tags, content, sig)`
envelope. Kinds are integers (0 = profile, 1 = text note, 3 =
follows, 30000+ = addressable). Relays speak a small WebSocket
protocol. There is no causal ordering, no consensus, and no
required durability.

**Where it overlaps with Cortex Protocol.** Per-event signing with a
user-owned key. Multi-host distribution. Client-side verification.
The "everything is a signed event with a kind" mental model rhymes
with Cortex Protocol's signed-op log with typed payload variants.

**Where it diverges.** Nostr has no causal frontier — events are
effectively a flat set ordered by `created_at`, which is whatever
the user picks. There is no delegation-with-attenuation that has
seen serious adoption (NIP-26 was largely abandoned). There is no
derived state, no projections, no evidence-or-claim model, no work
routing. Nostr is intentionally public broadcast; encrypted DMs
exist but are a thin add-on. Nostr's tag system is freeform and
emergent; Cortex Protocol's predicate vocabulary is centralised and
small by design, because predictable derivation requires a closed
vocabulary.

**Sources:** [Nostr](https://nostr.com/),
[NIPs](https://github.com/nostr-protocol/nips).

## Iroh

Iroh ("dial keys, not IPs") is a modular Rust networking stack that
gives any two devices an end-to-end-encrypted QUIC connection
identified by public key, traversing NATs via relay servers when
direct holepunching fails. Higher-level protocols (blobs, docs,
gossip) sit on top of the transport.

NodeId is an Ed25519 public key. iroh-blobs handles BLAKE3
content-addressed transfer with resumable verified streaming.
iroh-docs is a multi-writer key-value replica. iroh-gossip does
epidemic broadcast. iroh-willow is in development as a next-gen
replacement using the Willow data model.

**Where it overlaps with Cortex Protocol.** Both target multi-device
sync over hostile networks. Both are Rust-first. Both use Ed25519
keys as the identity primitive. Both content-address payloads
(BLAKE3 in Iroh, hash-referenced evidence in Cortex Protocol).
iroh-docs replicas with a per-author key look superficially like
Cortex Protocol's signed-op log with a per-node identity.

**Where it diverges.** Iroh is **transport plus sync primitives**,
not a domain model. It has no claims, episodes, inference
snapshots, UCAN delegation graph, projection model, or
scheduled-work vocabulary. Iroh's authorization story beyond
namespace write-keys is intentionally underspecified.

This is largely a non-overlap. Cortex Protocol could plausibly be
implemented *over* Iroh's transport — replacing today's HTTP +
reqwest layer with iroh-net QUIC connections — and the result would
be additive rather than competitive. Today's reference
implementation uses HTTP because it is sufficient for a LAN mesh.

**Sources:** [Iroh](https://www.iroh.computer/),
[Iroh Docs](https://docs.iroh.computer/),
[iroh-willow](https://github.com/n0-computer/iroh-willow).

## Local-first software (Ink & Switch)

The local-first manifesto is not a protocol; it is the essay that
named seven ideals modern cloud apps fail at: no spinners,
multi-device, offline, seamless collaboration, longevity,
privacy/security, and user ownership. The essay surveys CRDTs (and
Automerge in particular) as candidate plumbing, but the seven
ideals are values, not specifications.

**Where it overlaps with Cortex Protocol.** Cortex Protocol is
squarely a local-first system by these criteria — every ideal is a
design goal. The "rebuild projections from the op log" stance
directly serves longevity (#5: works in 10 years) and ownership
(#7: you own your data). The single-user multi-device mesh
addresses multi-device (#2) and offline (#3). The capability-gated
sharing model serves privacy (#6). And so on.

**Where it diverges.** The manifesto leans on CRDT auto-merge of
arbitrary structured documents as the canonical answer to
multi-device sync. Cortex Protocol uses an append-only signed log
with deterministic projections and last-write-wins-by-OpId for
entity merges, not a generic CRDT. This is a deliberate choice:
the data domain is narrow enough that a typed op vocabulary is
more precise than a generic mergeable document model, and easier to
reason about for derivation. The price is that Cortex Protocol is
not the right tool for collaborative document editing across
multiple users — it is single-user-mesh, not multi-user-collab.

The manifesto is also silent on something Cortex Protocol has a
strong opinion about: derived intelligence with auditable
provenance. Local-first thinking informed Cortex Protocol; Cortex
Protocol commits to a stance the manifesto does not take.

**Source:** [Local-First Software](https://www.inkandswitch.com/essay/local-first/).

## UCAN — a building block, not a competitor

UCAN (User-Controlled Authorization Network) is offline-verifiable,
decentralized authorization. Instead of an OAuth server issuing
tokens, the resource owner signs a delegation directly to a
delegate, who can re-delegate (attenuated) further. Verification is
purely cryptographic: walk the chain, check signatures and
attenuation.

A token is a signed envelope over `{iss, aud, sub, cmd, policy, exp,
nbf, …}`. UCAN v1.0 (DAG-CBOR + Varsig + CIDv1 envelopes) is the
current direction of the working group; v0.10 was the last
JWT-shaped revision.

**How Cortex Protocol uses UCAN.** Every `DelegateUcan` op carries
a v0.10 token; an implementation's UCAN view materialises the
delegation graph and enforces strict attenuation per hop. Cortex
Protocol **extends UCAN's policy/caveat slot** with a domain-specific
caveat set: `source_types`, `predicates`, `kind_prefix`,
`time_range`, and a `sanitize` directive (StripGeo,
RedactParticipants, TruncateContent, StripCustomMetadata). These
plug into a capability policy engine that runs authorization plus
transitive-cascade plus field-level sanitisation on every outbound
op stream. Cortex Protocol also extends the Resource and Action
enums with `Job` and `Schedule` so work routing rides the same
delegation graph.

**Migration cost.** Cortex Protocol is currently on UCAN v0.10. The
v0.10 → v1.0 migration is non-trivial (envelope format and
canonicalisation differ) and is tracked as
[an open issue](spec/99-open-issues.md).

**Sources:** [UCAN Specification](https://github.com/ucan-wg/spec),
[ucan.xyz](https://ucan.xyz/).

## Automerge

Automerge is a CRDT library and sync engine for collaborative
document editing. Documents are JSON-shaped CRDTs with full op
history; the sync protocol exchanges Bloom-filtered have/need
summaries until peers converge. Works over any byte transport.

**Where it overlaps with Cortex Protocol.** Both are
append-history-based and target offline-first multi-device. Cortex
Protocol's "rebuild projections from op log" is structurally
similar to Automerge's "materialise document state from op
history."

**Where it diverges.** Automerge is content-agnostic — it merges
generic JSON. Cortex Protocol's ops are typed and domain-specific.
Automerge has no built-in authorization model; Cortex Protocol has
UCAN end-to-end. Conflict resolution: Automerge uses CRDT merge
semantics per field; Cortex Protocol uses last-write-wins-by-OpId
for entities (with deterministic cycle resolution). Cortex
Protocol's approach is simpler and less expressive, but it is
better suited to derived data, where "the latest user assertion
wins" is the right rule.

For collaborative editing across multiple users, Automerge wins.
Cortex Protocol is not trying to play that game.

**Source:** [Automerge](https://automerge.org/).

## Willow Protocol

Willow (2023+) is an authenticated-sync protocol designed for
partial replication of large keyed datasets with capability-based
access control and **confidential sync** — peers only learn about
data they are authorised to see, including not learning *what they
are missing*.

Data lives in namespaces, subspaces, paths, and entries. An entry
is `(namespace_id, subspace_id, path, timestamp, payload_length,
payload_digest)`. Subspaces typically map one-per-author. Prefix
pruning gives "destructive editing": writing at `blog/idea` with a
newer timestamp deletes all `blog/idea/*` descendants.
Authorization is **Meadowcap**, a capability system supporting both
owned (top-down) and communal (bottom-up) namespaces. Confidential
sync uses private-set-intersection-style techniques.

**Where it overlaps with Cortex Protocol.** This is the closest
*architectural* cousin. Capability-based auth (Meadowcap rhymes
with UCAN-plus-caveats), per-author signed entries (analogous to
Cortex Protocol's signed ops), partial sync (Willow's range-based
"area of interest" rhymes with Cortex Protocol's frontier-plus-filter),
timestamp ordering. iroh-willow brings these capabilities into the
same Rust ecosystem Cortex Protocol's reference implementation
inhabits.

**Where it diverges.** Willow is a **storage and sync substrate**,
not a knowledge model. It has no claims, episodes, inference
snapshots, derivation DAG, or work routing. It is the layer
underneath what Cortex Protocol does. Conversely, Willow's
confidential sync is **stronger than what Cortex Protocol does
today** — Cortex Protocol relies on the sender honestly applying
its capability filter server-side, where Willow's design prevents
peers from probing for unauthorised data at all. This is a real
gap, and one we expect to close some day; it is tracked as an
[open issue](spec/99-open-issues.md). Willow's destructive
editing via prefix-pruning is also more aggressive than Cortex
Protocol's tombstone-cascade (which preserves the log and only
invalidates derivations).

If Willow had existed when Cortex Protocol started, this
specification might be a knowledge-graph model defined *over*
Willow rather than alongside it. The right relationship may yet
turn out to be that one.

**Sources:** [Willow Protocol](https://willowprotocol.org/),
[Willow Data Model](https://willowprotocol.org/specs/data-model/index.html).

## Honest synthesis

### What Cortex Protocol contributes that the projects above don't

- **A typed knowledge-graph vocabulary** (evidence → claim → entity
  → episode → action) baked into the op log, not modeled on top of
  a generic store. Lexicons (AT) and predicates (Solid/RDF) get
  close, but they are schema systems, not lifecycle models with
  derivation DAGs and tombstone-cascade semantics.
- **Inference auditability as a separable layer.** The protocol
  defines a `cortex.inference.snapshot` artefact type and a
  conditional invariant that requires snapshots from any node
  operating under the user's root delegation, or under a
  delegation whose `audit_inference` caveat the user has set. Every
  audited model call lands as a snapshot recording retrieved
  context, model identity, telemetry, and output; derived records
  link back. None of the surveyed protocols treat machine-derived
  state as a thing that needs provenance back to evidence. The
  audit pipeline is a *separable layer* (Part 2 of the
  specification), so a substrate-only peer — for example, an
  organisation node receiving a scoped slice of the user's graph —
  is conformant without participating in audit unless the user
  required it via caveat.
- **Domain-extended UCAN caveats including
  `audit_inference`** — the v0.1 caveat vocabulary
  (`source_types`, `predicates`, `kind_prefix`, `time_range`,
  `sanitize`, `audit_inference`) covers both data scoping and
  behavioural requirements. UCAN itself is the building block;
  the caveat vocabulary is Cortex Protocol's contribution.
- **Work routing in the same op log** (`ScheduleJob`, `ClaimWork`,
  `RouteKind`) so heterogeneous nodes — phone without inference,
  server with GPU — cooperate via the same delegation graph that
  gates data access. AT, Solid, Nostr have no equivalent; Iroh has
  a separate task system at a different layer.
- **An opinionated read-path projection split** (salience,
  inference, detail, debug-graph) tuned for on-device LLM prompting,
  UI reads, and ranking from a single log.
- **A substrate for consensual commercial data sharing.** The
  capabilities, caveats, and sanitisation rules that secure the
  user's own mesh generalise directly to delegations to
  *organisations* the user invites in. A retailer's node, a
  clinic's node, an employer's scheduling assistant — each can run
  a conformant peer with a scope-restricted view of the user's
  graph, receiving only the claims the user authorised, with
  sanitisation enforced at the wire boundary. None of the projects
  above target this user-org-consent shape: they are either
  personal-only (Iroh, local-first, Automerge) or
  public-broadcast (AT, Nostr), with Solid the closest in
  spirit but lacking the caveat + sanitisation vocabulary that
  makes scoped commercial sharing tractable in practice. See
  [Motivation: Consensual data partnership](motivation.md#consensual-data-partnership).

### What Cortex Protocol doesn't do that one of these does well

- **Confidential sync.** Willow's design prevents peers from
  probing for data they are not authorised to see. Cortex Protocol
  relies on the sender honestly applying its capability filter
  server-side. Closing this gap is an
  [open issue](spec/99-open-issues.md).
- **Generic structural merging.** For collaborative text or list
  editing across users, Automerge is better. Cortex Protocol's
  last-write-wins-by-OpId is deliberately coarse, because the
  domain doesn't need finer.
- **Public discoverability and third-party indexing.** AT
  Protocol's firehose model is the right tool for "anyone can
  build an app over the public stream." Cortex Protocol is
  private-by-default and would have to add new machinery to do
  this; we have no current plans to.
- **Mature ecosystem of clients and apps.** Solid has Inrupt and
  the Community Solid Server. AT has Bluesky and the wider
  ATmosphere. Nostr has dozens of clients. Cortex Protocol has one
  pre-1.0 reference implementation. The ecosystem cost is real.
- **Account portability across hosts.** AT Protocol's DID +
  CAR-export migration is more developed than Cortex Protocol's
  story, which assumes the user owns all participating nodes
  rather than migrating between hosting providers.
- **NAT traversal and transport.** Iroh's holepunching plus relay
  stack is what you would want for cross-network device sync.
  Cortex Protocol's HTTP loopback transport is sufficient for a
  LAN mesh; an Iroh-backed transport is plausible future work.
- **UCAN v1.0.** Cortex Protocol is on v0.10 (JWT shape); the
  ecosystem is migrating to v1.0 envelopes (DAG-CBOR plus Varsig).
  This is technical debt, not a design choice.

### The honest one-line summary

If you want public-network social, choose AT Protocol. If you want
collaborative editing, choose Automerge. If you want a capability-
based confidential-sync substrate, watch Willow closely. If you
want a *knowledge graph of yourself, owned by you, with auditable
inference and a private mesh of your own devices* — that's what
this protocol is for, and we don't currently know of another
public specification that targets the same brief.

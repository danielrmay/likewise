# Comparison with adjacent work

This chapter is an honest contrast between Likewise and other
public work in the decentralized-data and personal-AI space. The aim
is not to persuade. It is to give a reader who already knows one of
these projects the shortest possible path to understanding what
Likewise does differently — and, importantly, where another
project does something better and Likewise should not be
chosen.

The protocol is young. Several of the projects below are not. None
of what follows is meant to disparage them; they are the reason
Likewise could be designed at all.

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

**Where it overlaps with Likewise.** Both treat "your data,
your server" as the foundational stance. Both decentralize identity.
Both have capability-flavored access control. Both expect external
applications to operate on a graph the user owns.

**Where it diverges.** Solid is CRUD-on-RDF-resources; Likewise
is an append-only signed-op log with deterministic projections.
Solid has no concept of evidence-claim-episode lineage, no causal
ordering (no HLC or vector clock), no per-op signatures, no inference
auditing, and no work routing. Pods assume an always-online HTTP
origin; Likewise expects a small mesh of user-owned devices
with intermittent connectivity. Solid leans on the open-world
semantics of RDF; Likewise's predicate vocabulary is
centralized and lint-enforced for the same reasons it has typed ops
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

**Where it overlaps with Likewise.** This is the closest cousin
in the list. Both: per-user signed log, content-addressed records,
account/key portability, schema-typed records (Lexicons play the
role Likewise's typed op variants play), single-author repos
with cryptographic verification independent of the host. The shape
"signed append-only repo plus sync from a frontier" is the same
pattern.

**Where it diverges.** AT Protocol is *public-by-default broadcast*
designed for global indexing — relays slurp everyone's firehose so
anyone can build a search engine over the network. Likewise
is *private-by-default mesh*, gated by UCAN delegations with
sanitization caveats, where every op crossing the wire passes
through a capability filter. AT has no UCAN-style delegation, no
work scheduling or routing, no inference-snapshot artifacts, no
multi-projection materialization, no evidence→claim→episode
derivation DAG, and no derived-data invalidation. AT records are
user-authored social objects; Likewise ops include
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

**Where it overlaps with Likewise.** Per-event signing with a
user-owned key. Multi-host distribution. Client-side verification.
The "everything is a signed event with a kind" mental model rhymes
with Likewise's signed-op log with typed payload variants.

**Where it diverges.** Nostr has no causal frontier — events are
effectively a flat set ordered by `created_at`, which is whatever
the user picks. There is no delegation-with-attenuation that has
seen serious adoption (NIP-26 was largely abandoned). There is no
derived state, no projections, no evidence-or-claim model, no work
routing. Nostr is intentionally public broadcast; encrypted DMs
exist but are a thin add-on. Nostr's tag system is freeform and
emergent; Likewise's predicate vocabulary is centralized and
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

**Where it overlaps with Likewise.** Both target multi-device
sync over hostile networks. Both are Rust-first. Both use Ed25519
keys as the identity primitive. Both content-address payloads
(BLAKE3 in Iroh, hash-referenced evidence in Likewise).
iroh-docs replicas with a per-author key look superficially like
Likewise's signed-op log with a per-node identity.

**Where it diverges.** Iroh is **transport plus sync primitives**,
not a domain model. It has no claims, episodes, inference
snapshots, UCAN delegation graph, projection model, or
scheduled-work vocabulary. Iroh's authorization story beyond
namespace write-keys is intentionally underspecified.

This is largely a non-overlap. Likewise could plausibly be
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

**Where it overlaps with Likewise.** Likewise is
squarely a local-first system by these criteria — every ideal is a
design goal. The "rebuild projections from the op log" stance
directly serves longevity (#5: works in 10 years) and ownership
(#7: you own your data). The single-user multi-device mesh
addresses multi-device (#2) and offline (#3). The capability-gated
sharing model serves privacy (#6). And so on.

**Where it diverges.** The manifesto leans on CRDT auto-merge of
arbitrary structured documents as the canonical answer to
multi-device sync. Likewise uses an append-only signed log
with deterministic projections and last-write-wins-by-OpId for
entity merges, not a generic CRDT. This is a deliberate choice:
the data domain is narrow enough that a typed op vocabulary is
more precise than a generic mergeable document model, and easier to
reason about for derivation. The price is that Likewise is
not the right tool for collaborative document editing across
multiple users — it is single-user-mesh, not multi-user-collab.

The manifesto is also silent on something Likewise has a
strong opinion about: derived intelligence with auditable
provenance. Local-first thinking informed Likewise; Likewise
commits to a stance the manifesto does not take.

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

**How Likewise uses UCAN.** Every `DelegateUcan` op carries
a v0.10 token; an implementation's UCAN view materializes the
delegation graph and enforces strict attenuation per hop. Likewise
**extends UCAN's policy/caveat slot** with a domain-specific
caveat set: `source_types`, `predicates`, `kind_prefix`,
`time_range`, and a `sanitize` directive (StripGeo,
RedactParticipants, TruncateContent, StripCustomMetadata). These
plug into a capability policy engine that runs authorization plus
transitive-cascade plus field-level sanitization on every outbound
op stream. Likewise also extends the Resource and Action
enums with `Job` and `Schedule` so work routing rides the same
delegation graph.

**Migration cost.** Likewise is currently on UCAN v0.10. The
v0.10 → v1.0 migration is non-trivial (envelope format and
canonicalization differ) and is tracked as
[an open issue](99-open-issues.md).

**Sources:** [UCAN Specification](https://github.com/ucan-wg/spec),
[ucan.xyz](https://ucan.xyz/).

## Automerge

Automerge is a CRDT library and sync engine for collaborative
document editing. Documents are JSON-shaped CRDTs with full op
history; the sync protocol exchanges Bloom-filtered have/need
summaries until peers converge. Works over any byte transport.

**Where it overlaps with Likewise.** Both are
append-history-based and target offline-first multi-device.
Likewise's "rebuild projections from op log" is structurally
similar to Automerge's "materialize document state from op
history."

**Where it diverges.** Automerge is content-agnostic — it merges
generic JSON. Likewise's ops are typed and domain-specific.
Automerge has no built-in authorization model; Likewise has
UCAN end-to-end. Conflict resolution: Automerge uses CRDT merge
semantics per field; Likewise uses last-write-wins-by-OpId
for entities (with deterministic cycle resolution). Its
approach is simpler and less expressive, but it is
better suited to derived data, where "the latest user assertion
wins" is the right rule.

For collaborative editing across multiple users, Automerge wins.
Likewise is not trying to play that game.

**Source:** [Automerge](https://automerge.org/).

## Ossa

Ossa (James Parker, August 2025) is a draft peer-to-peer protocol
for replacing centralized cloud apps with locally-stored,
encrypted, CRDT-synchronized data. Stores are polymorphic state
containers identified by content hash and discoverable via a
distributed hash table; updates form a DAG of digitally signed,
encrypted CRDT operations; access-control changes go through a
Byzantine fault-tolerant consensus protocol. End-to-end
encryption is the default; offline editing is supported with
automatic sync on reconnection.

**Where it overlaps with Likewise.** Both projects share the
local-first stance — Kleppmann is foundational reading for both
— and both are append-history-based with per-user keys as the
identity primitive and content-addressed payloads. Where
Likewise's reference implementation wants a small mesh of
user-owned devices, Ossa wants the same thing. Both projects
could plausibly be implemented over the same underlying
transport.

**Where it diverges.** Ossa is a *generic data-sync substrate* —
it has zero opinion on what the data is, only on how replicas
converge. Stores are polymorphic; data types are required to be
CRDTs. Likewise's whole premise, by contrast, is the typed
knowledge-graph vocabulary baked into the op log, with
deterministic projections rather than generic CRDT merge, and
last-write-wins-by-OpId rather than per-field CRDT semantics.
Authorization diverges similarly: Ossa uses Byzantine
fault-tolerant consensus for access-control changes; Likewise
uses UCAN delegation with attenuated caveats and per-op
signatures. Most importantly, Ossa has no analogue for the
inference layer (Part 2), the audit invariant, or the
claim-derivation DAG. The two projects sit at different layers:
Ossa is closest to the Iroh / Automerge / Willow constellation
(substrate); Likewise sits on top of any substrate of that shape
with a typed knowledge-graph model and an auditable-inference
layer.

**Source:** [Ossa: Toward the Next Generation Web](https://jamesparker.me/blog/post/2025/08/04/ossa-toward-the-next-generation-web).

## Willow Protocol

Willow (2023+) is an authenticated-sync protocol designed for
partial replication of large keyed datasets with capability-based
access control and **confidential sync** — peers only learn about
data they are authorized to see, including not learning *what they
are missing*.

Data lives in namespaces, subspaces, paths, and entries. An entry
is `(namespace_id, subspace_id, path, timestamp, payload_length,
payload_digest)`. Subspaces typically map one-per-author. Prefix
pruning gives "destructive editing": writing at `blog/idea` with a
newer timestamp deletes all `blog/idea/*` descendants.
Authorization is **Meadowcap**, a capability system supporting both
owned (top-down) and communal (bottom-up) namespaces. Confidential
sync uses private-set-intersection-style techniques.

**Where it overlaps with Likewise.** This is the closest
*architectural* cousin. Capability-based auth (Meadowcap rhymes
with UCAN-plus-caveats), per-author signed entries (analogous to
Likewise's signed ops), partial sync (Willow's range-based
"area of interest" rhymes with Likewise's frontier-plus-filter),
timestamp ordering. iroh-willow brings these capabilities into the
same Rust ecosystem Likewise's reference implementation
inhabits.

**Where it diverges.** Willow is a **storage and sync substrate**,
not a knowledge model. It has no claims, episodes, inference
snapshots, derivation DAG, or work routing. It is the layer
underneath what Likewise does. Conversely, Willow's
confidential sync is **stronger than what Likewise does
today** — Likewise relies on the sender honestly applying
its capability filter server-side, where Willow's design prevents
peers from probing for unauthorized data at all. This is a real
gap, and one we expect to close some day; it is tracked as an
[open issue](99-open-issues.md). Willow's destructive
editing via prefix-pruning is also more aggressive than
Likewise's tombstone-cascade (which preserves the log and only
invalidates derivations).

If Willow had existed when Likewise started, this
specification might be a knowledge-graph model defined *over*
Willow rather than alongside it. The right relationship may yet
turn out to be that one.

**Sources:** [Willow Protocol](https://willowprotocol.org/),
[Willow Data Model](https://willowprotocol.org/specs/data-model/index.html).

## Honest synthesis

### What Likewise contributes that the projects above don't

- **A typed knowledge-graph vocabulary** (evidence → claim → entity
  → episode → action) baked into the op log, not modeled on top of
  a generic store. Lexicons (AT) and predicates (Solid/RDF) get
  close, but they are schema systems, not lifecycle models with
  derivation DAGs and tombstone-cascade semantics.
- **Inference auditability as a separable layer.** The protocol
  defines a `likewise.inference.snapshot` artifact type and a
  conditional invariant that requires snapshots from any node
  operating under the user's root delegation, or under a
  delegation whose `audit_inference` caveat the user has set. Every
  audited model call lands as a snapshot recording retrieved
  context, model identity, telemetry, and output; derived records
  link back. None of the surveyed protocols treat machine-derived
  state as a thing that needs provenance back to evidence. The
  audit pipeline is a *separable layer* (Part 2 of the
  specification), so a substrate-only peer — for example, an
  organization node receiving a scoped slice of the user's graph —
  is conformant without participating in audit unless the user
  required it via caveat.
- **Domain-extended UCAN caveats including
  `audit_inference`** — the v0.1 caveat vocabulary
  (`source_types`, `predicates`, `kind_prefix`, `time_range`,
  `sanitize`, `audit_inference`) covers both data scoping and
  behavioural requirements. UCAN itself is the building block;
  the caveat vocabulary is Likewise's contribution.
- **Work routing in the same op log** (`ScheduleJob`, `ClaimWork`,
  `RouteKind`) so heterogeneous nodes — phone without inference,
  server with GPU — cooperate via the same delegation graph that
  gates data access. AT, Solid, Nostr have no equivalent; Iroh has
  a separate task system at a different layer.
- **An opinionated read-path projection split** (salience,
  inference, detail, debug-graph) tuned for on-device LLM prompting,
  UI reads, and ranking from a single log.
- **A substrate for consensual commercial data sharing.** The
  capabilities, caveats, and sanitization rules that secure the
  user's own mesh generalize directly to delegations to
  *organisations* the user invites in. A retailer's node, a
  clinic's node, an employer's scheduling assistant — each can run
  a conformant peer with a scope-restricted view of the user's
  graph, receiving only the claims the user authorized, with
  sanitization enforced at the wire boundary. None of the projects
  above target this user-org-consent shape: they are either
  personal-only (Iroh, local-first, Automerge) or
  public-broadcast (AT, Nostr), with Solid the closest in
  spirit but lacking the caveat + sanitization vocabulary that
  makes scoped commercial sharing tractable in practice. See
  [Motivation: Consensual data partnership](motivation.md#consensual-data-partnership).

### What Likewise doesn't do that one of these does well

- **Confidential sync.** Willow's design prevents peers from
  probing for data they are not authorized to see. Likewise
  relies on the sender honestly applying its capability filter
  server-side. Closing this gap is an
  [open issue](99-open-issues.md).
- **Generic structural merging.** For collaborative text or list
  editing across users, Automerge is better. Likewise's
  last-write-wins-by-OpId is deliberately coarse, because the
  domain doesn't need finer.
- **Public discoverability and third-party indexing.** AT
  Protocol's firehose model is the right tool for "anyone can
  build an app over the public stream." Likewise is
  private-by-default and would have to add new machinery to do
  this; we have no current plans to.
- **Mature ecosystem of clients and apps.** Solid has Inrupt and
  the Community Solid Server. AT has Bluesky and the wider
  ATmosphere. Nostr has dozens of clients. Likewise has one
  pre-1.0 reference implementation. The ecosystem cost is real.
- **Account portability across hosts.** AT Protocol's DID +
  CAR-export migration is more developed than Likewise's
  story, which assumes the user owns all participating nodes
  rather than migrating between hosting providers.
- **NAT traversal and transport.** Iroh's holepunching plus relay
  stack is what you would want for cross-network device sync.
  Likewise's HTTP loopback transport is sufficient for a
  LAN mesh; an Iroh-backed transport is plausible future work.
- **UCAN v1.0.** Likewise is on v0.10 (JWT shape); the
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

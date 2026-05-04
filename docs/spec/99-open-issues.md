# Open Issues

This chapter catalogues known cross-implementation hazards in
v0.1 of the specification. Each entry describes the issue, the
concrete risk it presents, and the direction of the eventual
resolution. Some of these will be addressed in a future minor
version; some will require a major version. Where this chapter
makes commitments to future versions, those commitments are
non-normative.

The chapter exists for two reasons. First, hiding known
hazards from implementers is a worse outcome than acknowledging
them up front. Second, an open public list of known issues is
how the specification gets corrected — it invites the
discussion that produces v0.2 and v1.0.

If you discover a hazard not listed here, please open an issue
against the specification repository.

## OI-1. Wire format has no version tag

**The postcard encoding of an operation does not carry an
explicit format-version field.** Schema evolution within a
minor version is constrained to additions only, but a binary
mismatch between two implementations using different
incompatible schema versions will fail at decode time without
a graceful error.

**Risk.** A future schema migration that is not strictly
additive — for example, removing or repurposing a field — will
silently corrupt logs read by an implementation expecting the
old shape.

**Direction.** The next major version is expected to introduce
a leading `version` byte (or a varint) on every op envelope,
allowing recipients to dispatch on schema version explicitly.

**Workaround in v0.1.** Implementations SHOULD include the
specification version they implement in their bearer token
metadata or in a discovery endpoint, so peers can refuse to
sync with mismatched versions before the wire format issue
manifests. The `X-Likewise-Mesh-Rules-Hash` header (see
[Sync](04-sync.md)) provides a partial signal.

## OI-2. Causal frontier cursor is opaque

**The `since` cursor passed to `GET /ops` is the base64url
encoding of a postcard `CausalFrontier` value.** This is
opaque from the client's perspective beyond the empty-frontier
special case, and there is no negotiation about its format.

**Risk.** An implementation that changes the underlying
`CausalFrontier` representation in a non-additive way will
break clients that hold persisted cursors from an earlier
version.

**Direction.** Future versions are expected to specify a
versioned cursor envelope or to standardise the
`CausalFrontier` shape explicitly so changes are detectable.

**Workaround in v0.1.** Implementations MUST treat cursors as
write-once-then-echo: a client sends back exactly what the
server returned in `X-Likewise-Next-Frontier`. Implementations
SHOULD discard cached cursors on protocol-version upgrades.

## OI-3. Sanitised ops carry no signature, by design

**A sanitised op has its `signature` cleared to `None` and is
distinguished from corruption by a sanitisation marker** (see
[Wire Format](03-wire-format.md#6-sanitised-operations)).

**Risk.** A receiver that does not implement marker checking
will either reject all sanitised ops as corrupted (denying
service to legitimate filtered traffic) or accept all unsigned
ops as sanitised (admitting forged traffic). The marker check
is the only thing distinguishing the two cases.

**Status.** This is a design decision, not a defect. The
specification's contract is that sanitisation is intentional
and the marker is verifiable against the sender's delegation
chain.

**Direction.** A future revision MAY introduce a hash-chain
mechanism that lets a receiver verify a sanitised op's
provenance to its pre-sanitisation form, addressing the
"delegated trust" concern at the cost of additional bytes on
the wire. v0.1 does not include this.

## OI-4. Mesh-rules drift has no negotiation

**Two peers with different `X-Likewise-Mesh-Rules-Hash` values
pause sync** (per [Sync](04-sync.md#6-the-mesh-rules-hash-handshake)).
There is no automatic protocol for resolving the divergence.

**Risk.** A long-running mesh whose rules document has
incrementally drifted on one node (typically because the
operator updated it) will lock that node out of sync until the
divergence is resolved manually.

**Direction.** A future revision is expected to define a
mesh-rules-negotiation pre-handshake: peers exchange rule
documents and either adopt the newer common version or
explicitly refuse to interoperate. The exact mechanism is open.

**Workaround in v0.1.** Operators MUST manage rules versioning
out of band (e.g., by deploying rule updates to all nodes
in lockstep). Implementations SHOULD log mesh-rules-hash
mismatches loudly enough to catch operator errors early.

## OI-5. HLC skew tolerance is implicit

**The protocol does not specify a maximum allowable wall-clock
skew between a node and the operations it accepts** (per
[Clocks](05-clocks.md#6-wall-clock-skew)). A node whose clock
is far in the future can effectively rewrite the order of the
mesh's history by emitting future-dated timestamps; receiving
nodes will adopt the larger `wall_ms` on receive.

**Risk.** A compromised or malfunctioning node can dominate
the HLC ordering for the rest of the mesh, distorting the
meaning of "before" and "after" for as long as it does so.

**Direction.** A future revision is expected to specify a
**negotiated skew bound** as part of the mesh-rules document:
operations whose `wall_ms` exceeds the recipient's local time
by more than the bound are rejected.

**Workaround in v0.1.** Implementations SHOULD warn on
operations whose timestamp is more than one hour ahead of the
local wall clock. They MAY refuse to accept such ops as a
local policy choice, but doing so is not specified by v0.1
and may cause sync to lag.

## OI-6. UCAN v0.10 is the wire format

**v0.1 implementations carry UCAN v0.10 (JWT-shaped) tokens.**
The UCAN working group has moved to v1.0 (DAG-CBOR + Varsig +
CIDv1 envelopes). v0.10 is no longer the upstream's preferred
format.

**Risk.** Tooling and ecosystem support for v0.10 will atrophy
over time. New external libraries will target v1.0 and
inter-protocol interop (with other UCAN-using systems) will be
harder.

**Direction.** The next major version is expected to migrate
to UCAN v1.0. The migration is non-trivial: token canonical
form, signature shape, and the proof-chain reference encoding
all change. The migration MAY be staged (v0.10 and v1.0
co-existing during transition) or atomic; the working group
will decide.

**Workaround in v0.1.** Implementations are stuck on v0.10.
They SHOULD isolate the UCAN implementation behind a
narrow interface so the migration is a contained change.

## OI-7. No bulk-transfer mode for first sync

**Catching up a long-disconnected node from genesis requires
paginated `GET /ops` calls** (per [Sync](04-sync.md#11-informative-why-one-endpoint)).
For a mesh with millions of ops this can be slow.

**Risk.** Onboarding a new node, or recovering a node that has
been offline for an extended period, takes longer than it
needs to.

**Direction.** A future minor version is expected to add a
bulk-transfer mode (likely a streaming response with a
specific `Accept` header on `GET /ops`) that ships a snapshot
plus a delta from a known checkpoint.

**Workaround in v0.1.** Implementations MAY ship the underlying
storage offline (USB drive, file copy) for first-time
onboarding, then resume incremental sync. This is operator
choice, not a protocol mechanism.

## OI-8. No server-initiated push hints

**The sync protocol is pull-based.** A node learns of new
operations only when it polls. There is no server-initiated
push of "you have new operations to fetch."

**Risk.** Propagation latency is bounded below by the polling
cadence, which is in tension with battery and bandwidth
considerations on mobile nodes.

**Direction.** A future minor version is expected to add an
optional WebSocket or webhook endpoint a server can use to
hint a peer that fresh operations are available. Hints are
advisory; the actual op exchange remains pull-based for
authoritative correctness.

**Workaround in v0.1.** Implementations choose polling
cadences that balance latency and resource use (typical
defaults: 30 seconds on stable connections, 5 minutes on
metered).

## OI-9. No confidential sync

**A peer can probe a node for the existence of operations it is
not authorised to receive** by sending crafted `since` cursors
and observing the response shape. The capability filter
prevents the operations themselves from being returned, but
it does not prevent a peer from learning *that* the
unreachable operations exist.

**Risk.** An attacker with read access to part of the log can
infer the existence and approximate timing of operations they
are not authorised to see.

**Direction.** A future revision is expected to adopt a
confidential-sync mechanism (likely modelled on Willow
Protocol's private-set-intersection-style approach), where
peers cannot probe for unauthorised operations at all. This
is a significant protocol redesign and is unlikely to land
before a major version bump.

**Workaround in v0.1.** Implementations SHOULD NOT distinguish
"unauthorised op" from "no op" in their response shape (return
the filtered op set without any "filtered N" indicator).
Implementations MUST NOT return per-op "you are not
authorised" errors, which would themselves leak the existence
of the filtered ops.

## OI-10. Predicate vocabulary is not yet standardised externally

**The set of claim predicates is centralised in this
specification** but is not yet structured for external
extension. An application wishing to add a new predicate (for
a new domain — health data, financial data, professional
context) must either propose it for inclusion in the
specification or hijack a generic predicate.

**Risk.** Without an external-extension mechanism, the
predicate vocabulary either grows to encompass every
imaginable domain (unwieldy) or fragments across non-standard
predicate strings (non-interoperable).

**Direction.** A future minor version is expected to introduce
namespaced predicate prefixes (e.g., `org.cortex.location_at`
versus `com.example.medical.diagnosed_with`) and a registry
mechanism for third-party namespaces.

**Workaround in v0.1.** Stay within the existing vocabulary
where possible. For application-specific extensions, use the
custom-metadata field on evidence and let consumers interpret
it; do not author claims with non-vocabulary predicates.

## How to propose changes

Each open issue here is a candidate for revision. To propose a
direction, open an issue on the specification repository (see
[Contributing](https://github.com/danielmay/likewise/blob/main/CONTRIBUTING.md))
and reference the OI number above. Substantive changes are
expected to land in v0.2 (additive minor) or v1.0
(backwards-incompatible major) depending on scope.

# Implementations

This page lists known implementations of Cortex Protocol and explains
what conformance means.

## Reference implementation

**Cortex** — a Rust reference implementation maintained by the
authors of this specification. It implements the full v0.1 wire
surface and is the source of truth for what the protocol *currently
behaves like* on the wire. Where the specification is silent or
ambiguous, the reference implementation's behaviour is the
fall-back authority for v0.1, and its observed behaviour is what
later revisions of the specification clarify.

Cortex runs on macOS and iOS today and consists of a small mesh of
nodes communicating over HTTP. The user runs a node on each of
their devices.

Repository and binaries are linked from the project README.

### Reference behavioural tests

The reference implementation ships seven end-to-end scenarios that
exercise the wire surface against a real engine, real SQLite
storage, and real HTTP loopback transport. Together they constitute
the reference suite for behavioural conformance:

1. **`solo`** — single-node ingest, derivation, projection rebuild.
2. **`warm-restart`** — node restart recovers state from the log
   alone.
3. **`enrollment`** — the UCAN delegation handshake that admits a
   new node to a mesh.
4. **`scoped-enrollment`** — the same handshake under caveat
   restrictions, including sanitisation rules and revocation.
5. **`claim-lifecycle`** — claim FSM transitions, derivation DAG
   cascade on user assertion, and frozen-fact immunity.
6. **`tool-use-agent-loop`** — non-inference job handlers chained
   with `depends_on`, inference-snapshot artefacts, and suggested-
   action approval, on a single node.
7. **`mesh-agent-loop`** — the same loop distributed across three
   specialist nodes (phone, inference, tools) cooperating via
   `RouteKind` and cross-node `depends_on`.

A second implementation that passes equivalents of these seven
scenarios — wired into its own engine and transport, against its
own storage — is what we mean by "behaviourally conformant for
v0.1." The scenarios are not the spec; the spec is the spec. The
scenarios are how we operationalise it.

## Compatible implementations

There are no third-party implementations at the time of writing.
This page is the place to list them as they appear. To submit one,
see [Contributing](https://github.com/danielmay/cortex-protocol/blob/main/CONTRIBUTING.md).

(Or — open an issue, paste a link to your implementation and a brief
description of what it covers, and we will add it.)

## What conformance means

The specification distinguishes four levels of conformance:

**Level 1 — wire-format conformance.** The implementation can read
and write operations that an existing v0.1 implementation will
accept and apply correctly. It honours the postcard encoding, the
canonical signing rules, and the HTTP sync endpoint shape.

**Level 2 — semantic conformance.** In addition to Level 1, the
implementation respects the projection contract — it answers
queries about an op log identically (modulo intentional
optimisations) to the reference implementation, given the same op
log as input.

**Level 3 — capability conformance.** In addition to Level 2, the
implementation honours UCAN delegations and caveats correctly —
including sanitisation, transitive revocation, and the
attenuation-only re-delegation rule.

**Level 4 — full behavioural conformance.** In addition to Level 3,
the implementation passes equivalents of the seven reference
scenarios listed above.

An implementation may claim a level publicly. We strongly
recommend explicit mention of the conformance level along with the
test artefacts that demonstrate it, so users can assess
trustworthiness without reading the source.

## Compatibility expectations across versions

The specification is versioned (see
[Conventions](spec/00-conventions.md) for the current version).
Two implementations on the same major version SHOULD interoperate
without negotiation. Two implementations on different major
versions MAY refuse to interoperate; the `X-Cortex-Mesh-Rules-Hash`
header on the sync endpoint is the v0.1 mechanism by which a
mismatched pair detects this and pauses sync rather than corrupting
each other.

A future revision will clarify the negotiation protocol for
mesh-rules drift; this is tracked as an
[open issue](spec/99-open-issues.md).

## Implementation notes for new ports

A handful of practical observations from building the reference
implementation that may save another implementer time:

- The HLC tick discipline is the single most common source of
  divergence bugs. Treat it as load-bearing from day one. See
  [Clocks](spec/05-clocks.md).
- The signature canonicalisation rule (clear the signature field
  on the op, encode, then sign and put the signature back) is
  easy to get subtly wrong. The detached-JWS output is what
  crosses the wire; the in-storage representation contains the
  signature.
- The projection split exists because collapsing it into one fat
  state object produces a system that is too slow for ranking,
  too lossy for UI, and too memory-hungry for inference contexts.
  Implementers porting from a single-store substrate should
  resist the urge to fold them.
- Sanitisation clears signatures intentionally; an implementation
  that treats signature absence as corruption will reject
  legitimately filtered ops. Distinguish the two cases up front.
- Job and lease ops use the HLC for lease expiry, not a wall clock.
  Implementations that read the wall clock to decide whether a
  lease is expired will misbehave when nodes have skewed clocks.

## Calling the project

The protocol is "Cortex Protocol." When citing it, please use that
name and a link to this specification. The reference
implementation is "Cortex." The two are deliberately different
nouns, even if the family resemblance is obvious — the protocol is
the standard, the implementation is one realisation of it.

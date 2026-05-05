# Implementations

This page lists known implementations of Likewise and explains
what conformance means.

## Status

There is no public Likewise implementation at the time this
specification was first published. The protocol was developed
alongside an in-progress Rust implementation that the authors
have been working under the **codename "Cortex"**. The codename
is *not* a committed product name — the implementation may
eventually ship as the baseline Likewise app itself, or under a
different name entirely; that decision has not been made. Where
this specification refers to "Cortex," read it as "the
in-development reference implementation."

Cortex is currently in private development on macOS and iOS. It
is not yet released, and this page makes no commitments about
its release timing. When it does become public, this page will
be updated with repository links, the final name, and conformance
notes.

The text below describes the *intended* shape of the reference
implementation and the *intended* behavioural-conformance suite.
Both should be read as forward-looking; neither is currently
available for download.

### The reference implementation (codename Cortex)

The reference implementation is a Rust implementation of Likewise
that runs on macOS and iOS as a small mesh of nodes
communicating over HTTP. The user runs a node on each of their
devices. It was the implementation against which this
specification was written, so where the specification is silent
or ambiguous, its intended behavior is the strongest signal
about what was meant — practically, this matters less than it
would for a published specification, because the implementation
is not yet available for an implementer to compare against.

### Intended reference behavioural tests

When the reference implementation is published, it will ship
seven end-to-end scenarios that exercise the wire surface against
a real engine, real SQLite storage, and real HTTP loopback
transport. The intent is that these scenarios constitute the
reference suite for behavioural conformance:

1. **`solo`** — single-node ingest, derivation, projection rebuild.
2. **`warm-restart`** — node restart recovers state from the log
   alone.
3. **`enrollment`** — the UCAN delegation handshake that admits a
   new node to a mesh.
4. **`scoped-enrollment`** — the same handshake under caveat
   restrictions, including sanitization rules and revocation.
5. **`claim-lifecycle`** — claim FSM transitions, derivation DAG
   cascade on user assertion, and frozen-fact immunity.
6. **`tool-use-agent-loop`** — non-inference job handlers chained
   with `depends_on`, inference-snapshot artifacts, and suggested-
   action approval, on a single node.
7. **`mesh-agent-loop`** — the same loop distributed across three
   specialist nodes (phone, inference, tools) cooperating via
   `RouteKind` and cross-node `depends_on`.

A second implementation that passes equivalents of these seven
scenarios — wired into its own engine and transport, against its
own storage — is what "behaviourally conformant for v0.1" is
intended to mean. The scenarios are not the spec; the spec is the
spec. The scenarios are how we plan to operationalize it once
the reference implementation is public.

## Compatible implementations

There are no public implementations of any kind at the time of
writing. When implementations exist, this page will list them. To
submit one, see
[Contributing](https://github.com/danielrmay/likewise/blob/main/CONTRIBUTING.md).

(Or — open an issue, paste a link to your implementation and a
brief description of what it covers, and we will add it.)

## What conformance means

The specification distinguishes four levels of conformance:

**Level 1 — wire-format conformance.** The implementation can read
and write operations that an existing v0.1 implementation will
accept and apply correctly. It honors the postcard encoding, the
canonical signing rules, and the HTTP sync endpoint shape.

**Level 2 — semantic conformance.** In addition to Level 1, the
implementation respects the projection contract — it answers
queries about an op log identically (modulo intentional
optimisations) to the reference implementation, given the same op
log as input.

**Level 3 — capability conformance.** In addition to Level 2, the
implementation honors UCAN delegations and caveats correctly —
including sanitization, transitive revocation, and the
attenuation-only re-delegation rule.

**Level 4 — full behavioural conformance.** In addition to Level 3,
the implementation passes equivalents of the seven reference
scenarios listed above.

An implementation may claim a level publicly. We strongly
recommend explicit mention of the conformance level along with the
test artifacts that demonstrate it, so users can assess
trustworthiness without reading the source.

## Compatibility expectations across versions

The specification is versioned (see
[Conventions](00-conventions.md) for the current version).
Two implementations on the same major version SHOULD interoperate
without negotiation. Two implementations on different major
versions MAY refuse to interoperate; the `X-Likewise-Mesh-Rules-Hash`
header on the sync endpoint is the v0.1 mechanism by which a
mismatched pair detects this and pauses sync rather than corrupting
each other.

A future revision will clarify the negotiation protocol for
mesh-rules drift; this is tracked as an
[open issue](99-open-issues.md).

## Implementation notes for new ports

A handful of practical observations from building the reference
implementation that may save another implementer time:

- The HLC tick discipline is the single most common source of
  divergence bugs. Treat it as load-bearing from day one. See
  [Clocks](05-clocks.md).
- The signature canonicalization rule (clear the signature field
  on the op, encode, then sign and put the signature back) is
  easy to get subtly wrong. The detached-JWS output is what
  crosses the wire; the in-storage representation contains the
  signature.
- The projection split exists because collapsing it into one fat
  state object produces a system that is too slow for ranking,
  too lossy for UI, and too memory-hungry for inference contexts.
  Implementers porting from a single-store substrate should
  resist the urge to fold them.
- Sanitization clears signatures intentionally; an implementation
  that treats signature absence as corruption will reject
  legitimately filtered ops. Distinguish the two cases up front.
- Job and lease ops use the HLC for lease expiry, not a wall clock.
  Implementations that read the wall clock to decide whether a
  lease is expired will misbehave when nodes have skewed clocks.

## Calling the project

The protocol is **"Likewise."** When citing it, please use that
name and a link to this specification.

The reference implementation is currently working under the
**codename Cortex**. The codename is provisional. Its eventual
public name is not fixed — it may ship as the baseline Likewise
app itself, or under another name. Treat any "Cortex" references
in this specification as shorthand for "the in-development
reference implementation"; if and when the implementation is
released under its final name, this page will be updated.

What is committed: the protocol is Likewise, the standard is
this document, and the implementation — whatever its final name
— is one realization of it.

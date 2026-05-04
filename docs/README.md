# Likewise

A protocol for **decentralized personal knowledge graphs**.

A user runs a node on each of their own devices. Nodes share an
append-only log of signed operations. The log encodes evidence (photos,
calendar events, contacts), the working hypotheses derived from that
evidence, the permissions governing who may read or derive from what,
and a record of every inference call made against any of it.

This book is the protocol specification.

## How to read it

If you are encountering Likewise for the first time, read in
this order:

1. **[Motivation](motivation.md)** — why this protocol exists, and what
   the status quo gets wrong.
2. **[Overview](overview.md)** — the system in five minutes, no code.
3. **[Concepts](concepts.md)** — the mental model. Evidence, ops,
   claims, projections, capabilities, mesh.
4. **[Comparison](comparison.md)** — honest contrast with Solid, AT
   Protocol, Nostr, Iroh, the local-first manifesto, and UCAN.

If you are implementing a compatible node, the normative
specification is organised into three parts:

- **Part 1: The substrate** — chapters
  [00 Conventions](spec/00-conventions.md) through
  [12 State Machines](spec/12-fsms.md) (skipping chapter 09).
  Sufficient for any conformant node, including organisation
  peers consuming a scoped slice of a user's graph. If you are
  building a substrate-only peer, this is everything you need.
- **Part 2: The inference pipeline** —
  [Mesh Coordination](spec/09-mesh-coordination.md) and
  [Inference Audit](spec/13-inference-audit.md). Adds the
  vocabulary by which nodes cooperate on a user's work and the
  convention by which audited inference calls become recoverable
  artefacts on the log. Required for nodes participating in
  distributed work; substrate-only peers MAY ignore.
- **Annex: Application conventions** —
  [Episodes, Suggested Actions, Salience](spec/annex-conventions.md).
  Non-normative. The reference implementation's choices for
  surfacing the substrate to a user; alternative implementations
  are free to substitute.

After the three parts:
[Open Issues](spec/99-open-issues.md) catalogues known
cross-implementation hazards. The high-level chapters above are
non-normative; the spec chapters use RFC 2119 keywords.

If you are looking for an existing implementation, see
**[Implementations](implementations.md)**.

## What this protocol is not

It is not a particular application. It is not a particular AI model.
It is not a synchronization library or a database engine. It is the
**wire-level agreement** that lets independently-built nodes
interoperate over a single user's knowledge graph.

## Status

**v0.1 — draft for public review.** The wire format was developed
alongside an in-progress reference implementation (Cortex,
currently private). It is not yet stable across major versions,
and there is no public implementation an interested party can run
today. See [Implementations](implementations.md) for status, and
[Open Issues](spec/99-open-issues.md) for known
cross-implementation hazards.

## License

[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
(CC-BY-4.0).

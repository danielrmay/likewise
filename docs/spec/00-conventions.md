# Conventions

This chapter defines the conventions used throughout the
specification. Subsequent chapters are normative; this one tells you
how to read them.

## Status of this document

This is **Likewise, version 0.1 — draft for public review**.

The wire format described in this specification is exercised by an
end-to-end reference implementation. It is not yet stable across
major versions. Backwards-incompatible changes between v0.1 and
v1.0 are expected. Known cross-implementation hazards are
catalogued in [Open Issues](99-open-issues.md).

## Conformance language

The keywords **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**,
**SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**,
**MAY**, and **OPTIONAL** in this document are to be interpreted
as described in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119)
and [RFC 8174](https://datatracker.ietf.org/doc/html/rfc8174) when,
and only when, they appear in all capitals.

In short:

- **MUST** / **MUST NOT** — absolute requirement / prohibition.
- **SHOULD** / **SHOULD NOT** — strong recommendation; deviation
  requires understanding consequences.
- **MAY** — truly optional.

## Normative versus informative material

Each chapter below is divided into normative sections (which use
RFC 2119 keywords) and informative sections (which do not). An
informative section may explain rationale, give examples, or
sketch how an implementation might satisfy the normative
requirements. **Informative material does not impose
requirements.** Where the two appear to conflict, the normative
material wins.

Examples in code blocks, diagrams, and prose anecdotes are
informative.

## Versioning

Likewise follows a semantic-versioning shape:

- **Major version** changes are backwards-incompatible. An
  implementation MUST NOT silently interoperate across major
  versions. A change to the wire format, the canonical signing
  rules, the operation payload encoding, or the meaning of a
  capability caveat is a major-version change.
- **Minor version** changes are backwards-compatible additions: new
  operation variants, new caveats, new sanitisation rules, new
  reserved fields with safe defaults. An implementation that does
  not understand a minor-version addition MUST treat it as
  unknown-but-tolerated where the spec allows, and reject the op
  otherwise. The specification chapter that introduces an addition
  states which.
- **Patch version** changes are editorial only — they do not change
  observable behaviour.

Two implementations on the same major version SHOULD interoperate
without negotiation. Two implementations on different major
versions MAY refuse to interoperate; the `X-Likewise-Mesh-Rules-Hash`
sync header is the v0.1 mechanism by which a mismatched pair
detects this and pauses sync rather than corrupting each other
(see [Sync](04-sync.md)).

## Defined terms

The following terms are used with precise meanings throughout the
specification.

- **Node** — a process running an implementation of this protocol.
  A node has a long-lived **NodeId** and a corresponding signing
  key. A node is the unit of authorship for operations.
- **User** — the human (or organisation) at whose authority all
  delegations in a mesh are rooted. Identified by a DID.
- **Mesh** — the set of nodes belonging to one user. Mesh
  membership is governed by capability delegations rooted at the
  user.
- **Operation** (or **op**) — the typed, signed unit of state
  change. Defined in [Operations](02-operations.md).
- **Op log** (or just **log**) — a node's append-only sequence of
  operations.
- **Projection** — a materialised read view derived from the op
  log. Defined in [Projections](10-projections.md).
- **Evidence** — an immutable raw input the user has chosen to
  ingest, referenced by content hash. Defined in
  [Data Model](01-data-model.md).
- **Claim** — a working hypothesis about the user, derived from
  evidence and other claims. Defined in
  [Data Model](01-data-model.md).
- **Capability** — a triple `(Resource, Action, Caveats)`
  authorising a node to perform a class of operation. Defined in
  [Capabilities](08-capabilities.md).
- **HLC** — hybrid logical clock. The timestamp scheme defined in
  [Clocks](05-clocks.md).
- **Causal frontier** — the per-author maximum-timestamp summary a
  node uses as its sync cursor. Defined in [Sync](04-sync.md).
- **Owner** — the node holding the user's root delegation. Owner
  is a per-mesh role, not a separate identity. Some operations
  (notably `RouteKind` and `DesignateCoordinator`) are owner-only.
- **Coordinator** — the node designated to run the deterministic
  derivation pass for the mesh. There is exactly one coordinator
  per mesh at a given log prefix; the user designates it
  explicitly (see [Mesh Coordination](09-mesh-coordination.md)).

## Authoritative sources

When this specification is silent or ambiguous, fall back in this
order:

1. The relevant RFC for any externally-defined primitive
   (RFC 7515 for JWS, the UCAN specification for tokens, etc.).
2. The maintainers' issue tracker, which is where ambiguities are
   clarified in subsequent revisions of the specification.

The protocol was developed alongside an in-progress reference
implementation called Cortex (see
[Implementations](../implementations.md)). Cortex is not yet
publicly available; once it is, its observed behaviour will become
the practical fall-back authority for v0.1 ambiguities. Until
then, file an issue.

## How to cite

When citing this specification, use the form:

> Likewise, version 0.1. <https://danielmay.github.io/likewise/>

The protocol is licensed CC-BY-4.0 (see `LICENSE` at the repository
root). Attribution is required.

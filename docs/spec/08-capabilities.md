# Capabilities

This chapter specifies the capability vocabulary used in UCAN
delegations: the set of legal `Resource` values, the set of
legal `Action` values, the legal combinations, and the
authorise-and-filter pipeline that uses them.

## 1. Resources

A `Resource` names a class of protocol-defined entity that a
capability authorises an action on. The v0.1 resource vocabulary:

| Resource | Covers |
|----------|--------|
| `Ops` | Universal — any operation, regardless of category. |
| `Evidence` | Evidence operations (`IngestEvidence`, `TombstoneEvidence`). |
| `Entity` | Entity operations (`CreateEntity`, `AddEntityAlias`, `MergeEntities`, `SplitEntity`). |
| `Claim` | Claim operations (`CreateClaim`, `UpdateClaimStatus`, `UpdateClaimConfidence`, `SupersedeClaim`). |
| `Job` | Job operations (`ScheduleJob`, `ClaimWork`, `CompleteJob`, `YieldWork`, `ExpireWork`). |
| `Episode` | Episode operations (`CreateEpisode`, `UpdateEpisode`). |
| `Artifact` | Artefact operations (`CreateArtifact`, `EvictArtifact`). |
| `Action` | Suggested-action operations (`CreateSuggestedAction`, `UpdateActionStatus`). |
| `Mesh` | Mesh-coordination operations (`DesignateCoordinator`, `RouteKind`). |
| `UserAssertion` | User-assertion operations (`UserAssert`). |
| `Registration` | Identity and delegation operations (`DelegateUcan`, `RevokeUcan`). |

`Ops` is the universal resource: a capability granted on `Ops`
applies to any operation, equivalent to a union of all the
specific resources. Implementations MUST treat `Ops`
appropriately when checking attenuation — a child capability on
a specific resource MAY appear under a parent capability on
`Ops`.

Future minor versions MAY add resources. Implementations MUST
reject capabilities naming an unknown resource.

## 2. Actions

An `Action` names what may be done with a resource. The v0.1
action vocabulary:

| Action | Meaning |
|--------|---------|
| `Read` | The holder may receive operations of the resource class on inbound sync. |
| `Write` | The holder may author operations of the resource class. |
| `Schedule` | The holder may emit `ScheduleJob` ops (only meaningful with `Resource::Job`). |
| `Claim` | The holder may emit `ClaimWork` ops. |
| `Complete` | The holder may emit `CompleteJob`, `YieldWork`, and `ExpireWork` ops. |

`Read` is the gating action for outbound sync filtering: a
peer's `GET /ops` response MUST only include ops the peer holds
`Read` for. `Write` is the gating action for op authoring: a
node MUST NOT successfully apply an op it authored without
holding `Write` on the relevant resource.

The job-specific actions (`Schedule`, `Claim`, `Complete`) split
job authority into discrete capabilities so that, for example, a
phone can schedule synthesis jobs while only a trusted server
may claim them.

## 3. Resource × Action matrix

Not every `(Resource, Action)` combination is meaningful. The
table below summarises which combinations the v0.1 specification
defines. Cells marked `—` indicate combinations that have no
defined effect (a delegation may include them but they will
authorise nothing useful; an implementation MAY warn but MUST
NOT reject).

| Resource → / Action ↓ | Read | Write | Schedule | Claim | Complete |
|---|:--:|:--:|:--:|:--:|:--:|
| `Ops` | ✓ | ✓ | — | — | — |
| `Evidence` | ✓ | ✓ | — | — | — |
| `Entity` | ✓ | ✓ | — | — | — |
| `Claim` | ✓ | ✓ | — | — | — |
| `Job` | ✓ | — | ✓ | ✓ | ✓ |
| `Episode` | ✓ | ✓ | — | — | — |
| `Artifact` | ✓ | ✓ | — | — | — |
| `Action` | ✓ | ✓ | — | — | — |
| `Mesh` | ✓ | ✓ | — | — | — |
| `UserAssertion` | ✓ | ✓ | — | — | — |
| `Registration` | ✓ | ✓ | — | — | — |

The `Mesh` resource grants authority over `RouteKind` and
`DesignateCoordinator`. These are owner-only ops: the protocol
requires that the authoring node hold `Mesh.Write` AND that
the authoring node be the mesh owner (i.e. the holder of the
root delegation chain). A node holding `Mesh.Write` via a
non-root delegation MUST have any `RouteKind` or
`DesignateCoordinator` ops it authors rejected.

## 4. Caveat applicability

The six caveats specified in
[UCAN and Caveats](07-ucan-and-caveats.md) apply to capabilities
as follows:

| Caveat | Applies to | Effect |
|--------|------------|--------|
| `source_types` | Capabilities on `Evidence` and on `Ops` | Restricts which evidence's `source_type` the holder may read or write. |
| `predicates` | Capabilities on `Claim` and on `Ops` | Restricts which claim predicates the holder may read or write. |
| `kind_prefix` | Capabilities on `Job` | Restricts which job kinds the holder may schedule, claim, or complete. |
| `time_range` | Any capability | Restricts the timestamp range of operations the capability admits. |
| `sanitize` | Any capability with `Read` | Specifies sanitisation applied to operations crossing the delegation outbound. |
| `audit_inference` | Capabilities on `Job` (`Claim` or `Complete`), `Claim` (`Write`), `Artifact` (`Write`), or `Ops` | When `true`, requires the delegated node to emit `cortex.inference.snapshot` artefacts for every model call performed against data covered by this delegation. |

A caveat applied to a resource it does not narrow has no
effect: a `kind_prefix` on a capability over `Evidence` does
not restrict anything, because `Evidence` ops do not have a
`kind` field. Such caveats MAY be present (they do not invalidate
the delegation) but they do not authorise additional behaviour.

## 5. The authorise-and-filter pipeline

This section specifies the procedure a node runs when ingesting
an operation, whether locally authored or received over the
wire. It MUST be applied in the order specified.

### 5.1 On receive (inbound)

For each incoming op:

1. **Reject malformed.** If the op fails wire-format validation
   (per [Wire Format](03-wire-format.md)), reject it.

2. **Verify signature** (or skip for sanitised ops; see step 6).
   If the op carries a `signature`, verify it per
   [Signatures](06-signatures.md). If verification fails,
   reject it.

3. **Resolve authority.** Identify the authoring `NodeId` and
   walk the chain of UCAN delegations from that `NodeId`'s
   bound DID to the user's root. If no such chain exists,
   reject the op.

4. **Check active validity.** Reject the op if any delegation
   in its authority chain is revoked, not yet active (`nbf`
   in the future), or expired (`exp` in the past). The check
   uses the op's `timestamp.wall_ms` for `nbf` / `exp`
   comparisons, not the receiver's local wall clock.

5. **Authorise.** The op's `(Resource, Action)` MUST appear in
   the effective capability set derived from the chain
   (the intersection of caveats along the chain). The op's
   payload MUST satisfy every caveat: source-type checks for
   evidence ops, predicate checks for claim ops, kind-prefix
   checks for job ops, time-range checks against the op's
   timestamp.

6. **Verify sanitisation marker** (for unsigned ops only). The
   marker MUST identify a sanitise rule chain admitted by some
   delegation the authoring node holds reaching to the user.
   If verification fails, reject the op.

7. **Apply.** The op is authorised and authentic; the
   implementation may now apply it to projections.

A rejected op is dropped from the apply pipeline. Implementations
SHOULD log rejections; they MUST NOT silently apply rejected ops
or partially apply them.

### 5.2 On send (outbound)

When a node responds to a `GET /ops` request, it MUST filter the
candidate ops by the requester's effective capability set
*before* serialising them onto the wire:

1. **Authorise.** For each candidate op, evaluate whether the
   requester is authorised to read it (the equivalent of the
   inbound check, against the requester's chain). If not,
   exclude the op from the response.

2. **Sanitise.** For each remaining op, if the requester's
   delegation chain carries `sanitize` rules, apply the rule
   chain to a *clone* of the op:
   - Apply each rule's redactions in order.
   - Set the cloned op's `signature` to `None`.
   - Attach the sanitisation marker recording the rule chain.
   - Use the cloned, sanitised op as the response value.

The sanitisation step happens server-side; the requester
receives only the sanitised op and cannot recover the redacted
fields. This is the only authorised way for an unsigned op to
appear on the wire.

### 5.3 On transitive revocation

When a `RevokeUcan` op is applied, every previously-applied op
whose authority chain depended on the revoked delegation MUST
be re-evaluated:

1. Walk the projection's index of applied ops by chain.
2. For each affected op, re-run the authorise pipeline as if
   the op had just been received.
3. Ops that no longer authorise MUST be removed from the
   projections (the underlying op log entry is preserved).

This is the operation that gives revocation real teeth: an op
that was admitted under a delegation no longer trusted is no
longer trusted, retroactively.

## 6. Capability composition

The user's root delegation is `(Ops, *)` with no caveats —
maximal authority. Subsequent delegations narrow this. A node
in practice typically holds:

- `(Ops, Read)` with sanitisation caveats — to receive most
  ops with privacy filtering.
- `(Evidence, Write)` with `source_types` caveat — to ingest
  evidence from a specific connector.
- `(Job, Schedule)` with `kind_prefix` caveat — to schedule
  inference work in a specific class.
- `(Job, Claim)` and `(Job, Complete)` with the matching
  `kind_prefix` — to actually do the work.
- `(UserAssertion, Write)` — to forward user feedback.

A device-specific delegation typically composes several of
these into a single UCAN; the implementation builds a node's
effective capability set by unioning the granted capabilities
across that node's delegations.

## 7. Reserved combinations

The protocol reserves the following capability behaviours for
future minor versions; v0.1 implementations MUST NOT issue or
accept delegations using them:

- Capabilities on a resource type introduced in a future
  version that the receiving node does not understand.
- Caveat fields not in the v0.1 vocabulary.

A delegation containing a reserved combination MUST be
rejected by a v0.1 conformant node.

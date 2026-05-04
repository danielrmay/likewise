# UCAN and Caveats

This chapter specifies how authority is delegated, attenuated,
and revoked, and the caveat vocabulary that narrows a delegation.
The protocol uses User-Controlled Authorization Networks (UCAN)
as the underlying delegation primitive, and extends UCAN's
policy slot with a domain-specific caveat set.

## 1. UCAN version

v0.1 of this specification builds on **UCAN v0.10**, the last
JWT-shaped revision of the UCAN format. A UCAN token is a
detached JWS over a JSON payload with the standard fields:

| Field | Purpose |
|-------|---------|
| `iss` | Issuer DID. The party delegating authority. |
| `aud` | Audience DID. The party receiving authority. |
| `att` | Attestation array. Each entry is a `(resource, action, caveats)` capability. |
| `nbf` | Not-before time (Unix seconds). |
| `exp` | Expiry time (Unix seconds). |
| `prf` | Proof chain. Array of parent UCAN content hashes. |

The full UCAN v0.10 format is specified externally; the
canonical reference is the
[UCAN working group repository](https://github.com/ucan-wg/spec).

### 1.1 v1.0 migration

The UCAN working group has moved on to v1.0, which uses a
DAG-CBOR plus Varsig envelope and CIDv1 references. Cortex
Protocol's v0.1 specifies v0.10 because that is what the
reference implementation uses. The v0.10 → v1.0 migration is a
known [open issue](99-open-issues.md) and is expected to land
as part of the next major version.

## 2. Capabilities in v0.10's `att` field

Every entry in a UCAN's `att` array is a Cortex Protocol
capability. The protocol places its capability schema directly
in the UCAN policy slot:

```
{
  "resource": "<Resource enum value>",
  "action":   "<Action enum value>",
  "caveats":  { ... }
}
```

The set of legal `resource` and `action` values, and the legal
`caveats` schema, are specified in
[Capabilities](08-capabilities.md). This chapter covers how
delegations are linked, attenuated, and revoked; the next
chapter covers what they can authorise.

## 3. The delegation graph

A capability flows through the mesh as a chain of UCAN
delegations rooted at the user. The user issues their root
delegation to one or more nodes (typically the phone),
authorising those nodes to author further delegations.

When a delegation `D_b` cites a parent `D_a` in its `prf`
array, the receiving node MUST:

1. Resolve `D_a` from the op log (or refuse the delegation if
   it cannot).
2. Verify `D_a` was issued by the DID that `D_b`'s issuer holds
   delegation under, transitively up to the user.
3. Verify `D_b`'s capabilities are an attenuation of `D_a`'s
   (Section 4).
4. Verify the time bounds on `D_b` are within `D_a`'s
   (`D_b.nbf >= D_a.nbf`, `D_b.exp <= D_a.exp`).

A delegation that fails any of these checks MUST be rejected.

## 4. Strict attenuation

A child delegation's capability set MUST be a subset of its
parent's. Attenuation is checked per-`(resource, action)` pair:
the child MAY include any pair the parent includes (or any pair
strictly narrowed by additional caveats), and MUST NOT include
pairs the parent does not.

For each capability in the child:

- The `(resource, action)` pair MUST appear in the parent
  (possibly with broader caveats).
- The child's `caveats` MUST be at least as restrictive as the
  parent's (Section 5).

A delegation that broadens any caveat compared to its parent
MUST be rejected by every receiving node, regardless of whether
the broadened delegation was signed correctly.

## 5. Caveats

Every caveat is **optional**, meaning "no restriction along this
axis." A delegation with no caveats authorises the full scope
of the `(resource, action)` pair (subject to any restrictions
inherited from its parent).

Caveat narrowing rules: a child caveat is at least as
restrictive as a parent caveat if and only if every operation
that satisfies the child's caveat would also satisfy the
parent's.

The v0.1 caveat vocabulary comprises five fields. Future minor
versions MAY add caveats; an unknown caveat field MUST be
treated as an absolute restriction (a delegation carrying an
unknown caveat is admitted, but no operation can satisfy the
unknown caveat — effectively granting the empty capability).

### 5.1 `source_types`

Restricts the capability to evidence whose `source_type`
matches one of the listed values.

| Form | Meaning |
|------|---------|
| absent | No restriction. |
| `["calendar"]` | Only operations on calendar-source evidence. |
| `["calendar", "contact"]` | Either calendar or contact. |

Narrowing: child's set MUST be a subset of parent's.

### 5.2 `predicates`

Restricts the capability to claim operations whose predicate
matches one of the listed values.

| Form | Meaning |
|------|---------|
| absent | No restriction. |
| `["located_at"]` | Only claim ops with predicate `"located_at"`. |

Narrowing: child's set MUST be a subset of parent's.

### 5.3 `kind_prefix`

Restricts the capability to job operations whose `kind` field
starts with one of the listed prefixes.

| Form | Meaning |
|------|---------|
| absent | No restriction. |
| `["cortex.synthesize."]` | Only synthesize-class jobs. |
| `["cortex."]` | Any reverse-DNS-prefixed cortex job kind. |

Narrowing: each child prefix MUST be a prefix of (or equal to)
some parent prefix.

### 5.4 `time_range`

Restricts the capability to operations whose `timestamp.wall_ms`
falls within the given range.

| Form | Meaning |
|------|---------|
| absent | No restriction. |
| `[start_ms, end_ms]` | Inclusive lower bound, exclusive upper bound. |

Narrowing: child's range MUST be contained within parent's.

### 5.5 `sanitize`

Specifies field-level redactions that MUST be applied to
operations crossing this delegation. Sanitisation is unique
among caveats in that it does not *block* an op; it modifies it
in flight.

The v0.1 sanitisation rules are:

| Rule | Effect |
|------|--------|
| `StripGeo` | Remove latitude, longitude, altitude, and any other geographic coordinates from evidence metadata, claim objects, and artefact bodies. |
| `RedactParticipants` | Replace participant identifiers with anonymised placeholders consistent within the operation but not linkable to the original entities. |
| `TruncateContent(N)` | Truncate any content body to at most N bytes. |
| `StripCustomMetadata` | Remove any custom-metadata fields not specified by the protocol. |

A delegation MAY specify multiple sanitise rules; they are
applied in the order listed.

Narrowing: a child delegation's `sanitize` rule list MUST be a
superset of its parent's (sanitisation strengthens at each hop).

#### 5.5.1 The sanitisation marker

When an op is sanitised on the wire, the sanitiser MUST set the
op's `signature` field to `None` (per
[Signatures](06-signatures.md)) AND attach a sanitisation
marker. The marker is a payload-internal field whose presence
both:

- tells the receiver the op was deliberately filtered, not
  corrupted, and
- records the chain of sanitise rules applied (so the receiver
  can audit that the rules match a delegation the sender held).

The exact wire shape of the marker is specified in
[Wire Format](03-wire-format.md#6-sanitised-operations); the
contract here is that the marker is a structurally-required
part of any unsigned, deliberately-modified op.

A receiver MUST verify that the marker's claimed sanitise
chain is admitted by some delegation the sender holds reaching
back to the user. A marker that does not match an
authorised chain MUST cause the op to be rejected.

## 6. Revocation

A `RevokeUcan` op authored by a delegation's issuer (or by a
node holding write authority over the issuer's DID under a
still-valid parent) retires the delegation. Receiving nodes
MUST:

1. Mark the delegation's content hash as revoked in the local
   UCAN view.
2. Recursively mark any delegations whose `prf` cites the
   revoked one as revoked (transitive cascade).
3. Re-evaluate the authorisation of every operation whose
   authority chain depended on a now-revoked delegation. Such
   operations are NOT removed from the log, but they MUST NOT
   be applied to projections.

The on-revoke rebuild is one of the more expensive operations
in the protocol; implementations SHOULD batch revocations and
defer the rebuild to the next idle window when latency permits.

A revoked delegation cannot be un-revoked. To restore the
authority, the issuer issues a new delegation.

## 7. The authorise-and-filter pipeline

When a node receives operations (whether from its own scheduler
authoring them locally or from a remote peer), it MUST run the
following pipeline before applying them to projections:

1. **Verify signatures** per [Signatures](06-signatures.md).
2. **Authorise** each op against the authoring node's effective
   capability set — the union of capabilities derived from
   delegations rooted at the user, restricted by all caveats
   in the chain. An op is authorised iff its `Action` and
   `Resource` are admitted and its caveats are satisfied.
3. **Apply transitive cascades**: re-evaluate ops whose
   authority depended on now-revoked delegations.
4. **Sanitise** outbound ops crossing delegations with
   `sanitize` caveats.

Steps 1-3 run on receive; step 4 runs on send. The pipeline is
specified in detail in [Capabilities](08-capabilities.md).

## 8. The user's root delegation

The mesh is bootstrapped by the user issuing a root UCAN to
the first node (typically the user's phone). The root
delegation:

- Has the user's DID as `iss`.
- Has the first node's `NodeId`-bound DID as `aud`.
- Carries the maximal capability set (`(*, *)` with no caveats).
- Has no `prf`; it is the chain root.

Subsequent delegations cite the root (or a descendant of it) as
their proof. The user holds the keypair backing their DID; an
implementation MUST provide the user with a mechanism to
authorise root re-issuance and to revoke the existing root.

The protocol does not specify the user-interface for this
authorisation; that is implementation-defined. The protocol
specifies only the wire format of the resulting UCANs.

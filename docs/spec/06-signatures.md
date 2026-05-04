# Signatures

This chapter specifies how operations are signed and verified, and
how nodes authenticate to one another over HTTP. It is the
specification of the JWS envelope used by the `signature` field
on every operation, the canonical signing form referenced from
[Wire Format](03-wire-format.md), and the bearer-token issuance
used by [Sync](04-sync.md).

## 1. Algorithm

All signatures defined by v0.1 of this specification are
**Ed25519** (RFC 8032). Signature size is fixed at 64 bytes;
verification keys are 32 bytes.

A future revision may add additional algorithms. v0.1 conformant
implementations MUST support Ed25519 and MAY accept any other
algorithm if and only if a future minor version explicitly
introduces it.

## 2. Per-node keys

Each node holds exactly one Ed25519 signing key for the duration
of its lifetime. Key rotation in v0.1 is performed by issuing a
new node identity (a new `NodeId` and key pair) and delegating
authority to it via `DelegateUcan`; the previous identity may
then be revoked.

The mapping `NodeId -> Ed25519 public key` is established by the
node's first `DelegateUcan` op observed on the log. This op MUST
embed a UCAN whose `iss` field is the issuer's DID and whose
`sub` (or equivalent) names the `NodeId` and carries the public
key. After this binding op is observed, every subsequent op
authored by that `NodeId` MUST be verified against the bound
key.

## 3. Detached JWS envelope for op signatures

The wire-level value of an operation's `signature` field is a
**detached JWS** as defined by RFC 7515 §A.5: the header and
signature segments are present, the payload segment is empty.

The detached JWS is encoded as the UTF-8 bytes of the string:

```
BASE64URL(header) "." "." BASE64URL(signature)
```

Where:

- `header` is the JSON Object Serialisation of:
  ```
  {"alg":"EdDSA","kid":"node-<node_id>"}
  ```
  with field order as written, no insignificant whitespace,
  ASCII encoding. The `kid` value is the literal prefix
  `"node-"` followed by the node's `NodeId` rendered as decimal
  digits (since `NodeId` is a 64-bit integer in v0.1; see
  [Wire Format](03-wire-format.md)).
- `signature` is the 64-byte Ed25519 signature over the
  canonical signing form defined in Section 4.

The `Vec<u8>` carried in the operation's `signature` field is
the UTF-8 byte sequence of the above string. Implementations
MUST NOT include line breaks or trailing whitespace.

## 4. Canonical signing form

To sign or verify an operation:

1. Construct the operation per the
   [operation envelope](02-operations.md#1-the-operation-envelope).
2. Set `signature = None`.
3. Encode the operation per [Wire Format](03-wire-format.md#4-operation-envelope-encoding).
   Call the result `op_bytes`.
4. Sign or verify `op_bytes` using the Ed25519 key bound to the
   operation's `node_id`.

When signing, the resulting 64-byte signature is wrapped per
Section 3 and stored as `Some(...)` in the `signature` field
before transmission.

When verifying, the receiver unwraps the detached JWS, recovers
the 64-byte raw signature, and verifies it against `op_bytes`
constructed from the received op (with its `signature` cleared
to `None`) using the public key bound to the op's `node_id`.

A receiver MUST reject any operation whose verification fails,
unless the op is a sanitised op admitted by Section 6.

## 5. Implementation note: round-tripping the signature field

The most common implementation error in this area is mishandling
the round-trip: implementations sign an op with the field set
to `None`, transmit it with the field set to `Some(jws)`, and
then attempt to verify by re-signing the received op as-is —
yielding a signature over different bytes. Implementations MUST
explicitly clear the `signature` field before computing the
canonical encoding for verification, and MUST treat that step
as the canonical procedure regardless of how the op is held in
memory.

A reference test vector for cross-implementation interop is
expected to ship with v0.1.1, alongside the public release of
the reference implementation. Until both exist, implementers
cannot fully validate signature canonicalisation against an
authoritative source; the procedure in this section and the
field-ordering rules in [Wire Format](03-wire-format.md) are
what to follow in the meantime. See
[Implementations](../implementations.md) for status.

## 6. Sanitised operations

When an outbound op crosses a delegation that requires
sanitisation (per the `sanitize` caveat described in
[UCAN and Caveats](07-ucan-and-caveats.md)), the sanitiser
modifies the op's payload by stripping or redacting the affected
fields. Because the resulting op no longer matches the bytes
the original signature was computed over, the signature would
no longer verify. Therefore the sanitiser MUST clear the
`signature` field on the sanitised op (set it to `None`) and
record the sanitisation in a marker field (specified in
[UCAN and Caveats](07-ucan-and-caveats.md)).

The receiver MUST NOT attempt signature verification on a
sanitised op. It MUST verify that the sanitisation marker is
consistent with a delegation that authorised the sender to apply
it; this is the receive-side procedure specified in
[UCAN and Caveats](07-ucan-and-caveats.md).

An op that arrives without a signature **and without** a
sanitisation marker MUST be rejected. The two conditions are
the only legitimate paths to an unsigned op on the wire (and
even the bootstrap path described in Section 7 produces a
signed op).

## 7. Bootstrap: the first op a node authors

A node that has not yet been seen on the log presents a
chicken-and-egg problem: the receiver does not know the node's
public key, so cannot verify the op that establishes the
binding.

The protocol resolves this by requiring that a node's *first*
authored op be a `DelegateUcan` carrying a UCAN that:

1. Is signed by the **issuer's** DID key (not the node's).
2. Embeds the node's public key in the UCAN's subject claim.
3. Is itself well-formed and verifiable against the issuer's DID.

The receiver:

1. Recognises that the authoring `NodeId` is unknown.
2. Decodes the embedded UCAN.
3. Verifies the UCAN's signature against the issuer's DID.
4. If valid, extracts the embedded public key and binds it to
   the authoring `NodeId`.
5. Verifies the op's own signature using the freshly-bound key.

If any step fails, the op is rejected. After this op is
applied, the node's identity is known and subsequent ops
authored by it follow the standard signing rules.

## 8. Bearer tokens for HTTP authentication

The `Authorization: Bearer` header on `GET /ops` and `POST /ops`
identifies the requesting node to the server. A bearer token is
a short-lived signed assertion of node identity, structured as
follows:

```
BASE64URL(header) "." BASE64URL(payload) "." BASE64URL(signature)
```

(The standard JWS Compact Serialisation, this time *not*
detached.)

Header:
```
{"alg":"EdDSA","kid":"node-<node_id>"}
```

Payload (JSON):
```
{
  "iss": "<NodeId>",
  "aud": "<recipient NodeId or origin>",
  "iat": <unix-seconds>,
  "exp": <unix-seconds>,
  "nonce": "<random>"
}
```

Tokens MUST have an expiry (`exp`) no more than one hour in
the future. Recipients MUST reject tokens that are expired,
that present an `iss` not bound to a valid public key on the
log, or that reuse a `nonce` already seen for the same `iss`
within the validity window.

Token issuance is per-request: a node generates a fresh token
for each peer, signs it, and presents it. There is no central
issuer. A future revision may add a refresh-token mechanism;
v0.1 implementations issue one-shot tokens.

## 9. Verifying authority

A signature establishes that the authoring `NodeId` produced the
op. It does not establish that the `NodeId` was *authorised* to
produce it. Authorisation is a separate check performed against
the UCAN delegation graph — see
[UCAN and Caveats](07-ucan-and-caveats.md) and
[Capabilities](08-capabilities.md). Both checks are required;
either failure rejects the op.

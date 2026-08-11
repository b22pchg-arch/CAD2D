# DWG Sketch V0.18.12 - Role-derived Outputs + Chained Result Roles

## Macro envelope

```json
{
  "schema": "dwg-sketch-cad-macros",
  "schemaVersion": 6,
  "engineVersion": "0.18.12.0",
  "macros": []
}
```

## Step fields added/used by the role chain

```json
{
  "stepId": "...",
  "enabled": true,
  "action": "RCOPY",
  "replayMode": "RelativeVector",
  "inputRole": "Source",
  "referenceRole": "",
  "outputRole": "Result",
  "arguments": {
    "deltaX": "100",
    "deltaY": "0"
  }
}
```

### InputRole
`CurrentSelection | Source | Target | Reference | Result`

### ReferenceRole
Empty / `SameAsInput` semantics, or `Source | Target | Reference | Result` for relative geometry.

### OutputRole
`None | Result | Target`

Only these relative actions may publish an output role:

- `RMOVE`
- `RCOPY`
- `RROTATE`
- `RSCALE`
- `RMIRROR`

## Runtime semantics

`Source`, `Target`, `Reference` may be manually captured runtime roles. `Result` is derived only from a successful prior step. Concrete entity references are intentionally not serialized into the macro file.

At `MACROPLAY` start:

1. the previous `Result` binding is cleared;
2. preflight must already have proven that every use of `Result` has an enabled producer earlier in the chain;
3. each relative step applies its `InputRole`;
4. after a successful step, the current subject selection is captured into `OutputRole` when requested;
5. the user's pre-playback selection is restored at the end, while the derived `Result` remains available for `MACRORESULT`.

## Default recording behavior

- New `RCOPY` steps default to `OutputRole=Result`.
- After recording `RCOPY`, the recording input-role selector advances to `Result`, making a natural copy-then-transform chain easy to record.
- A new relative step recorded with `InputRole=Result` defaults to `OutputRole=Result` so the derived set can continue through the chain.

## Ordered preflight example

Valid:

```text
RCOPY   Source -> Result
RROTATE Result -> Result
RMOVE   Result -> Target
```

Invalid:

```text
RROTATE Result -> Result   # no prior Result producer
RCOPY   Source -> Result
```

The invalid chain is rejected by `MACROCHECK` before geometry changes.

## Compatibility

Macro JSON schema v6 is additive. Older macros without `outputRole` normalize to no output. Project JSON remains v11. V0.18.12 does not change the FIX4 TEXT/MTEXT metric/paragraph algorithms or the Vietnamese encoding normalizer.

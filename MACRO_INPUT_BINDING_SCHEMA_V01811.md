# Macro Input Binding Schema V0.18.11

Macro engine schema: **v5**. Project JSON remains **v11**.

## Step role fields

```json
{
  "inputRole": "Source",
  "referenceRole": "Reference"
}
```

`inputRole` accepts `CurrentSelection`, `Source`, `Target`, `Reference`.
`referenceRole` is empty/`SameAsInput` or `Source`, `Target`, `Reference`. It is used by relative transform steps.

## Role contracts

```json
"inputRoles": [
  {"name":"Source","minimumCount":1,"kind":"Any","required":true},
  {"name":"Target","minimumCount":0,"kind":"Any","required":false},
  {"name":"Reference","minimumCount":0,"kind":"Any","required":false}
]
```

Kinds: `Any`, `Overlay`, `Cad`, `Mixed`.

## Runtime binding
Concrete entity bindings are intentionally **not serialized**. They are held in runtime memory and contain live references to current drawing entities. Deleted entities are pruned. This keeps exported macro files portable and prevents stale entity identifiers.

## Playback semantics
Before a step, a non-`CurrentSelection` `inputRole` replaces the active selection with that runtime role binding. Relative geometry then resolves its reference bounds from `referenceRole` when specified; otherwise it uses the current input selection. At playback end, the pre-play selection is restored.

## Preflight
Every enabled step contributes its referenced input/reference roles. Any referenced role must have a live runtime binding and satisfy its role contract. Invalid role names, missing bindings, count/kind mismatch, malformed relative arguments or unsupported reference mode cause `MACROCHECK` to fail before mutation.

## Compatibility
Macros without role fields normalize to `CurrentSelection` and continue using the V0.18.10 Input Contract. Existing `SelectionBoundsCenter` and `SelectionBoundsAnchor` relative geometry is preserved.

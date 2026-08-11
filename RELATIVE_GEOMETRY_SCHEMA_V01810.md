# Relative Geometry Phase 3 - V0.18.10 / PWA V0.22.10

## Macro schema
Macro export schema version: **4**. Existing schema v1-v3 payloads remain importable.

```json
{
  "inputContract": {
    "mode": "CurrentSelection",
    "minimumCount": 1,
    "kind": "Any",
    "recordedCount": 4,
    "recordedOverlayCount": 4,
    "recordedCadCount": 0,
    "referenceStrategy": "AdaptiveSelectionBoundsAnchor"
  }
}
```

`kind`: `Any`, `Overlay`, `Cad`, `Mixed`.

## Adaptive bounds anchors
Supported `referenceAnchor` values:
`Center`, `TopLeft`, `TopCenter`, `TopRight`, `CenterLeft`, `CenterRight`, `BottomLeft`, `BottomCenter`, `BottomRight`.

New transform step example:
```json
{
  "action": "RROTATE",
  "replayMode": "RelativeTransform",
  "arguments": {
    "referenceMode": "SelectionBoundsAnchor",
    "referenceAnchor": "TopLeft",
    "pivotOffsetX": "3.5",
    "pivotOffsetY": "-2",
    "angleDeg": "45"
  }
}
```

At playback the selected anchor is rebuilt from the **current selection bounds**, then the stored residual offset is applied. No absolute drawing coordinate is stored.

Legacy `referenceMode=SelectionBoundsCenter` remains supported.

## Automatic anchor selection
The recorder evaluates the 9 candidates using normalized X/Y distance based on the selection width/height. For MIRROR the target used to select the anchor is the midpoint of the recorded axis.

## Preflight
`MACROCHECK` validates inputContract, replay-safe actions, required arguments and reference modes/anchors without modifying geometry.

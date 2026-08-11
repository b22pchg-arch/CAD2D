# Relative Geometry Phase 2 - V0.18.9

Reference mode: `SelectionBoundsCenter`.

## RROTATE
- `pivotOffsetX`
- `pivotOffsetY`
- `angleDeg`
- `referenceMode=SelectionBoundsCenter`

At playback: `pivot = currentSelectionBoundsCenter + (pivotOffsetX,pivotOffsetY)`.

## RSCALE
- `pivotOffsetX`
- `pivotOffsetY`
- `factor > 0`
- `referenceMode=SelectionBoundsCenter`

## RMIRROR
- `axisAOffsetX`, `axisAOffsetY`
- `axisBOffsetX`, `axisBOffsetY`
- `referenceMode=SelectionBoundsCenter`

At playback each axis endpoint is reconstructed from the current selection center plus its recorded offset.

## Parameters
Recorded transforms bind to generated profile parameters:
- `ROTATE1_PX`, `ROTATE1_PY`, `ROTATE1_ANGLE`
- `SCALE1_PX`, `SCALE1_PY`, `SCALE1_FACTOR`
- `MIRROR1_AX`, `MIRROR1_AY`, `MIRROR1_BX`, `MIRROR1_BY`

No absolute drawing coordinate is stored by these relative-transform steps.
Macro schema remains v3; Project JSON remains v11.

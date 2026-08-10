# DWG Sketch V0.18.5 — Macro Engine & Versioned Symbol Library Catalog

## 1. Macro format — schemaVersion 1

```json
{
  "schema": "dwg-sketch-cad-macros",
  "schemaVersion": 1,
  "engineVersion": "0.18.5",
  "macros": [
    {
      "id": "MACRO_TEST_VIEW",
      "name": "Test View",
      "version": "1.0.0",
      "revision": 1,
      "updatedAt": "2026-08-09T18:42:00+07:00",
      "parameters": [],
      "steps": [
        { "command": "ZALL", "action": "ZA", "replayMode": "Direct" },
        { "command": "F8", "action": "ORTHO", "replayMode": "Direct" }
      ]
    }
  ]
}
```

### Invariants
- `id` is stable and normalized as `MACRO_*`.
- Saving the same macro ID increments `revision`.
- `action` is canonicalized before storage/replay.
- Phase 1 only stores `Direct` replay-safe steps.
- Interactive commands that require point input, drag operations, or dialogs are intentionally excluded.
- `parameters` is reserved for Macro Phase 2.

### Canonical replay-safe actions in V0.18.5/V0.22.5
`ALL`, `SELTEXT`, `SELLINE`, `SELCIRCLE`, `SELCURVE`, `SELSQUARE`, `SELRECT`, `SELNONTEXT`, `SELF`, `DELETE`, `SOLID`, `HATCH`, `AUTOCONNECT`, `DEVROTATE`, `BEXPLODE`, `B2SYM`, `GRIDON`, `GRIDOFF`, `GRIDSNAP`, `ORTHO`, `CROSSHAIR`, `ZA`, `F4`.

Aliases are normalized, e.g. `SELECTALL→ALL`, `DEL→DELETE`, `FILL→SOLID`, `H→HATCH`, `BX→BEXPLODE`, `SELFRAME→SELF`, `F8→ORTHO`, `OS/SNAP→F4`, `ZALL/ZOOMALL/ZOOMEXTENTS/FIT→ZA`.

## 2. Catalog format — schemaVersion 1

```json
{
  "schema": "dwg-sketch-electrical-symbol-catalog",
  "schemaVersion": 1,
  "catalogVersion": "1.0.0",
  "activeLibraryId": "user.local",
  "libraries": [
    {
      "id": "user.local",
      "namespace": "user.local",
      "name": "Thư viện người dùng",
      "version": "1.0.0",
      "revision": 3,
      "readOnly": false,
      "sourceKind": "User",
      "updatedAt": "2026-08-09T18:42:00+07:00",
      "templates": []
    }
  ]
}
```

### Catalog invariants
- Only one user collection is active at runtime to avoid custom symbol ID collisions.
- `id`/`namespace` are normalized and stable.
- Switching the active collection or exporting does **not** increment revision.
- Adding, replacing, deleting, or importing templates into the active collection increments revision.
- Duplicate namespace imports are renamed to a unique `*.imported.*` namespace rather than overwriting an existing collection.
- A `readOnly` collection cannot be modified by template save/delete/import operations.

## 3. Single library export — schemaVersion 3

```json
{
  "schema": "dwg-sketch-electrical-symbol-library",
  "schemaVersion": 3,
  "libraryId": "user.station110",
  "namespace": "user.station110",
  "name": "Thư viện Trạm 110kV",
  "libraryVersion": "1.0.0",
  "revision": 4,
  "readOnly": false,
  "sourceKind": "User",
  "appVersion": "0.18.5",
  "templates": []
}
```

C# and PWA V0.18.5/V0.22.5 preserve these fields when importing the file as a catalog/library. Legacy schema v1/v2 remains importable.

## 4. Compatibility boundary
- Project JSON remains version **11**.
- The macro store and catalog store are external configuration stores; they do not change project schema.
- Project-embedded symbol snapshots remain the compatibility mechanism for symbols already used in drawings.
- TX3/TX4/TX5, SM1 and GE1 history formats are unchanged by this release.

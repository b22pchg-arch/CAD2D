# V0.18.7 Symbol Update Manager + Macro Parameter Profiles

## Symbol Update Manager
Manager khong tao schema project moi. No su dung metadata linked-symbol da co trong Project JSON v11:
`SymbolInstanceId`, `SymbolLibraryId`, `SymbolLibraryNamespace`, `SymbolLibraryVersion`, `SymbolLibraryRevision`, `SymbolTemplateId`, `SymbolTemplateVersion`, `SymbolTemplateRevision`, `SymbolInsertX/Y`, `SymbolScale`, `SymbolRotationDeg`.

Trang thai:
- `CURRENT`: instance bang hoac moi hon template hien tai.
- `UPDATE`: template hien tai co version/revision moi hon instance.
- `MISSING`: khong resolve duoc library/template nguon.

Batch update chi ap dung `UPDATE`, giu transform + label va tao mot moc Undo chung.

## Macro Parameter Profile schema v1
```json
{
  "schema": "dwg-sketch-macro-parameter-profiles",
  "schemaVersion": 1,
  "engineVersion": "0.18.7.0",
  "profiles": [
    {
      "id": "...",
      "macroId": "MACRO_TEST",
      "name": "Goc45 Luoi25",
      "revision": 1,
      "updatedAt": "...",
      "values": {
        "DEVICE_ANGLE": "45",
        "GRID_X": "25",
        "GRID_Y": "25"
      }
    }
  ]
}
```
Profile doc lap voi macro definition. Xoa profile khong xoa macro; xoa macro khong tu dong xoa profile de tranh mat cau hinh, nhung profile mo coi se khong hien khi khong co macro ID tuong ung.

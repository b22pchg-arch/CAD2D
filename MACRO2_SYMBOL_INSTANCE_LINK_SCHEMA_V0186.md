# Macro Engine Phase 2 + Symbol Instance Version Link — V0.18.6

## 1. Macro schema v2

Macro payload giữ `schema: dwg-sketch-cad-macros` và nâng `schemaVersion` lên 2. Mỗi macro có `parameterDefaults`; mỗi step có `parameterBindings` và `arguments`.

Ví dụ khái niệm:

```json
{
  "schema": "dwg-sketch-cad-macros",
  "schemaVersion": 2,
  "engineVersion": "0.18.6.0",
  "macros": [{
    "id": "MACRO_TEST",
    "parameters": ["DEVICE_ANGLE"],
    "parameterDefaults": {"DEVICE_ANGLE": "90"},
    "steps": [{
      "action": "DEVROTATE",
      "replayMode": "Parameterized",
      "parameterBindings": {"deviceAngle": "DEVICE_ANGLE"},
      "arguments": {"deviceAngle": "90"}
    }]
  }]
}
```

`arguments` là giá trị literal/fallback. `parameterBindings` quyết định argument nào được lấy từ tham số khi playback. Chỉ các argument được allowlist ở Phase 2 mới được parameter hóa.

## 2. Symbol link metadata trong Project JSON v11

Không đổi `projectVersion`. Overlay entity có thêm các trường tùy chọn:

- `SymbolInstanceId`
- `SymbolLibraryId`
- `SymbolLibraryNamespace`
- `SymbolLibraryVersion`
- `SymbolLibraryRevision`
- `SymbolTemplateId`
- `SymbolTemplateVersion`
- `SymbolTemplateRevision`
- `SymbolInsertX`, `SymbolInsertY`
- `SymbolScale`
- `SymbolRotationDeg`

Các project cũ không có các trường này vẫn đọc bình thường. Instance không có link metadata không bị tự biến đổi.

## 3. Update policy

- Template/library thay đổi không tự cập nhật geometry của instance đang có.
- `SYMCHECK` chỉ so sánh link metadata với catalog hiện tại.
- `SYMUPDATE` là thao tác có chủ đích.
- C# rebuild group từ linked template rồi giữ transform + label.
- PWA thay `symbolTemplateSnapshot` bằng template mới rồi giữ transform + label/style.
- COPY/PASTE phải tạo `SymbolInstanceId` mới cho bản sao.

## 4. Compatibility contract

- Project JSON: v11.
- Symbol library export: schema v3 (không đổi từ V0.18.5).
- Macro import: chấp nhận v1/array cũ; bindings/defaults thiếu được khởi tạo rỗng.
- Text parity FIX4 và Vietnamese Unicode Normalizer không thuộc schema mới và phải được giữ nguyên.

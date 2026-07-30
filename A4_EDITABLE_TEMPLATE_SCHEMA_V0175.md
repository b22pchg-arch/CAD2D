# A4 Editable Diagram Template Schema — V0.17.5

Schema: `dwg-sketch-editable-a4-diagram-templates`, version 1.

## Catalog

```json
{
  "schema": "dwg-sketch-editable-a4-diagram-templates",
  "schemaVersion": 1,
  "updatedAt": "ISO-8601",
  "templates": []
}
```

## Template

Mỗi template lưu tên, từ khóa, nguồn, hướng A4, kích thước trang, lề, điểm neo, số lần dùng và danh sách `items`.

Tọa độ của item được chuẩn hóa vào hệ tọa độ trang:
- A4 ngang: `297 x 210`.
- A4 dọc: `210 x 297`.

## Editable items

Các loại hỗ trợ: `LINE`, `POLYLINE`, `TEXT`, `RECTANGLE`, `CIRCLE`, `ELLIPSE`, `ARC`, `DIMENSION` và các kiểu tương thích PWA như `SYMBOL`, `FILL`, `TRIANGLE`.

Mỗi item là một bản ghi độc lập. Khi chèn, item được tạo thành một đối tượng overlay riêng, không phải bitmap và không phải một block khóa cứng.

## Instance isolation

Mỗi lần chèn cấp lại:
- `AutomationGroupId`
- `AutomationConnectionId`
- `AutomationFromNodeId`
- `AutomationToNodeId`

Cơ chế này ngăn một lần chèn mới bị chọn liên kết với mẫu gốc hoặc các lần chèn trước.

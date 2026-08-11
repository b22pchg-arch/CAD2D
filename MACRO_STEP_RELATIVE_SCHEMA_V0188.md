# DWG Sketch Macro Schema V3 — V0.18.8

## Macro step

```json
{
  "stepId": "stable-id",
  "enabled": true,
  "command": "MOVE (relative)",
  "action": "RMOVE",
  "replayMode": "RelativeVector",
  "parameterBindings": {
    "deltaX": "MOVE1_DX",
    "deltaY": "MOVE1_DY"
  },
  "arguments": {
    "deltaX": "100",
    "deltaY": "50"
  }
}
```

`RCOPY` dùng cấu trúc tương tự với `COPY1_DX` / `COPY1_DY`.

## Quy tắc tọa độ

V0.18.8 không lưu điểm gốc và điểm đích tuyệt đối. Chỉ lưu vector:

`delta = destination - basePoint`

Khi phát, vector được áp lên selection hiện tại. Nhờ đó macro có thể tái sử dụng ở vị trí khác trong bản vẽ.

## Undo/Redo

- `RMOVE`: selection delta nhẹ, tương thích history MOVE hiện hành.
- `RCOPY`: structural add delta, Undo xóa toàn bộ bản sao của bước.

## Tương thích

- `schemaVersion = 3`.
- Reader vẫn chấp nhận macro schema cũ; trường thiếu `enabled` được hiểu là `true`.
- Project JSON không thay đổi và vẫn ở version 11.

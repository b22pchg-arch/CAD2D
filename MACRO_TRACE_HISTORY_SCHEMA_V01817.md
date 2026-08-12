# Macro Trace History - V0.18.17 / PWA V0.22.17

## Mục tiêu
Lưu nhiều phiên Macro Trace để kiểm thử hồi quy macro, thay vì chỉ giữ Trace runtime của lần chạy cuối.

## Trace Session
- `id`: ID duy nhất của phiên.
- `macroId`: ID macro tại thời điểm chạy.
- `macroName`: tên macro.
- `macroRevision`: revision macro tại thời điểm chạy.
- `startedAt`, `completedAt`: thời gian phiên.
- `runCount`, `skipCount`, `failCount`: thống kê trạng thái.
- `entries[]`: snapshot các `MacroTraceEntryV01814` gồm `stepIndex`, `stepId`, `action`, `state`, branch/condition/input/output/message.

## Lưu trữ
- C#: `%LOCALAPPDATA%\DwgSketchPrototype\macro-trace-history-v1.json`.
- PWA: `localStorage['dwg-sketch-macro-trace-history-v1']`.
- Giới hạn: 50 phiên gần nhất.

## Điều hướng
1. Ưu tiên tìm step theo `stepId`.
2. Nếu StepId không còn, fallback theo `stepIndex` khi còn hợp lệ.
3. Nếu macro đã đổi revision, fallback index chỉ là phương án dự phòng và được báo rõ.

## Tương thích
- Không đổi macro schema: vẫn v9 / engine 0.18.16.0.
- Không đổi Project JSON: vẫn v11.
- Trace history là storage độc lập, không làm phình project hoặc macro export.

## Giới hạn thiết kế
`Tạo Trace` chạy playback thật. V0.18.17 chưa triển khai dry-run/sandbox executor vì cần đảm bảo kết quả Trace khớp 100% engine thực thi.

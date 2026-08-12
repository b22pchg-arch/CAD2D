# Macro Regression Baseline — V0.18.18 / PWA V0.22.18

## Trace Session additions
Trace history vẫn dùng key/file cũ để tương thích, nhưng mỗi session có thêm:

```json
{
  "isBaseline": true,
  "resultSignatures": {
    "Result": "3|1O|2C",
    "Result1": "0|0O|0C"
  }
}
```

- `isBaseline`: phiên chuẩn của macro.
- `resultSignatures`: `total|overlayCountO|cadCountC` cho Result/Result1/Result2/Result3.

## Compare key
1. Ưu tiên `StepId`.
2. Dữ liệu legacy thiếu StepId dùng `StepIndex + Action` làm fallback.

## Difference kinds
- `ADDED`: step chỉ có ở Current.
- `REMOVED`: step chỉ có ở Baseline.
- `ACTION`: action khác.
- `STATE`: RUN/SKIP/FAIL khác ở step độc lập.
- `BRANCH`: trạng thái hoặc BranchGroup/BranchMode/Condition khác.
- `IO`: InputRole/OutputRole khác.
- `FAIL_DETAIL`: message lỗi khác khi có FAIL.
- `RESULT`: Result Set signature khác.

## Regression report

```json
{
  "schema": "dwg-sketch-macro-regression-report",
  "schemaVersion": 1,
  "appVersion": "0.22.18",
  "baselineSessionId": "...",
  "currentSessionId": "...",
  "macroId": "...",
  "baselineRevision": 3,
  "currentRevision": 4,
  "passed": false,
  "differences": []
}
```

## Retention
History vẫn tối đa 50 session. Khi cần trim, Baseline được ưu tiên giữ lại; phiên không phải Baseline cũ hơn bị loại trước.

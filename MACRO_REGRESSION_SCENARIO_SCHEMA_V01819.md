# Macro Regression Scenario Sets — V0.18.19 / PWA V0.22.19

## Scenario Set
```json
{
  "id": "mss-...",
  "macroId": "MACRO_...",
  "name": "Bộ nghiệm thu máy cắt",
  "scenarios": []
}
```

## Scenario
```json
{
  "id": "msc-...",
  "name": "Nhánh A",
  "parameterProfileId": "mpr-...",
  "baselineSessionId": "ths-...",
  "enabled": true,
  "lastRunSessionId": "ths-...",
  "lastOutcome": "PASS",
  "lastDifferenceCount": 0
}
```

## Trace Session additions
- `scenarioId`
- `scenarioName`
- `parameterProfileId`
- `scenarioBaselineIds[]`

`scenarioBaselineIds[]` cho phép một Trace Session được nhiều Scenario dùng làm Baseline và được bảo vệ khỏi trim lịch sử 50 phiên.

## Acceptance
Overall:
- PASS: tất cả Scenario enabled đều PASS.
- FAIL: có Scenario enabled FAIL.
- INCOMPLETE: còn NO_BASELINE/NOT_RUN/STALE/PROFILE_MISSING/... và chưa có FAIL.

## Compatibility
- Macro schema: v9, không đổi.
- Project JSON: v11, không đổi.
- Scenario Set lưu riêng ngoài project.
- C#: `%LOCALAPPDATA%/DwgSketchPrototype/macro-regression-scenario-sets-v1.json`.
- PWA: `localStorage['dwg-sketch-macro-regression-scenario-sets-v1']`.

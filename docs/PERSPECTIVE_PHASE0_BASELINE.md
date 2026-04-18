# Perspective Phase 0 Baseline

## 1. Purpose

Create a reproducible baseline before perspective refactor work.

This baseline is the reference for:

- visual artifact comparison
- gameplay consistency comparison
- performance comparison

No implementation changes should be evaluated without comparing against this baseline.

## 2. Baseline scope

Priority scenarios:

1. Multi-floor building alignment.
2. Stair up/down transitions.
3. Dense structure readability while moving.
4. Combat and interaction near floor boundaries.
5. UI overlays open during movement/transition.

Profiles to capture:

- `2D`
- `3D`

## 3. Execution checklist

## Step A - Environment readiness

1. Ensure local build works:

- `npm run build`

2. Ensure benchmark path works:

- `npm run benchmark:e2e`

3. Record environment metadata:

- git commit hash
- OS
- screen resolution
- profile tested (2D or 3D)

## Step B - Scenario capture

For each scenario in Section 2, capture:

1. Video clip (10-30s).
2. At least 3 screenshots:

- start position
- critical perspective moment
- end state

3. Visual notes:

- edge alignment
- floor stacking
- jagged artifacts
- incorrect overlap

## Step C - Functional verification

For each scenario, verify:

1. Correct floor transitions (`currentLevel` consistency).
2. Correct interaction target selection on active floor.
3. No entity depth inversion (player/object ordering errors).
4. No transition desync when UI windows are open.

## Step D - Performance sampling

Collect at minimum:

1. average FPS
2. low-percentile FPS (or minimum observed FPS)
3. visible stutter count in 30s observation window

Use same route and duration for all comparisons.

## 4. Artifact output structure

Store baseline artifacts under:

- `artifacts/perspective/baseline/<timestamp>/`

Recommended structure:

- `meta.json`
- `results-2d.json`
- `results-3d.json`
- `screens/`
- `clips/`

## 5. JSON template

Use this template for each profile result file:

```json
{
  "profile": "3D",
  "commit": "<hash>",
  "date": "<iso8601>",
  "environment": {
    "os": "Windows",
    "resolution": "<width>x<height>",
    "notes": ""
  },
  "scenarios": [
    {
      "id": "multi_floor_alignment",
      "pass": false,
      "visualFindings": [""],
      "functionalFindings": [""],
      "performance": {
        "avgFps": 0,
        "minFps": 0,
        "stutterCount30s": 0
      },
      "evidence": {
        "screens": [""],
        "clip": ""
      }
    }
  ],
  "summary": {
    "criticalIssues": [""],
    "overallReadability": "poor|fair|good|excellent",
    "overallStability": "poor|fair|good|excellent"
  }
}
```

## 6. Acceptance to finish Phase 0

Phase 0 is complete when all are true:

1. Both profiles (`2D` and `3D`) have captured baseline files.
2. All priority scenarios have evidence artifacts.
3. A consolidated issue list exists with severity tags.
4. The next phase (projection core rewrite) has explicit target deltas from baseline.

## 7. Severity model for findings

- `S0`: blocks gameplay or causes floor/interaction corruption.
- `S1`: major visual/spatial inconsistency affecting readability.
- `S2`: noticeable but non-blocking artifact.
- `S3`: polish issue.

## 8. Link with validation matrix

Perspective refactor work touches gameplay systems and scenes.
Mandatory validation set for subsequent phases:

1. `npm run build`
2. `npm run benchmark:e2e`
3. `npm run check:i18n-ui` when player-facing UI text changes
4. `npm run ci` for cross-cutting refactors

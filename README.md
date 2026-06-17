# Phy Frontend

React client for Phy. Upload a video and it
plays back while a transcript and language insights stream in next to it,
segment by segment.

Pairs with the Phy backend (FastAPI), which transcribes audio and extracts
vocabulary, grammar, humor, and cultural-reference insights.

## Flow

```text
Video file
    ↓
Audio segmentation (silence-aware chunking)
    ↓
WAV chunk, 16kHz mono
    ↓
POST /segments/process
    ↓
Transcript + insights
    ↓
Synced sidebar
```

## How it works

1. The user selects a video file. `TranscriptionPipeline` loads it through
   `MediaSource`, which reads duration and audio/video track metadata via
   the `mediabunny` library.
2. The pipeline walks the file in a loop. For each cursor position,
   `MediaSource.findNextSegment` looks for a target ~45s window, then
   snaps the boundary to the quietest nearby point using RMS energy
   analysis, so chunks end on silence rather than mid-word. Segments are
   clamped between 8s and 75s.
3. Each segment is re-encoded to a mono, 16kHz WAV blob and POSTed to the
   backend as `multipart/form-data`, along with its start/end timestamps.
4. The JSON response is validated against a Zod schema
   (`transcriptSegmentResponseSchema`) before reaching the UI. Failed or
   invalid chunks are reported through `onChunkError` without stopping
   the rest of the pipeline.
5. `Player` accumulates segments as they arrive and starts playback as
   soon as the first one resolves, instead of waiting for the whole file.
6. On `timeupdate`, the player looks up whichever segment contains the
   current playback time and renders its transcript and insights in the
   sidebar, so annotations stay in sync with the video.

## Design

* `src/lib/mediaSource.ts` — wraps `mediabunny` to load a file, find
  segment boundaries, and export trimmed/resampled WAV blobs. All
  segmentation tuning (target/min/max length, silence threshold) lives
  here as named constants.
* `src/lib/transcriptionPipeline.ts` — orchestrates the segment loop and
  backend calls, exposing a small callback interface (`onReadyToPlay`,
  `onSegment`, `onChunkError`, `onComplete`) so the UI stays decoupled
  from segmentation and transcription logic.
* `src/types.ts` — Zod schemas mirroring the backend's Pydantic models,
  used to validate responses and derive TypeScript types.
* `src/Player.tsx` — the only stateful UI component: file picker, video
  element, and a sidebar that resolves the active segment from playback
  time.
* `src/App.tsx` — app shell and theme: a dark layout with a pink
  (`#FF45AC`) accent, plus a themed `sonner` toaster for notifications.

## Setup

```bash
npm install
```

Set the backend URL in `src/consts.ts` (`BASE_URL`).

## Run

```bash
npm run dev
```

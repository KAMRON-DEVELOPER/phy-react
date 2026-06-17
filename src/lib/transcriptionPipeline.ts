import {
  transcriptSegmentResponseSchema,
  type TranscriptSegmentResponse
} from '@/types'
import { MediaSource, type AudioSegment } from './mediaSource'
import { BASE_URL } from '@/consts'

export interface PipelineCallbacks {
  onReadyToPlay: () => void
  onSegment: (segment: TranscriptSegmentResponse) => void
  onChunkError: (error: Error, segment: { start: number; end: number }) => void
  onComplete: () => void
}

export class TranscriptionPipeline {
  private source: MediaSource
  private callbacks: PipelineCallbacks
  private cancelled = false

  constructor(file: File, callbacks: PipelineCallbacks) {
    this.source = new MediaSource(file)
    this.callbacks = callbacks
  }

  cancel() {
    this.cancelled = true
  }

  async start(): Promise<void> {
    await this.source.load()
    const meta = this.source.getMeta()

    if (!meta.hasAudio) {
      this.callbacks.onReadyToPlay()
      this.callbacks.onComplete()
      return
    }

    let cursor = 0
    let isFirstChunk = true

    while (cursor < meta.durationSeconds && !this.cancelled) {
      let segment: AudioSegment
      try {
        segment = await this.source.getNextAudioSegment(cursor)
      } catch (err) {
        this.callbacks.onChunkError(err as Error, {
          start: cursor,
          end: meta.durationSeconds
        })
        break
      }

      try {
        const seg = await this.transcribeChunk(segment)
        this.callbacks.onSegment(seg)
      } catch (err) {
        this.callbacks.onChunkError(err as Error, {
          start: segment.startSeconds,
          end: segment.endSeconds
        })
      }

      if (isFirstChunk) {
        isFirstChunk = false
        this.callbacks.onReadyToPlay()
      }

      cursor = segment.endSeconds
    }

    if (!this.cancelled) {
      this.callbacks.onComplete()
    }
  }

  private async transcribeChunk(
    segment: AudioSegment
  ): Promise<TranscriptSegmentResponse> {
    const formData = new FormData()
    formData.append('audio', segment.blob, 'chunk.wav')
    formData.append('start_seconds', String(segment.startSeconds))
    formData.append('end_seconds', String(segment.endSeconds))

    const response = await fetch(`${BASE_URL}/segments/process`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Transcription failed (${response.status}): ${text}`)
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw new Error('Backend did not return valid JSON')
    }

    const result = transcriptSegmentResponseSchema.safeParse(data)

    if (!result.success) {
      console.error(
        '[transcriptSegmentResponseSchema] parse failed:',
        result.error.message
      )
      throw new Error(
        '[transcriptSegmentResponseSchema] Unexpected response shape from backend'
      )
    }

    return result.data
  }
}

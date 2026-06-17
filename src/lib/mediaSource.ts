import {
  Input,
  Output,
  Conversion,
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  WavOutputFormat,
  AudioBufferSink
} from 'mediabunny'

/* Target segment length we *aim* for before snapping to a silence gap. */
export const TARGET_SEGMENT_SECONDS = 45
/* Never produce a segment shorter than this */
export const MIN_SEGMENT_SECONDS = 8
/* Never produce a segment longer than this, even if no silence is found */
export const MAX_SEGMENT_SECONDS = 75
/* Sample rate we resample to before sending to MiMo. ASR doesn't need more
  than 16kHz, and it keeps both the WAV size and audio-token count down */
export const TARGET_SAMPLE_RATE = 16000

/* Window size for RMS energy analysis, in seconds. Small enough to find
  word-level gaps, large enough to be cheap to compute. */
const ENERGY_WINDOW_SECONDS = 0.05
/* A window is considered "silence" if its RMS falls below this fraction
  of the loudest window seen so far in the search range. Tune down if
  source audio is noisy and never seems to count as silence. */
const SILENCE_RELATIVE_THRESHOLD = 0.08
/* How far around the target boundary we're willing to search for a gap. */
const BOUNDARY_SEARCH_RADIUS_SECONDS = 8

export interface MediaSourceMeta {
  durationSeconds: number
  hasAudio: boolean
  hasVideo: boolean
  sampleRate: number | null
}

export interface AudioSegment {
  blob: Blob
  startSeconds: number
  endSeconds: number
  snappedToSilence: boolean
}

export class MediaSource {
  private input: Input
  private meta: MediaSourceMeta | null = null

  constructor(file: File) {
    this.input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS
    })
  }

  async load(): Promise<MediaSourceMeta> {
    const [duration, videoTrack, audioTrack] = await Promise.all([
      this.input.computeDuration(),
      this.input.getPrimaryVideoTrack(),
      this.input.getPrimaryAudioTrack()
    ])

    this.meta = {
      durationSeconds: duration,
      hasAudio: audioTrack !== null,
      hasVideo: videoTrack !== null,
      sampleRate: audioTrack ? await audioTrack.getSampleRate() : null
    }

    return this.meta
  }

  getMeta(): MediaSourceMeta {
    if (!this.meta) {
      throw new Error('PhySource.load() must be called before use')
    }
    return this.meta
  }

  async findNextSegment(cursorSeconds: number): Promise<{
    endSeconds: number
    snappedToSilence: boolean
  }> {
    const meta = this.getMeta()
    const fileEnd = meta.durationSeconds
    const hardEnd = Math.min(cursorSeconds + MAX_SEGMENT_SECONDS, fileEnd)
    const targetEnd = Math.min(cursorSeconds + TARGET_SEGMENT_SECONDS, fileEnd)

    if (fileEnd - cursorSeconds <= MAX_SEGMENT_SECONDS) {
      return { endSeconds: fileEnd, snappedToSilence: false }
    }

    if (!meta.hasAudio) {
      return { endSeconds: targetEnd, snappedToSilence: false }
    }

    const searchStart = Math.max(
      cursorSeconds + MIN_SEGMENT_SECONDS,
      targetEnd - BOUNDARY_SEARCH_RADIUS_SECONDS
    )
    const searchEnd = Math.min(
      hardEnd,
      targetEnd + BOUNDARY_SEARCH_RADIUS_SECONDS
    )

    const gap = await this.findQuietestPoint(searchStart, searchEnd)

    if (gap) {
      return { endSeconds: gap, snappedToSilence: true }
    }

    return { endSeconds: targetEnd, snappedToSilence: false }
  }

  private async findQuietestPoint(
    searchStart: number,
    searchEnd: number
  ): Promise<number | null> {
    const audioTrack = await this.input.getPrimaryAudioTrack()
    if (!audioTrack) return null

    const sink = new AudioBufferSink(audioTrack)

    let quietestRms = Infinity
    let quietestTimestamp: number | null = null
    let loudestRms = 0

    for await (const { buffer, timestamp } of sink.buffers(
      searchStart,
      searchEnd
    )) {
      const channelData = buffer.getChannelData(0)
      const samplesPerWindow = Math.max(
        1,
        Math.floor(ENERGY_WINDOW_SECONDS * buffer.sampleRate)
      )

      for (
        let offset = 0;
        offset < channelData.length;
        offset += samplesPerWindow
      ) {
        const end = Math.min(offset + samplesPerWindow, channelData.length)
        let sumSquares = 0
        for (let i = offset; i < end; i++) {
          sumSquares += channelData[i] * channelData[i]
        }
        const rms = Math.sqrt(sumSquares / (end - offset))
        const windowTimestamp = timestamp + offset / buffer.sampleRate

        if (rms > loudestRms) loudestRms = rms
        if (rms < quietestRms) {
          quietestRms = rms
          quietestTimestamp = windowTimestamp
        }
      }
    }

    if (quietestTimestamp === null || loudestRms === 0) return null

    const isRealGap = quietestRms <= loudestRms * SILENCE_RELATIVE_THRESHOLD
    return isRealGap ? quietestTimestamp : null
  }

  async extractSegmentAsWav(
    startSeconds: number,
    endSeconds: number
  ): Promise<Blob> {
    const output = new Output({
      format: new WavOutputFormat(),
      target: new BufferTarget()
    })

    const conversion = await Conversion.init({
      input: this.input,
      output,
      audio: {
        numberOfChannels: 1,
        sampleRate: TARGET_SAMPLE_RATE
      },
      trim: {
        start: startSeconds,
        end: endSeconds
      }
    })

    await conversion.execute()

    const target = output.target
    const buffer = target.buffer
    if (!buffer) {
      throw new Error('Conversion produced no output buffer')
    }

    return new Blob([buffer], { type: 'audio/wav' })
  }

  async getNextAudioSegment(cursorSeconds: number): Promise<AudioSegment> {
    const { endSeconds, snappedToSilence } =
      await this.findNextSegment(cursorSeconds)
    const blob = await this.extractSegmentAsWav(cursorSeconds, endSeconds)

    return {
      blob,
      startSeconds: cursorSeconds,
      endSeconds,
      snappedToSilence
    }
  }
}

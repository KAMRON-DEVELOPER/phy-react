import { useRef, useState, useCallback } from 'react'
import { TranscriptionPipeline } from '@/lib/transcriptionPipeline'
import type { TranscriptSegmentResponse } from './types'

type PlayerState = 'idle' | 'preparing' | 'ready' | 'error'

export function Player() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pipelineRef = useRef<TranscriptionPipeline | null>(null)

  const [state, setState] = useState<PlayerState>('idle')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [activeSegment, setActiveSegment] = useState<TranscriptSegmentResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [segments, setSegments] = useState<TranscriptSegmentResponse[]>([])

  const handleFileSelected = useCallback((file: File) => {
    pipelineRef.current?.cancel()
    setActiveSegment(null)
    setSegments([])
    setErrorMessage(null)
    setState('preparing')
    setVideoUrl(URL.createObjectURL(file))

    const pipeline = new TranscriptionPipeline(file, {
      onReadyToPlay: () => {
        setState('ready')
        videoRef.current?.play().catch(() => {})
      },
      onSegment: (segment) => {
        setSegments((prev) => [...prev, segment])
      },
      onChunkError: (err, range) => {
        console.error(`Chunk ${range.start}-${range.end}s failed:`, err.message)
      },
      onComplete: () => {
        console.log('Transcription pipeline finished.')
      }
    })

    pipelineRef.current = pipeline
    pipeline.start().catch((err) => {
      setState('error')
      setErrorMessage(err.message)
    })
  }, [])

  const handleTimeUpdate = useCallback(() => {
    const t = videoRef.current?.currentTime
    if (t === undefined) return

    setActiveSegment((prev) => {
      if (prev && t >= prev.startSeconds && t < prev.endSeconds) return prev
      return segments.find((s) => t >= s.startSeconds && t < s.endSeconds) ?? prev
    })
  }, [segments])

  return (
    <div className="flex h-full flex-col gap-6 md:flex-row">
      <section className="flex flex-1 flex-col gap-4 md:flex-2">
        {!videoUrl && (
          <label className="flex cursor-pointer items-center justify-center gap-2 border border-dashed border-[#FF45AC]/40 p-8 text-sm text-[#DFDFD6]/60 transition-colors hover:border-[#FF45AC] hover:text-[#DFDFD6]">
            <span>Select a video file</span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelected(file)
              }}
            />
          </label>
        )}

        {videoUrl && (
          <div className="relative">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              onTimeUpdate={handleTimeUpdate}
              className={`w-full transition-opacity duration-300 ${state === 'preparing' ? 'opacity-40' : 'opacity-100'}`}
            />
            {state === 'preparing' && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-[#FF86CF]">
                Transcribing first segment…
              </div>
            )}
          </div>
        )}

        {state === 'error' && <p className="text-sm text-red-500">Error: {errorMessage}</p>}
      </section>

      <aside className="flex-1 overflow-y-auto md:flex-1">
        <h3 className="mb-3 text-xs font-semibold tracking-widest text-[#FF45AC]">
          PHY
        </h3>
        {activeSegment ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-[#DFDFD6]">{activeSegment.transcript}</p>
            {activeSegment.insights.length > 0 && (
              <ul className="space-y-2">
                {activeSegment.insights.map((insight, i) => (
                  <li
                    key={i}
                    className="border-l-2 border-[#FF45AC]/30 pl-3 text-xs leading-relaxed text-[#DFDFD6]/80"
                  >
                    <strong className="text-[#FF86CF]">{insight.excerpt}</strong>
                    {' — '}
                    {insight.explanation}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-xs text-[#DFDFD6]/40">No active segment yet.</p>
        )}
      </aside>
    </div>
  )
}

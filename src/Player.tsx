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

  const handleFileSelected = useCallback((file: File) => {
    pipelineRef.current?.cancel()
    setActiveSegment(null)
    setErrorMessage(null)
    setState('preparing')

    setVideoUrl(URL.createObjectURL(file))

    const pipeline = new TranscriptionPipeline(file, {
      onReadyToPlay: () => {
        setState('ready')
        videoRef.current?.play().catch(() => {})
      },
      onSegment: () => {},
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

  const handleTimeUpdate = useCallback(() => {}, [])

  return (
    <div style={{ display: 'flex', gap: '1.5rem', height: '100%' }}>
      <div style={{ flex: 2 }}>
        {!videoUrl && (
          <input
            type="file"
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelected(file)
            }}
          />
        )}

        {videoUrl && (
          <div style={{ position: 'relative' }}>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              onTimeUpdate={handleTimeUpdate}
              style={{
                width: '100%',
                opacity: state === 'preparing' ? 0.4 : 1
              }}
            />
            {state === 'preparing' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}
              >
                Transcribing first segment…
              </div>
            )}
          </div>
        )}

        {state === 'error' && <p style={{ color: 'crimson' }}>Error: {errorMessage}</p>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <h3>Live transcript</h3>
        {activeSegment ? (
          <div>
            <p>{activeSegment.transcript}</p>
            {activeSegment.insights.length > 0 && (
              <ul>
                {activeSegment.insights.map((insight, i) => (
                  <li key={i}>
                    <strong>{insight.excerpt}</strong> — {insight.explanation}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p style={{ opacity: 0.6 }}>No active segment yet.</p>
        )}
      </div>
    </div>
  )
}

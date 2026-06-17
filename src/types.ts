import { z } from 'zod'

export const insightCategorySchema = z.enum([
  'humor',
  'grammar',
  'vocabulary',
  'cultural_reference'
])

export const transcriptInsightSchema = z.object({
  excerpt: z.string(),
  explanation: z.string(),
  category: insightCategorySchema
})

export const transcriptInsightsResultSchema = z.object({
  insights: z.array(transcriptInsightSchema).default([])
})

export const transcriptSegmentResponseSchema = z.object({
  startSeconds: z.number(),
  endSeconds: z.number(),
  transcript: z.string(),
  insights: z.array(transcriptInsightSchema).default([])
})

export type InsightCategory = z.infer<typeof insightCategorySchema>
export type TranscriptInsight = z.infer<typeof transcriptInsightSchema>
export type TranscriptInsightsResult = z.infer<
  typeof transcriptInsightsResultSchema
>
export type TranscriptSegmentResponse = z.infer<
  typeof transcriptSegmentResponseSchema
>

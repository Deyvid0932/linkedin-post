export interface SwipeVersion {
  id: string;
  estructuraUsada: string;
  tituloEstructura: string;
  textoGenerado: string;
  imageUrl?: string;
  imageUrls?: string[];
  tokensUsed: number;
  costUsd: number;
  percentMonthlyCredit: number;
}

export interface SwipeBatch {
  sourceMode: string;
  topicTitle: string;
  referenceUrl: string;
  versions: SwipeVersion[];
}

export type ImageAspectRatio = '16:9' | '1:1' | '4:5';

export interface TokenEstimateResponse {
  characterCount: number;
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  estimatedTotalTokens: number;
  model: string;
  costEstimateUSD: number;
  creditDeductionPercent: number;
}

export interface GeneratedPreviewResponse {
  id: string;
  title: string;
  generatedText: string;
  imageUrl?: string;
  imageUrls?: string[];
  estimatedTokens: number;
  estimatedCostUsd: number;
  creditPercent: number;
  sourceMode: string;
  status: string;
  createdAt: string;
}

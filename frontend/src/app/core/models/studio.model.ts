export interface SwipeVersion {
  id: string;
  estructuraUsada: string;
  tituloEstructura: string;
  textoGenerado: string;
  imageUrl?: string;
  imageUrls?: string[];
  tokensUsed: number | null;
  costUsd: number | null;
  percentMonthlyCredit: number | null;
  model: string | null;
}

export interface SwipeBatch {
  sourceMode: string;
  topicTitle: string;
  referenceUrl: string;
  versions: SwipeVersion[];
}

export type ImageAspectRatio = '16:9' | '1:1' | '4:5';

export interface TokenEstimateResponse {
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  totalEstimatedTokens: number;
  estimatedCostUsd: number | null;
  remainingBalanceTokens: number | null;
  modelName: string;
  note: string;
}

export interface GeneratedPreviewResponse {
  id: string;
  title: string;
  generatedText: string;
  imageUrl?: string;
  imageUrls?: string[];
  estimatedTokens: number | null;
  estimatedCostUsd: number | null;
  creditPercent: number | null;
  sourceMode: string;
  status: string;
  createdAt: string;
}

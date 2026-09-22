export type SourceMode = 'PROJECT' | 'RESEARCH' | 'BACKUP';
export type PublicationStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'DRAFT';

export interface PublicationLog {
  id: string;
  sourceMode: SourceMode;
  status: PublicationStatus;
  accountType?: 'PERSON' | 'ORGANIZATION';
  authorUrn?: string;
  generatedText: string;
  imageUrl?: string;
  linkedinPostUrn?: string;
  postUrl?: string;
  sourceReference?: string;
  errorMessage?: string;
  executionTimeMs?: number;
  llmModelUsed?: string;
  llmTokensUsed?: number;
  publishedAt?: string;
  createdAt: string;
}

export interface GeneratedPreview {
  sourceMode: SourceMode;
  generatedText: string;
  imageUrl: string;
  sourceReference: string;
}

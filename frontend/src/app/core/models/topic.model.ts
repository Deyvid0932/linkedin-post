export interface BackupTopic {
  id: string;
  title: string;
  description?: string;
  category?: string;
  isAiResearch?: boolean; // false = Tema Fijo Curado, true = Investigación abierta con IA
  isActive?: boolean;
  isUsed: boolean;
  isRejected?: boolean;
  usedAt?: string;
  priority: number;
  createdAt: string;
}

export interface InterestTopic {
  id: string;
  topicName: string;
  isActive: boolean;
  createdAt: string;
}

export interface PublishingSchedule {
  id: string;
  cronExpression: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

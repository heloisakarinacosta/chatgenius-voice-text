// Types for Chat Context

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  messages: Message[];
  isActive: boolean;
  createdAt: Date;
}

export interface WidgetConfig {
  position: string;
  title: string;
  subtitle: string;
  primaryColor: string;
  iconType: string;
}

export interface VoiceConfig {
  enabled: boolean;
  voiceId: string;
  language: string;
  latency: number;
  silenceTimeout?: number;
  maxCallDuration?: number;
  waitBeforeSpeaking?: number;
  waitAfterPunctuation?: number;
  waitWithoutPunctuation?: number;
  waitAfterNumber?: number;
  endCallMessage?: string;
  continuousMode?: boolean;
}

export interface AgentFunction {
  name: string;
  description: string;
  parameters: any;
  webhook: string;
}

export interface TrainingFile {
  id: string;
  name: string;
  content: string;
  size: number;
  type: string;
  timestamp: Date;
}

export type KnowledgeType = 'rag' | 'fine-tuning' | 'assistant';

export interface FineTuningConfig {
  enabled: boolean;
  modelId: string;
  status: string;
  lastTrainingDate?: Date;
}

export interface AssistantConfig {
  enabled: boolean;
  assistantId: string;
  name: string;
}

export interface AgentConfig {
  systemPrompt: string;
  functions: AgentFunction[];
  voice: VoiceConfig;
  trainingFiles: TrainingFile[];
  model: string;
  temperature: number;
  maxTokens: number;
  detectEmotion: boolean;
  knowledgeType: KnowledgeType;
  rag: {
    enabled: boolean;
  };
  fineTuning: FineTuningConfig;
  assistant: AssistantConfig;
}

export interface AdminConfig {
  username: string;
  passwordHash: string;
  apiKey: string;
}

export interface ChatContextType {
  messages: Message[];
  conversations: Conversation[];
  currentConversationId: string | null;
  widgetConfig: WidgetConfig;
  agentConfig: AgentConfig;
  adminConfig: AdminConfig;
  isDbConnected: boolean;
  
  // Widget state fields
  isWidgetOpen?: boolean;
  setIsWidgetOpen?: (isOpen: boolean) => void;
  isVoiceChatActive?: boolean;
  setIsVoiceChatActive?: (isActive: boolean) => void;
  
  // Message handling methods
  updateWidgetConfig: (config: WidgetConfig) => Promise<boolean>;
  updateAgentConfig: (config: AgentConfig) => Promise<boolean>;
  updateAdminConfig: (config: AdminConfig) => Promise<boolean>;
  sendMessage: (content: string) => Promise<boolean>;
  addMessage: (content: string, role: 'user' | 'assistant' | 'system') => string;
  updateMessage: (messageId: string, updatedContent: string) => void;
  startNewConversation: () => Promise<string | null>; // Tipo correto: Promise<string | null>
  
  // Training file methods
  addTrainingFile: (file: TrainingFile) => Promise<boolean>;
  removeTrainingFile: (id: string) => Promise<boolean>;
  loadData: () => Promise<void>;
}

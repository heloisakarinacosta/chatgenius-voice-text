
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

export interface AgentConfig {
  systemPrompt: string;
  functions: AgentFunction[];
  voice: VoiceConfig;
  trainingFiles: TrainingFile[];
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
  updateWidgetConfig: (config: WidgetConfig) => Promise<boolean>;
  updateAgentConfig: (config: AgentConfig) => Promise<boolean>;
  updateAdminConfig: (config: AdminConfig) => Promise<boolean>;
  sendMessage: (content: string) => Promise<boolean>;
  addTrainingFile: (file: TrainingFile) => Promise<boolean>;
  removeTrainingFile: (id: string) => Promise<boolean>;
  loadData: () => Promise<void>;
}

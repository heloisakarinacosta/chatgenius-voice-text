
import CryptoJS from 'crypto-js';
import { embeddingService } from './embeddingService';

// Interface para mensagem da OpenAI
interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  name?: string;
}

// Interface para opções de conclusão da OpenAI
interface OpenAICompletionOptions {
  messages: OpenAIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  trainingFiles?: Array<{
    id: string;
    name: string;
    content: string;
    size?: number;
    type?: string;
    timestamp?: Date;
  }>;
  functions?: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>;
  detectEmotion?: boolean;
  stream?: boolean;
}

// Interface para função de conclusão da OpenAI
interface OpenAIFunction {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

// Interface de callbacks para streaming
interface StreamCallbacks {
  onMessage: (chunk: string) => void;
  onComplete: (fullMessage: string) => void;
  onError: (error: Error) => void;
}

// Função para criar embeddings de texto usando o modelo da OpenAI
export const createEmbedding = (text: string): number[] => {
  // Implementação simples de hash para simular embeddings
  // Em um ambiente de produção, você deve chamar a API de embeddings da OpenAI
  const hash = CryptoJS.SHA256(text).toString();
  
  // Transformar o hash em um array de números para simular um embedding
  const embedding = Array.from({ length: 384 }, (_, i) => {
    // Usar substrings do hash para gerar os valores do embedding
    const value = parseInt(hash.substring((i * 2) % hash.length, (i * 2 + 2) % hash.length), 16);
    // Normalizar para um valor entre -1 e 1
    return (value / 65535) * 2 - 1;
  });
  
  console.log(`Generated embedding for text: ${text.substring(0, 50)}...`);
  return embedding;
};

// Prepara mensagens para a API da OpenAI, agora usando o sistema RAG
const prepareMessages = async (options: OpenAICompletionOptions): Promise<OpenAIMessage[]> => {
  let messages = [...options.messages];
  
  // Inicializa o serviço de embeddings se necessário
  if (!embeddingService.isReady() && options.trainingFiles && options.trainingFiles.length > 0) {
    await embeddingService.initialize();
  }
  
  // Verifica se há uma pergunta do usuário para buscar contexto relevante
  const userMessages = messages.filter(msg => msg.role === "user");
  const lastUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
  
  // Utiliza RAG apenas se o sistema estiver habilitado e houver uma mensagem do usuário
  if (embeddingService.isEnabled() && lastUserMessage && lastUserMessage.content.trim()) {
    // Indexa arquivos apenas se eles não estiverem indexados
    if (options.trainingFiles && options.trainingFiles.length > 0) {
      // Verifica se os documentos já estão indexados
      const stats = embeddingService.getStats();
      if (stats.documentCount < options.trainingFiles.length) {
        console.log(`Indexing ${options.trainingFiles.length} training files...`);
        
        for (const file of options.trainingFiles) {
          embeddingService.addDocument(file.id, file.name, file.content);
        }
      }
    }
    
    // Usa o sistema RAG para obter contexto relevante
    try {
      console.log("Usando sistema RAG para buscar contexto relevante");
      
      // Obtém contexto relevante para a última mensagem do usuário
      const contextContent = await embeddingService.getRelevantContext(lastUserMessage.content);
      
      // Somente adiciona o contexto se algo relevante foi encontrado
      if (contextContent && contextContent.length > 0) {
        // Insere o conteúdo de treinamento após a mensagem do sistema
        const systemMessageIndex = messages.findIndex(msg => msg.role === "system");
        
        if (systemMessageIndex !== -1) {
          // Anexa à mensagem do sistema existente
          messages[systemMessageIndex].content += `\n\nEu fornecerei algumas informações adicionais que você deve usar para responder às perguntas do usuário:\n\n${contextContent}`;
        } else {
          // Adiciona como uma nova mensagem do sistema se não existir nenhuma
          messages.unshift({
            role: "system",
            content: `Use as seguintes informações para responder às perguntas do usuário:\n\n${contextContent}`
          });
        }
        
        console.log("Contexto relevante adicionado à conversa");
      } else {
        console.log("Nenhum contexto relevante encontrado para adicionar à conversa");
      }
    } catch (error) {
      console.error("Erro ao obter contexto relevante:", error);
      // Não adiciona contexto em caso de erro
    }
  } else {
    if (!embeddingService.isEnabled()) {
      console.log("Sistema RAG está desabilitado");
    } else if (!lastUserMessage) {
      console.log("Não há mensagem do usuário para buscar contexto");
    } else if (!lastUserMessage.content.trim()) {
      console.log("Mensagem do usuário está vazia");
    } else {
      console.log("Sistema RAG não está pronto ou não há mensagem do usuário");
    }
  }
  
  // Adiciona instruções de detecção de emoção se solicitado
  if (options.detectEmotion) {
    const lastSystemMessageIndex = messages.findIndex(msg => msg.role === "system");
    
    if (lastSystemMessageIndex !== -1) {
      messages[lastSystemMessageIndex].content += "\n\nDetecte o sentimento emocional principal na mensagem do usuário e inclua essa informação no início da sua resposta entre colchetes, por exemplo: [Sentimento: Feliz]. Os possíveis sentimentos são: Feliz, Triste, Irritado, Confuso, Neutro, Preocupado, Satisfeito.";
    } else {
      messages.unshift({
        role: "system",
        content: "Detecte o sentimento emocional principal na mensagem do usuário e inclua essa informação no início da sua resposta entre colchetes, por exemplo: [Sentimento: Feliz]. Os possíveis sentimentos são: Feliz, Triste, Irritado, Confuso, Neutro, Preocupado, Satisfeito."
      });
    }
  }
  
  return messages;
};

// Chama a API da OpenAI
export const callOpenAI = async (options: OpenAICompletionOptions, apiKey: string): Promise<string> => {
  try {
    console.log("Chamando API OpenAI com modelo:", options.model);
    
    if (!apiKey) {
      throw new Error("API key não fornecida");
    }
    
    // Prepara as mensagens para a API, incluindo o contexto relevante dos arquivos de treinamento
    const messages = await prepareMessages(options);
    
    // Log do tamanho do contexto sendo enviado para a API
    const totalContextSize = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    console.log(`Enviando contexto para OpenAI: ${totalContextSize} caracteres`);
    
    // Estabelece os parâmetros padrão
    const model = options.model || "gpt-3.5-turbo";
    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const max_tokens = options.maxTokens || 1000;
    
    // Constrói o corpo da solicitação
    const requestBody: Record<string, any> = {
      model,
      messages,
      temperature,
      max_tokens,
    };
    
    // Adiciona funções se fornecidas
    if (options.functions && options.functions.length > 0) {
      requestBody.functions = options.functions;
      requestBody.function_call = "auto";
    }
    
    // Faz a chamada para a API da OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    // Verifica se a resposta foi bem-sucedida
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Erro na API OpenAI:", errorData);
      throw new Error(`Erro na API OpenAI: ${response.status} - ${response.statusText}`);
    }
    
    // Processa a resposta
    const data = await response.json();
    
    // Extrai o conteúdo da resposta
    const content = data.choices[0].message.content || "";
    
    console.log("Resposta recebida da OpenAI com sucesso");
    return content;
  } catch (error) {
    console.error("Erro ao chamar a API OpenAI:", error);
    throw error;
  }
};

// Transcrição de áudio usando a API Whisper da OpenAI
export const transcribeAudio = async (audioBlob: Blob, apiKey: string): Promise<string> => {
  try {
    console.log("Enviando áudio para transcrição via API Whisper");
    
    if (!apiKey) {
      throw new Error("API key não fornecida para transcrição");
    }
    
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");
    formData.append("response_format", "json");
    
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Erro na API de transcrição:", errorData);
      throw new Error(`Erro na API de transcrição: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.text || "";
  } catch (error) {
    console.error("Erro ao transcrever áudio:", error);
    throw error;
  }
};

// Geração de fala usando a API TTS da OpenAI
export const generateSpeech = async (
  text: string, 
  voiceId: string = 'alloy', 
  apiKey: string
): Promise<ArrayBuffer> => {
  try {
    console.log(`Gerando fala para texto com ${text.length} caracteres, voz: ${voiceId}`);
    
    if (!apiKey) {
      throw new Error("API key não fornecida para geração de fala");
    }
    
    if (!text || text.trim() === "") {
      throw new Error("Texto vazio fornecido para geração de fala");
    }
    
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: voiceId,
        input: text,
        speed: 1.0
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text().catch(() => null);
      console.error("Erro na API de geração de fala:", errorData);
      throw new Error(`Erro na API de geração de fala: ${response.status} - ${response.statusText}`);
    }
    
    return await response.arrayBuffer();
  } catch (error) {
    console.error("Erro ao gerar fala:", error);
    throw error;
  }
};

// Versão de streaming para a API da OpenAI
export const streamOpenAI = async (
  options: OpenAICompletionOptions, 
  apiKey: string,
  callbacks: StreamCallbacks
): Promise<void> => {
  try {
    console.log("Chamando API OpenAI em modo streaming com modelo:", options.model);
    
    if (!apiKey) {
      throw new Error("API key não fornecida");
    }
    
    // Prepara as mensagens para a API
    const messages = await prepareMessages(options);
    
    // Log do tamanho do contexto sendo enviado para a API
    const totalContextSize = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    console.log(`Enviando contexto para OpenAI em streaming: ${totalContextSize} caracteres`);
    
    // Estabelece os parâmetros padrão
    const model = options.model || "gpt-3.5-turbo";
    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const max_tokens = options.maxTokens || 1000;
    
    // Constrói o corpo da solicitação
    const requestBody: Record<string, any> = {
      model,
      messages,
      temperature,
      max_tokens,
      stream: true
    };
    
    // Adiciona funções se fornecidas
    if (options.functions && options.functions.length > 0) {
      requestBody.functions = options.functions;
      requestBody.function_call = "auto";
    }
    
    // Faz a chamada para a API da OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    // Verifica se a resposta foi bem-sucedida
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Erro na API OpenAI:", errorData);
      callbacks.onError(new Error(`Erro na API OpenAI: ${response.status} - ${response.statusText}`));
      return;
    }
    
    if (!response.body) {
      callbacks.onError(new Error("Response body is null"));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullMessage = "";
    let buffer = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      // Processa as linhas completas
      while (buffer.includes('\n')) {
        const lineEnd = buffer.indexOf('\n');
        const line = buffer.substring(0, lineEnd).trim();
        buffer = buffer.substring(lineEnd + 1);
        
        if (!line) continue;
        if (line === 'data: [DONE]') break;
        
        if (line.startsWith('data: ')) {
          try {
            const jsonData = JSON.parse(line.substring(6));
            
            if (jsonData.choices && jsonData.choices.length > 0) {
              const content = jsonData.choices[0].delta?.content;
              
              if (content) {
                fullMessage += content;
                callbacks.onMessage(content);
              }
            }
          } catch (e) {
            console.warn("Erro ao analisar linha JSON:", e);
            continue;
          }
        }
      }
    }
    
    callbacks.onComplete(fullMessage);
    console.log("Streaming concluído com sucesso");
    
  } catch (error) {
    console.error("Erro no streaming da OpenAI:", error);
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
};

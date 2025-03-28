
import { v4 as uuidv4 } from 'uuid';
import { createEmbedding } from './openai';

// Tipos para o serviço de embeddings
interface Document {
  id: string;
  name: string;
  content: string;
  chunks: Chunk[];
}

interface Chunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
}

interface SearchResult {
  fileName: string;
  score: number;
  content: string;
  chunkId?: string;
  documentId?: string;
}

// Estado do serviço
let documents: Document[] = [];
let chunks: Chunk[] = [];
let isInitialized = false;
let debugMode = false;
let ragEnabled = true; // Por padrão está habilitado
let embeddingCache: Map<string, number[]> = new Map(); // Cache de embeddings

// Configurações
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const SIMILARITY_THRESHOLD = 0.75;
const SIMILARITY_THRESHOLD_SHORT_QUERY = 0.6; // Limiar mais baixo para consultas curtas
const MAX_RESULTS = 3;
const SHORT_QUERY_LENGTH = 15; // Define o que é uma consulta curta
const MAX_CONTEXT_LENGTH = 1500; // Limite máximo de contexto a ser enviado

/**
 * Inicializa o serviço de embeddings
 */
export const initialize = async (): Promise<void> => {
  if (isInitialized) return;
  
  try {
    // Carrega configuração do localStorage
    const enabled = localStorage.getItem('rag_enabled');
    if (enabled !== null) {
      ragEnabled = enabled === 'true';
      console.log(`RAG system initialized as ${ragEnabled ? 'enabled' : 'disabled'}`);
    }
    
    // Tenta carregar documentos do localStorage
    const storedDocuments = localStorage.getItem('rag_documents');
    const storedChunks = localStorage.getItem('rag_chunks');
    
    if (storedDocuments && storedChunks) {
      documents = JSON.parse(storedDocuments);
      chunks = JSON.parse(storedChunks);
      console.log(`Loaded ${documents.length} documents and ${chunks.length} chunks from localStorage`);
    }
    
    isInitialized = true;
  } catch (error) {
    console.error("Error initializing embedding service:", error);
  }
};

/**
 * Habilita ou desabilita o sistema RAG
 * 
 * @param enabled - Se o sistema RAG deve estar habilitado
 */
export const setEnabled = (enabled: boolean) => {
  ragEnabled = enabled;
  console.log(`RAG system ${enabled ? 'enabled' : 'disabled'}`);
  localStorage.setItem('rag_enabled', enabled ? 'true' : 'false');
};

/**
 * Verifica se o sistema RAG está habilitado
 * 
 * @returns true se o sistema RAG estiver habilitado, false caso contrário
 */
export const isEnabled = (): boolean => {
  return ragEnabled;
};

/**
 * Verifica se o serviço está pronto para uso
 */
export const isReady = (): boolean => {
  return isInitialized && documents.length > 0 && chunks.length > 0;
};

/**
 * Ativa ou desativa o modo de depuração
 */
export const setDebug = (debug: boolean): void => {
  debugMode = debug;
  console.log(`Debug mode ${debug ? 'enabled' : 'disabled'}`);
};

/**
 * Cria hash para o conteúdo para uso na cache de embeddings
 */
const createContentHash = (content: string): string => {
  // Simplificado: apenas os primeiros 100 caracteres + comprimento
  return content.substring(0, 100) + '_' + content.length;
};

/**
 * Adiciona um documento ao índice
 */
export const addDocument = async (id: string, name: string, content: string): Promise<void> => {
  try {
    // Inicializa o serviço se ainda não estiver inicializado
    if (!isInitialized) {
      await initialize();
    }
    
    // Verifica se o documento já existe
    const existingDocIndex = documents.findIndex(doc => doc.id === id);
    
    if (existingDocIndex !== -1) {
      // Se o conteúdo do documento não mudou, não reprocesse
      if (documents[existingDocIndex].content === content) {
        console.log(`Document ${id} already exists with the same content, skipping update`);
        return;
      }
      
      console.log(`Document ${id} exists but content changed, updating...`);
      
      // Remove chunks existentes deste documento
      chunks = chunks.filter(chunk => chunk.documentId !== id);
      
      // Atualiza o documento
      documents[existingDocIndex] = {
        id,
        name,
        content,
        chunks: []
      };
    } else {
      // Adiciona novo documento
      documents.push({
        id,
        name,
        content,
        chunks: []
      });
    }
    
    // Divide o conteúdo em chunks
    const newChunks = splitIntoChunks(id, content);
    
    // Adiciona os novos chunks
    for (const chunk of newChunks) {
      try {
        // Verificar se já temos o embedding deste conteúdo em cache
        const contentHash = createContentHash(chunk.content);
        
        if (embeddingCache.has(contentHash)) {
          console.log(`Using cached embedding for chunk in document ${id}`);
          chunk.embedding = embeddingCache.get(contentHash);
        } else {
          // Gera embedding para o chunk
          const embedding = await createEmbedding(chunk.content);
          chunk.embedding = embedding;
          // Salva no cache
          embeddingCache.set(contentHash, embedding);
        }
        
        chunks.push(chunk);
        
        // Adiciona referência ao chunk no documento
        const docIndex = documents.findIndex(doc => doc.id === id);
        if (docIndex !== -1) {
          documents[docIndex].chunks.push(chunk);
        }
      } catch (error) {
        console.error(`Error generating embedding for chunk in document ${id}:`, error);
      }
    }
    
    // Salva no localStorage
    saveToLocalStorage();
    
    console.log(`Document ${id} added/updated with ${newChunks.length} chunks`);
  } catch (error) {
    console.error(`Error adding document ${id}:`, error);
  }
};

/**
 * Remove um documento do índice
 */
export const removeDocument = (id: string): void => {
  try {
    // Remove o documento
    documents = documents.filter(doc => doc.id !== id);
    
    // Remove os chunks do documento
    chunks = chunks.filter(chunk => chunk.documentId !== id);
    
    // Salva no localStorage
    saveToLocalStorage();
    
    console.log(`Document ${id} removed`);
  } catch (error) {
    console.error(`Error removing document ${id}:`, error);
  }
};

/**
 * Reindexar todos os documentos
 */
export const reindexAllDocuments = async (): Promise<void> => {
  try {
    console.log("Reindexing all documents...");
    
    // Salva os documentos atuais
    const currentDocuments = [...documents];
    
    // Limpa os arrays
    documents = [];
    chunks = [];
    
    // Limpa o cache de embeddings
    embeddingCache.clear();
    
    // Reindexar cada documento
    for (const doc of currentDocuments) {
      await addDocument(doc.id, doc.name, doc.content);
    }
    
    console.log(`Reindexed ${currentDocuments.length} documents`);
  } catch (error) {
    console.error("Error reindexing documents:", error);
  }
};

/**
 * Verifica se uma consulta contém termos específicos importantes
 */
const containsSpecificTerms = (query: string): boolean => {
  const specificTerms = [
    'cpj', 'cpj-3c', 'office.adv', 'spiced', 'cobrança', 'recuperação',
    'negociação', 'whatsapp', 'metodologia'
  ];
  
  const lowerQuery = query.toLowerCase();
  return specificTerms.some(term => lowerQuery.includes(term.toLowerCase()));
};

/**
 * Busca documentos relevantes para uma consulta
 */
export const search = (query: string, maxResults: number = MAX_RESULTS): SearchResult[] => {
  if (!isReady() || !isEnabled()) {
    console.log("Embedding service not ready or disabled");
    return [];
  }
  
  try {
    // Gera embedding para a consulta
    const queryEmbedding = createEmbedding(query);
    
    // Define o limiar de similaridade com base no tamanho da consulta 
    // ou se contém termos específicos importantes
    const isShortQuery = query.length <= SHORT_QUERY_LENGTH;
    const hasSpecificTerms = containsSpecificTerms(query);
    const threshold = (isShortQuery || hasSpecificTerms) ? 
      SIMILARITY_THRESHOLD_SHORT_QUERY : SIMILARITY_THRESHOLD;
    
    if (debugMode) {
      console.log(`Using similarity threshold: ${threshold} for query: "${query}"`);
      console.log(`Short query: ${isShortQuery}, Has specific terms: ${hasSpecificTerms}`);
    }
    
    // Calcula similaridade com todos os chunks
    const results = chunks
      .filter(chunk => chunk.embedding && chunk.embedding.length > 0)
      .map(chunk => {
        const similarity = calculateCosineSimilarity(queryEmbedding, chunk.embedding!);
        const document = documents.find(doc => doc.id === chunk.documentId);
        
        return {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          fileName: document?.name || "Unknown",
          content: chunk.content,
          score: similarity
        };
      })
      .filter(result => result.score > threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
    
    if (debugMode) {
      console.log(`Searching for relevant chunks for query: "${query}"`);
      console.log(`Found ${results.length} relevant chunks (from ${chunks.length} total)`);
      results.forEach((r, i) => {
        console.log(`Result ${i+1}: ${r.fileName}, Score: ${r.score.toFixed(4)}`);
      });
    } else {
      console.log(`Searching for relevant chunks for query: "${query}"`);
      console.log(`Found ${results.length} relevant chunks (from ${
        chunks.filter(c => c.embedding && c.embedding.length > 0).length
      } total above threshold ${threshold.toFixed(2)})`);
    }
    
    return results;
  } catch (error) {
    console.error("Error searching for relevant documents:", error);
    return [];
  }
};

/**
 * Condensa o contexto para reduzir tokens enviados
 */
const condensarContexto = (context: string): string => {
  if (context.length <= MAX_CONTEXT_LENGTH) return context;
  
  // Dividir em blocos
  const blocks = context.split('### Trecho de');
  
  // Remover cabeçalhos redundantes
  let condensedContext = '';
  const processedSources = new Set<string>();
  
  for (const block of blocks) {
    if (!block.trim()) continue;
    
    // Extrair fonte e conteúdo
    const matchSource = block.match(/(.+?)\s*\(relevância:.*?\):/);
    if (!matchSource) continue;
    
    const source = matchSource[1].trim();
    
    // Evitar duplicação de fontes
    if (!processedSources.has(source)) {
      processedSources.add(source);
      
      // Extrair apenas as informações mais relevantes de cada bloco
      const contentMatch = block.match(/\):\s*\n\n([\s\S]+?)(\n\n|$)/);
      let content = contentMatch ? contentMatch[1].trim() : '';
      
      if (content.length > 200) {
        content = content.substring(0, 197) + '...';
      }
      
      condensedContext += `### Informação de ${source}:\n\n${content}\n\n`;
    }
  }
  
  // Se ainda estiver muito longo, fazer um corte final
  if (condensedContext.length > MAX_CONTEXT_LENGTH) {
    condensedContext = condensedContext.substring(0, MAX_CONTEXT_LENGTH - 3) + '...';
  }
  
  return condensedContext;
};

/**
 * Obtém contexto relevante para uma consulta
 */
export const getRelevantContext = async (query: string): Promise<string> => {
  if (!isReady() || !isEnabled()) {
    console.log("Embedding service not ready or disabled, returning empty context");
    return "";
  }
  
  try {
    // Busca resultados relevantes
    const results = search(query);
    
    if (results.length === 0) {
      console.log("No relevant context found for query");
      return "";
    }
    
    // Formata os resultados como contexto
    const rawContext = results.map(result => {
      return `### Trecho de ${result.fileName} (relevância: ${(result.score * 100).toFixed(1)}%):\n\n${result.content}\n\n`;
    }).join("\n");
    
    // Condensar o contexto para reduzir o tamanho
    const context = condensarContexto(rawContext);
    
    console.log(`Contexto relevante recuperado: ${context.length} caracteres (reduzido de ${rawContext.length})`);
    return context;
  } catch (error) {
    console.error("Error getting relevant context:", error);
    return "";
  }
};

/**
 * Obtém estatísticas do serviço
 */
export const getStats = () => {
  return {
    documentCount: documents.length,
    chunkCount: chunks.length,
    isReady: isReady(),
    isEnabled: isEnabled()
  };
};

/**
 * Divide o conteúdo em chunks
 */
const splitIntoChunks = (documentId: string, content: string): Chunk[] => {
  const chunks: Chunk[] = [];
  
  // Divide por parágrafos primeiro
  const paragraphs = content.split(/\n\s*\n/);
  
  let currentChunk = "";
  
  for (const paragraph of paragraphs) {
    // Se o parágrafo for maior que o tamanho do chunk, divide-o
    if (paragraph.length > CHUNK_SIZE) {
      // Adiciona o chunk atual se não estiver vazio
      if (currentChunk.length > 0) {
        chunks.push({
          id: uuidv4(),
          documentId,
          content: currentChunk.trim()
        });
        currentChunk = "";
      }
      
      // Divide o parágrafo grande em chunks menores
      let i = 0;
      while (i < paragraph.length) {
        const chunkContent = paragraph.substring(i, i + CHUNK_SIZE);
        chunks.push({
          id: uuidv4(),
          documentId,
          content: chunkContent.trim()
        });
        i += CHUNK_SIZE - CHUNK_OVERLAP;
      }
    } 
    // Se adicionar o parágrafo exceder o tamanho do chunk, cria um novo chunk
    else if (currentChunk.length + paragraph.length > CHUNK_SIZE) {
      chunks.push({
        id: uuidv4(),
        documentId,
        content: currentChunk.trim()
      });
      currentChunk = paragraph;
    } 
    // Caso contrário, adiciona o parágrafo ao chunk atual
    else {
      if (currentChunk.length > 0) {
        currentChunk += "\n\n";
      }
      currentChunk += paragraph;
    }
  }
  
  // Adiciona o último chunk se não estiver vazio
  if (currentChunk.length > 0) {
    chunks.push({
      id: uuidv4(),
      documentId,
      content: currentChunk.trim()
    });
  }
  
  return chunks;
};

/**
 * Calcula a similaridade de cosseno entre dois vetores
 */
const calculateCosineSimilarity = (a: number[], b: number[]): number => {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Salva documentos e chunks no localStorage
 */
const saveToLocalStorage = (): void => {
  try {
    localStorage.setItem('rag_documents', JSON.stringify(documents));
    localStorage.setItem('rag_chunks', JSON.stringify(chunks));
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
};

// Exporta o serviço como um objeto para facilitar o uso
export const embeddingService = {
  initialize,
  isReady,
  addDocument,
  removeDocument,
  search,
  getRelevantContext,
  getStats,
  reindexAllDocuments,
  setDebug,
  setEnabled,
  isEnabled
};

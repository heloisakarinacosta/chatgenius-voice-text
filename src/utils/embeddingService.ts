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
}

// Estado do serviço
let documents: Document[] = [];
let chunks: Chunk[] = [];
let isInitialized = false;
let debugMode = false;

// Configurações
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const SIMILARITY_THRESHOLD = 0.75;
const MAX_RESULTS = 3;

/**
 * Inicializa o serviço de embeddings
 */
export const initialize = async (): Promise<void> => {
  if (isInitialized) return;
  
  try {
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
  console.log(`RAG system ${enabled ? 'enabled' : 'disabled'}`);
  localStorage.setItem('rag_enabled', enabled ? 'true' : 'false');
};

/**
 * Verifica se o sistema RAG está habilitado
 * 
 * @returns true se o sistema RAG estiver habilitado, false caso contrário
 */
export const isEnabled = (): boolean => {
  const enabled = localStorage.getItem('rag_enabled');
  return enabled !== 'false'; // Por padrão está habilitado
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
      console.log(`Document ${id} already exists, updating...`);
      
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
        // Gera embedding para o chunk
        const embedding = await createEmbedding(chunk.content);
        chunk.embedding = embedding;
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
      .filter(result => result.score > SIMILARITY_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
    
    if (debugMode) {
      console.log(`Found ${results.length} relevant chunks for query: ${query}`);
      results.forEach((r, i) => {
        console.log(`Result ${i+1}: ${r.fileName}, Score: ${r.score.toFixed(4)}`);
      });
    }
    
    return results;
  } catch (error) {
    console.error("Error searching for relevant documents:", error);
    return [];
  }
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
    const context = results.map(result => {
      return `### Trecho de ${result.fileName} (relevância: ${(result.score * 100).toFixed(1)}%):\n\n${result.content}\n\n`;
    }).join("\n");
    
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

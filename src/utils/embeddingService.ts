
import { createHash } from 'crypto';

// Interface para chunks de texto com metadados
export interface TextChunk {
  id: string;
  content: string;
  fileId: string;
  fileName: string;
  embedding?: number[];
}

// Interface para documento indexado
export interface IndexedDocument {
  chunks: TextChunk[];
  fileId: string;
  fileName: string;
}

// Interface para resultado de busca
export interface SearchResult {
  content: string;
  fileName: string;
  score: number;
}

// Serviço de embedding simplificado
export class EmbeddingService {
  private documents: Map<string, IndexedDocument> = new Map();
  private embeddingsCache: Map<string, number[]> = new Map();
  private ready = false;
  private minRelevanceScore = 0.5; // Limite mínimo de relevância para considerar um trecho relevante

  constructor() {
    console.log("Embedding service initialized");
  }

  // Gera um hash do texto para usar como chave de cache
  private generateHash(text: string): string {
    return createHash('md5').update(text).digest('hex');
  }

  // Divide texto em chunks de tamanho adequado
  private chunkText(text: string, fileId: string, fileName: string): TextChunk[] {
    // Dividir por parágrafos primeiro
    const paragraphs = text.split(/\n\s*\n/);
    
    const chunks: TextChunk[] = [];
    let currentChunk = "";
    
    // Tamanho alvo para cada chunk (aproximadamente 200 palavras)
    const targetSize = 1000;
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim().length === 0) continue;
      
      if ((currentChunk + paragraph).length <= targetSize) {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      } else {
        if (currentChunk) {
          const id = this.generateHash(currentChunk);
          chunks.push({
            id,
            content: currentChunk,
            fileId,
            fileName
          });
        }
        currentChunk = paragraph;
      }
    }
    
    // Adicionar o último chunk se existir
    if (currentChunk) {
      const id = this.generateHash(currentChunk);
      chunks.push({
        id,
        content: currentChunk,
        fileId,
        fileName
      });
    }
    
    return chunks;
  }

  // Implementação simplificada de embeddings - usa TF-IDF para vetorização
  // Em produção real, usaríamos a API de embeddings da OpenAI ou outro serviço
  private createEmbedding(text: string): number[] {
    const hash = this.generateHash(text);
    
    // Verificar cache
    if (this.embeddingsCache.has(hash)) {
      return this.embeddingsCache.get(hash)!;
    }
    
    // Implementação muito simplificada de vetorização
    // Em produção usaríamos embeddings reais
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const wordSet = new Set(words);
    
    // Criar um vetor de 100 dimensões baseado nos hashes das palavras
    const embedding = new Array(100).fill(0);
    
    wordSet.forEach(word => {
      const wordHash = this.hashCode(word);
      const position = Math.abs(wordHash) % 100;
      embedding[position] += 1;
    });
    
    // Normalizar o vetor
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const normalized = embedding.map(val => val / (magnitude || 1));
    
    // Armazenar em cache
    this.embeddingsCache.set(hash, normalized);
    
    return normalized;
  }

  // Função de hash simples para strings
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  // Calcula similaridade de cosseno entre dois vetores
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }
    
    return dotProduct;
  }

  // Adiciona um documento ao índice
  public addDocument(fileId: string, fileName: string, content: string): void {
    console.log(`Adding document to embedding index: ${fileName}`);
    
    if (this.documents.has(fileId)) {
      console.log(`Document ${fileId} already exists in index, updating`);
      this.documents.delete(fileId);
    }
    
    const chunks = this.chunkText(content, fileId, fileName);
    
    // Criar embeddings para cada chunk
    for (const chunk of chunks) {
      chunk.embedding = this.createEmbedding(chunk.content);
    }
    
    this.documents.set(fileId, {
      chunks,
      fileId,
      fileName
    });
    
    this.ready = true;
    console.log(`Document ${fileName} added to index with ${chunks.length} chunks`);
  }

  // Remove um documento do índice
  public removeDocument(fileId: string): void {
    console.log(`Removing document ${fileId} from index`);
    this.documents.delete(fileId);
    this.ready = this.documents.size > 0;
  }

  // Busca por documentos relevantes para uma query
  public search(query: string, topK: number = 3): SearchResult[] {
    if (!this.ready || this.documents.size === 0) {
      console.log("No documents in index or service not ready");
      return [];
    }
    
    console.log(`Searching for relevant chunks for query: "${query.substring(0, 30)}..."`);
    
    const queryEmbedding = this.createEmbedding(query);
    const results: Array<{content: string; fileName: string; score: number}> = [];
    
    // Buscar em todos os chunks de todos os documentos
    this.documents.forEach(doc => {
      doc.chunks.forEach(chunk => {
        if (chunk.embedding) {
          const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
          
          // Só adiciona resultados acima do limite mínimo de relevância
          if (score > this.minRelevanceScore) {
            results.push({
              content: chunk.content,
              fileName: chunk.fileName,
              score
            });
          }
        }
      });
    });
    
    // Ordenar por similaridade
    results.sort((a, b) => b.score - a.score);
    
    // Retornar os top-K resultados
    const topResults = results.slice(0, topK);
    
    console.log(`Found ${topResults.length} relevant chunks (from ${results.length} total above threshold)`);
    return topResults;
  }

  // Verifica se o serviço está pronto
  public isReady(): boolean {
    return this.ready;
  }

  // Retorna estatísticas sobre os documentos indexados
  public getStats(): { documentCount: number; chunkCount: number } {
    let chunkCount = 0;
    
    this.documents.forEach(doc => {
      chunkCount += doc.chunks.length;
    });
    
    return {
      documentCount: this.documents.size,
      chunkCount
    };
  }
  
  // Método para obter contexto relevante para uma query
  public getRelevantContext(query: string, maxChars: number = 4000): string {
    const results = this.search(query, 5); // Busca os 5 resultados mais relevantes
    
    if (results.length === 0) {
      console.log("No relevant context found for query");
      return "";
    }
    
    let context = "Informações relevantes sobre a consulta:\n\n";
    let totalChars = context.length;
    
    // Adiciona cada resultado ao contexto, mantendo abaixo do limite de caracteres
    for (const result of results) {
      const entry = `### Trecho de ${result.fileName} (relevância: ${result.score.toFixed(2)}):\n${result.content}\n\n`;
      
      if (totalChars + entry.length <= maxChars) {
        context += entry;
        totalChars += entry.length;
      } else {
        // Se o próximo trecho ultrapassa o limite, adiciona uma versão truncada
        const remainingChars = maxChars - totalChars - 100;
        if (remainingChars > 200) {
          const truncatedEntry = `### Trecho de ${result.fileName} (relevância: ${result.score.toFixed(2)}):\n${result.content.substring(0, remainingChars)}...\n\n`;
          context += truncatedEntry;
        }
        break;
      }
    }
    
    console.log(`Generated context with ${totalChars} characters from ${results.length} relevant chunks`);
    return context;
  }
}

// Instância singleton do serviço para ser usada em toda a aplicação
export const embeddingService = new EmbeddingService();

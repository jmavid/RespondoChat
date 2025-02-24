import { createParser } from 'eventsource-parser';
import { supabase } from './supabase';

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export async function generateEmbedding(text) {
  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-ada-002',
    }),
  });

  if (!response.ok) {
    logError(new Error(`OpenAI API error: ${response.status}`), 'embeddings');
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const { data } = await response.json();
  return data[0].embedding;
}

export function splitIntoChunks(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const words = text.split(' ');
  const chunks = [];
  let i = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + size).join(' ');
    chunks.push(chunk);
    i += size - overlap;
  }

  return chunks;
}

async function extractTextFromDocument(file) {
  let text = '';
  
  try {
    const textContent = await file.text();
    // Clean and normalize text
    text = textContent
      .slice(0, CHUNK_SIZE * 10)
      // Remove control characters and invalid Unicode
      .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\uFFFD\uFFFE\uFFFF]/g, '')
      // Remove invalid Unicode escape sequences
      .replace(/\\u[0-9A-Fa-f]{0,3}([^0-9A-Fa-f]|$)/g, '$1')
      .replace(/\\u[0-9A-Fa-f]{5,}/g, '')
      // Remove hex escape sequences
      .replace(/\\x[0-9A-Fa-f]{0,1}([^0-9A-Fa-f]|$)/g, '$1')
      .replace(/\\x[0-9A-Fa-f]{3,}/g, '')
      // Normalize remaining valid characters
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '');
    
  } catch (error) {
    throw new Error('Could not extract text from document');
  }
  
  return text;
}

export async function processDocument(documentId) {
  try {
    // Update document status to processing
    const { error: updateError } = await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    if (updateError) throw updateError;

    // Get document content (implementation depends on document type)
    const { data: document } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (!document) {
      logError(new Error('Document not found'), 'embeddings', { documentId });
      throw new Error('Document not found');
    }

    // Get file from storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('documents')
      .download(document.storage_path);

    if (fileError) {
      logError(fileError, 'embeddings', { documentId, action: 'download' });
      throw new Error('Could not download document');
    }

    // Convert file to text (implementation depends on file type)
    const text = await extractTextFromDocument(fileData);

    // Split text into chunks
    const chunks = splitIntoChunks(text);

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Store chunk
      const { data: chunkData, error: chunkError } = await supabase
        .from('document_chunks')
        .insert({
          document_id: documentId,
          content: chunk,
          chunk_index: i,
        })
        .select()
        .single();

      if (chunkError) {
        logError(chunkError, 'embeddings', { documentId, chunkNumber: i + 1 });
        throw chunkError;
      }

      // Generate and store embedding
      const embedding = await generateEmbedding(chunk);
      const { error: embeddingError } = await supabase
        .from('document_embeddings')
        .insert({
          document_id: documentId,
          chunk_id: chunkData.id,
          embedding,
        });

      if (embeddingError) {
        logError(embeddingError, 'embeddings', { documentId, chunkId: chunkData.id });
        throw embeddingError;
      }
    }

    // Update document status to completed
    const { error: finalUpdateError } = await supabase
      .from('documents')
      .update({ status: 'completed' })
      .eq('id', documentId);

    if (finalUpdateError) throw finalUpdateError;

  } catch (error) {
    logError(error, 'embeddings', { documentId });
    await supabase
      .from('documents')
      .update({
        status: 'error',
        error_message: error.message
      })
      .eq('id', documentId);
  }
}

export async function searchRelevantDocuments(query) {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);

    // Search for relevant documents using the match_documents function
    const { data: matches, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5
    });

    if (error) throw error;

    // Format the results
    return matches.map(match => ({
      content: match.content,
      similarity: match.similarity,
      documentId: match.document_id
    }));
  } catch (error) {
    console.error('Error searching documents:', error);
    return [];
  }
}

export async function getDocumentContext(query) {
  const relevantDocs = await searchRelevantDocuments(query);
  if (relevantDocs.length === 0) return null;

  // Format the context for the chat
  const context = relevantDocs
    .map(doc => doc.content)
    .join('\n\n');

  return context;
}
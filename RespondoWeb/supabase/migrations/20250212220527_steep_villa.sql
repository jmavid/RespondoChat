/*
  # Documents Management Implementation

  1. New Tables
    - `documents`: Stores document metadata and status
    - `document_embeddings`: Stores document content embeddings
    - `document_chunks`: Stores document content in searchable chunks

  2. Security
    - Enable RLS on all tables
    - Add policies for document access and management

  3. Changes
    - Add support for document processing status tracking
    - Add embedding storage and search capabilities
*/

-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Document status enum
CREATE TYPE document_status AS ENUM (
  'pending', 'processing', 'completed', 'error'
);

-- Document type enum
CREATE TYPE document_type AS ENUM (
  'txt', 'doc', 'docx', 'pdf', 'ppt', 'pptx'
);

-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type document_type NOT NULL,
  size INTEGER NOT NULL,
  status document_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Document chunks table for storing processed text
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, chunk_index)
);

-- Document embeddings table
CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- Documents policies
CREATE POLICY "Users can view their own documents"
  ON documents FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert their own documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Document chunks policies
CREATE POLICY "Users can view chunks of their documents"
  ON document_chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_chunks.document_id
      AND documents.created_by = auth.uid()
    )
  );

-- Document embeddings policies
CREATE POLICY "Users can view embeddings of their documents"
  ON document_embeddings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_embeddings.document_id
      AND documents.created_by = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_documents_created_by ON documents(created_by);
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_embeddings_document_id ON document_embeddings(document_id);
CREATE INDEX idx_document_embeddings_chunk_id ON document_embeddings(chunk_id);

-- Create function for similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  document_id UUID,
  chunk_id UUID,
  content TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id AS document_id,
    dc.id AS chunk_id,
    dc.content,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM document_embeddings de
  JOIN document_chunks dc ON dc.id = de.chunk_id
  JOIN documents d ON d.id = de.document_id
  WHERE 1 - (de.embedding <=> query_embedding) > match_threshold
  AND d.created_by = auth.uid()
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
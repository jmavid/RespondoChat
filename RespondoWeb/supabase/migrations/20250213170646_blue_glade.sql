/*
  # Fix document_embeddings RLS policies

  1. Changes
    - Drop existing document_embeddings RLS policies
    - Create new policies that allow:
      - Viewing embeddings for owned documents
      - Inserting embeddings for owned documents
    - Add performance optimization indexes

  2. Security
    - Enable RLS
    - Ensure users can only access embeddings for their own documents
    - Maintain data isolation between users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view embeddings of their documents" ON document_embeddings;

-- Create new policies for document_embeddings
CREATE POLICY "Users can view their document embeddings"
  ON document_embeddings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_embeddings.document_id
      AND documents.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert embeddings for their documents"
  ON document_embeddings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_embeddings.document_id
      AND documents.created_by = auth.uid()
    )
  );

-- Add indexes to improve performance
CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id
  ON document_embeddings(document_id);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_chunk_id
  ON document_embeddings(chunk_id);
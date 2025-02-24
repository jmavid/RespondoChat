/*
  # Fix document_chunks RLS policies

  1. Changes
    - Drop existing document_chunks RLS policies
    - Create new policies that properly handle document processing
    - Add policy for inserting chunks during document processing
    - Maintain security by checking document ownership

  2. Security
    - Enable RLS
    - Ensure users can only access their own document chunks
    - Allow insertion of chunks for documents owned by the user
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view chunks of their documents" ON document_chunks;

-- Create new policies for document_chunks
CREATE POLICY "Users can view their document chunks"
  ON document_chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_chunks.document_id
      AND documents.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert chunks for their documents"
  ON document_chunks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_chunks.document_id
      AND documents.created_by = auth.uid()
    )
  );

-- Add index to improve performance
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id_created_by
  ON document_chunks(document_id);
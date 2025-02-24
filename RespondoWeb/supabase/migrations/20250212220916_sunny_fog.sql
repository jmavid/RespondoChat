/*
  # Create storage bucket for documents

  1. New Storage
    - Creates a new storage bucket called 'documents' for storing uploaded files
  
  2. Security
    - Enables RLS policies for the bucket
    - Adds policies for authenticated users to:
      - Read their own documents
      - Upload new documents
      - Delete their own documents
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- Create policies for the documents bucket
CREATE POLICY "Users can read their own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
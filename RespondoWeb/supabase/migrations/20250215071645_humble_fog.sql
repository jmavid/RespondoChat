/*
  # WhatsApp Assistant Integration Schema

  1. New Tables
    - `whatsapp_conversations`
      - `id` (uuid, primary key)
      - `phone` (text, unique)
      - `contact_name` (text, nullable)
      - `status` (text)
      - `created_at` (timestamp)
      - `last_message_at` (timestamp)
      - `assistant_id` (text)
      - `thread_id` (text)
    
    - `whatsapp_messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, references whatsapp_conversations)
      - `content` (text)
      - `role` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create enum for conversation status
CREATE TYPE whatsapp_conversation_status AS ENUM (
  'active',
  'archived'
);

-- Create enum for message roles
CREATE TYPE whatsapp_message_role AS ENUM (
  'user',
  'assistant',
  'whatsapp'
);

-- Create conversations table
CREATE TABLE whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  status whatsapp_conversation_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assistant_id TEXT,
  thread_id TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create messages table
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  role whatsapp_message_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_whatsapp_conversations_phone ON whatsapp_conversations(phone);
CREATE INDEX idx_whatsapp_conversations_status ON whatsapp_conversations(status);
CREATE INDEX idx_whatsapp_messages_conversation ON whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_created_at ON whatsapp_messages(created_at);

-- RLS Policies for conversations
CREATE POLICY "Users can view all conversations"
  ON whatsapp_conversations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create conversations"
  ON whatsapp_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update conversations"
  ON whatsapp_conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for messages
CREATE POLICY "Users can view messages from visible conversations"
  ON whatsapp_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations
      WHERE whatsapp_conversations.id = whatsapp_messages.conversation_id
    )
  );

CREATE POLICY "Users can insert messages"
  ON whatsapp_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations
      WHERE whatsapp_conversations.id = whatsapp_messages.conversation_id
      AND whatsapp_conversations.created_by = auth.uid()
    )
  );

-- Function to update last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating last_message_at
CREATE TRIGGER update_conversation_timestamp
  AFTER INSERT ON whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();
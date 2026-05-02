-- Add a conversation_id column to chat_history so we can group messages
-- into discrete chats (ChatGPT-style). Existing rows get NULL and are
-- treated as a single "Legacy" conversation by the API.

ALTER TABLE chat_history
  ADD COLUMN IF NOT EXISTS conversation_id UUID;

CREATE INDEX IF NOT EXISTS idx_chat_history_user_conversation
  ON chat_history(user_id, conversation_id, created_at);

-- Aggiungere tabella per preferenze notifiche utente
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT UNIQUE NOT NULL,
  email_orders BOOLEAN DEFAULT true,
  email_payments BOOLEAN DEFAULT true,
  email_updates BOOLEAN DEFAULT false,
  inapp_orders BOOLEAN DEFAULT true,
  inapp_messages BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_user_notification_preferences_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Aggiungere indice per performance
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user_id
  ON user_notification_preferences(user_id);

-- Aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_notification_preferences_updated_at
  BEFORE UPDATE ON user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE catalogue ADD COLUMN IF NOT EXISTS review jsonb NOT NULL DEFAULT '{"content":false,"rates":false,"capacity":false,"policy":false,"media":false}';

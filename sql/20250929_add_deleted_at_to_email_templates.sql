-- Soft delete support for email campaign templates
ALTER TABLE email_campaign_templates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_email_campaign_templates_deleted_at ON email_campaign_templates(deleted_at);

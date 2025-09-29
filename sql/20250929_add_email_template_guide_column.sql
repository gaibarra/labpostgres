-- Add guide column to email_campaign_templates
ALTER TABLE email_campaign_templates ADD COLUMN IF NOT EXISTS guide text;

-- Optional future index if searching by guide length or content snippet (commented for now)
-- CREATE INDEX IF NOT EXISTS idx_email_template_guide_gin ON email_campaign_templates USING gin (to_tsvector('spanish', guide));

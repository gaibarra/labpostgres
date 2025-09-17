-- Migration: Align marketing & content/loyalty schema with current Express route expectations
-- Date: 2025-09-11
-- Purpose: Add missing columns used by server/routes/marketing.js that caused 500 errors
-- Safe/idempotent: Uses IF NOT EXISTS checks or adds nullable columns / defaults

-- 1. ad_campaigns: expected columns (name, platform, start_date, end_date, budget, objectives, status, notes, kpis)
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ad_campaigns' AND column_name='platform') THEN
    ALTER TABLE ad_campaigns ADD COLUMN platform text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ad_campaigns' AND column_name='start_date') THEN
    ALTER TABLE ad_campaigns ADD COLUMN start_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ad_campaigns' AND column_name='end_date') THEN
    ALTER TABLE ad_campaigns ADD COLUMN end_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ad_campaigns' AND column_name='objectives') THEN
    ALTER TABLE ad_campaigns ADD COLUMN objectives text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ad_campaigns' AND column_name='notes') THEN
    ALTER TABLE ad_campaigns ADD COLUMN notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ad_campaigns' AND column_name='kpis') THEN
    ALTER TABLE ad_campaigns ADD COLUMN kpis jsonb DEFAULT '{}'::jsonb;
  END IF;
END$$;

-- 2. social_media_posts: expected (platform, publish_date_time, content, content_type, media_url, hashtags, status, notes, engagement)
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='social_media_posts' AND column_name='content_type') THEN
    ALTER TABLE social_media_posts ADD COLUMN content_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='social_media_posts' AND column_name='media_url') THEN
    ALTER TABLE social_media_posts ADD COLUMN media_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='social_media_posts' AND column_name='hashtags') THEN
    ALTER TABLE social_media_posts ADD COLUMN hashtags text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='social_media_posts' AND column_name='notes') THEN
    ALTER TABLE social_media_posts ADD COLUMN notes text;
  END IF;
END$$;

-- 3. seo_keywords: expected (keyword, target_url, volume, difficulty, position, notes)
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seo_keywords' AND column_name='target_url') THEN
    ALTER TABLE seo_keywords ADD COLUMN target_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seo_keywords' AND column_name='volume') THEN
    ALTER TABLE seo_keywords ADD COLUMN volume int;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seo_keywords' AND column_name='difficulty') THEN
    ALTER TABLE seo_keywords ADD COLUMN difficulty int;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seo_keywords' AND column_name='position') THEN
    ALTER TABLE seo_keywords ADD COLUMN position int;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seo_keywords' AND column_name='notes') THEN
    ALTER TABLE seo_keywords ADD COLUMN notes text;
  END IF;
END$$;

-- 4. web_content: expected (title, author, publish_date, content, status, category, tags)
DO $$BEGIN
  -- Add missing simple columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='web_content' AND column_name='author') THEN
    ALTER TABLE web_content ADD COLUMN author text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='web_content' AND column_name='publish_date') THEN
    ALTER TABLE web_content ADD COLUMN publish_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='web_content' AND column_name='content') THEN
    ALTER TABLE web_content ADD COLUMN content text;  -- keep legacy body column if present
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='web_content' AND column_name='category') THEN
    ALTER TABLE web_content ADD COLUMN category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='web_content' AND column_name='tags') THEN
    ALTER TABLE web_content ADD COLUMN tags text;
  END IF;
END$$;

-- 5. loyalty_programs: expected (name, type, description, rules, start_date, end_date, status)
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loyalty_programs' AND column_name='type') THEN
    ALTER TABLE loyalty_programs ADD COLUMN type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loyalty_programs' AND column_name='rules') THEN
    ALTER TABLE loyalty_programs ADD COLUMN rules text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loyalty_programs' AND column_name='start_date') THEN
    ALTER TABLE loyalty_programs ADD COLUMN start_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loyalty_programs' AND column_name='end_date') THEN
    ALTER TABLE loyalty_programs ADD COLUMN end_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loyalty_programs' AND column_name='status') THEN
    ALTER TABLE loyalty_programs ADD COLUMN status text DEFAULT 'Borrador';
  END IF;
END$$;

-- 6. loyalty_program_levels: expected description column
DO $$BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loyalty_program_levels' AND column_name='description') THEN
    ALTER TABLE loyalty_program_levels ADD COLUMN description text;
  END IF;
END$$;

-- 7. subscribers: ensure UNIQUE(email) already set in earlier migration; skip.

-- 8. system_audit_logs: ensure created_at index already handled in route initialization.

-- This migration intentionally avoids dropping legacy columns (e.g., web_content.body) to preserve data.

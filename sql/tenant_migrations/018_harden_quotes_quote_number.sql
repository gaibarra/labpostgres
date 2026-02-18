BEGIN;

WITH numbered AS (
	SELECT
		id,
		quote_number,
		created_at,
		CASE
			WHEN quote_number ~ '^COT-[0-9]{4,}$' THEN substring(quote_number FROM 5)::int
			ELSE NULL
		END AS seq,
		row_number() OVER (
			PARTITION BY quote_number
			ORDER BY created_at NULLS LAST, id
		) AS dup_rn
	FROM quotes
),
max_seq AS (
	SELECT COALESCE(MAX(seq), 0) AS max_seq
	FROM numbered
	WHERE seq IS NOT NULL
		AND dup_rn = 1
),
to_fix AS (
	SELECT
		n.id,
		m.max_seq,
		row_number() OVER (
			ORDER BY n.created_at NULLS LAST, n.id
		) AS ord
	FROM numbered n
	CROSS JOIN max_seq m
	WHERE n.quote_number IS NULL
		OR n.quote_number !~ '^COT-[0-9]{4,}$'
		OR n.dup_rn > 1
)
UPDATE quotes q
SET quote_number = 'COT-' || lpad((tf.max_seq + tf.ord)::text, 4, '0')
FROM to_fix tf
WHERE q.id = tf.id;

ALTER TABLE quotes
	ALTER COLUMN quote_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS quotes_quote_number_uq
	ON quotes (quote_number);

COMMIT;

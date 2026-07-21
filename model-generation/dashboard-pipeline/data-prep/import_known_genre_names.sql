-- Restore known human-readable genre names into the server genres table.
\timing on

DROP TABLE IF EXISTS tmp_known_genre_names;
CREATE TEMP TABLE tmp_known_genre_names (
  genre_id bigint,
  genre_name text
);

\copy tmp_known_genre_names(genre_id, genre_name) FROM '/tmp/genre_names_known.csv' WITH (FORMAT csv, HEADER true)

UPDATE genres g
SET genre_name_ja = k.genre_name,
    genre_name_en = COALESCE(NULLIF(g.genre_name_en, ''), k.genre_name)
FROM tmp_known_genre_names k
WHERE k.genre_id = g.genre_id
  AND k.genre_name IS NOT NULL
  AND k.genre_name <> '';

SELECT count(*) AS restored_names
FROM genres g
JOIN tmp_known_genre_names k ON k.genre_id = g.genre_id
WHERE g.genre_name_ja = k.genre_name;

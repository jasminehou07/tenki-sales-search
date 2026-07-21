UPDATE genres
SET
  genre_name_ja = trim(regexp_replace(genre_name_ja, ' \([^()]*\)$', '')),
  genre_name_en = substring(genre_name_en from '\(([^()]*)\)$')
WHERE genre_name_ja = genre_name_en
  AND genre_name_ja ~ ' \([^()]*\)$';

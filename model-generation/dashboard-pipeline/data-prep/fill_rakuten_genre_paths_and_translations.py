#!/usr/bin/env python3
from __future__ import annotations

import concurrent.futures
import csv
import html
import json
import re
import ssl
import subprocess
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass


PSQL = ["sudo", "-u", "postgres", "psql", "-d", "tenki_dashboard"]
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.I | re.S)
TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single"


@dataclass
class GenrePath:
    genre_id: str
    ja_path: str
    en_path: str = ""


def psql_csv(sql: str) -> list[dict[str, str]]:
    output = subprocess.check_output([*PSQL, "--csv", "-c", sql], text=True)
    return list(csv.DictReader(output.splitlines()))


def psql_exec(sql: str) -> None:
    subprocess.run([*PSQL, "-v", "ON_ERROR_STOP=1", "-f", "-"], input=sql, text=True, check=True)


def parse_path(raw_title: str) -> str | None:
    title = html.unescape(re.sub(r"\s+", " ", raw_title)).strip()
    title = re.sub(r"^【楽天市場】", "", title)
    title = re.sub(r"の通販.*$", "", title)
    title = title.strip(" ：")
    if not title:
        return None

    if "：" in title:
        left, root = title.split("：", 1)
        root = root.strip()
    else:
        left, root = title, ""

    leaf = left.strip()
    parents: list[str] = []
    match = re.match(r"^(.*?)（(.*?)）$", left)
    if match:
        leaf = match.group(1).strip()
        parents = [part.strip() for part in match.group(2).split("｜") if part.strip()]

    parts = [root, *reversed(parents), leaf]
    path = " > ".join(part for part in parts if part)
    return path or None


def fetch_path(genre_id: str, retries: int = 2) -> GenrePath | None:
    url = f"https://www.rakuten.co.jp/category/{genre_id}/"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    ctx = ssl._create_unverified_context()
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=18) as response:
                body = response.read().decode("utf-8", "ignore")
            match = TITLE_RE.search(body)
            if not match:
                return None
            path = parse_path(match.group(1))
            if path:
                return GenrePath(genre_id=genre_id, ja_path=path)
            return None
        except Exception:
            if attempt >= retries:
                return None
            time.sleep(0.8 + attempt)
    return None


def translate_one(text: str, retries: int = 2) -> str:
    query = urllib.parse.urlencode(
        {"client": "gtx", "sl": "ja", "tl": "en", "dt": "t", "q": text}
    )
    req = urllib.request.Request(f"{TRANSLATE_URL}?{query}", headers={"User-Agent": "Mozilla/5.0"})
    ctx = ssl._create_unverified_context()
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=18) as response:
                payload = json.loads(response.read().decode("utf-8", "ignore"))
            translated = "".join(part[0] for part in payload[0] if part and part[0])
            translated = translated.replace("＞", ">").replace(" > ", " > ")
            return re.sub(r"\s+", " ", translated).strip()
        except Exception:
            if attempt >= retries:
                return ""
            time.sleep(0.6 + attempt)
    return ""


def sql_literal(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    rows = psql_csv(
        """
        SELECT genre_id::text AS genre_id
        FROM genres
        WHERE active = true
        ORDER BY genre_id;
        """
    )
    ids = [row["genre_id"] for row in rows]
    print(f"genre_count={len(ids)}", flush=True)

    paths: list[GenrePath] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=14) as executor:
        future_to_id = {executor.submit(fetch_path, genre_id): genre_id for genre_id in ids}
        for index, future in enumerate(concurrent.futures.as_completed(future_to_id), 1):
            result = future.result()
            if result:
                paths.append(result)
            if index % 50 == 0:
                print(f"fetched={index} paths={len(paths)}", flush=True)

    print(f"path_count={len(paths)}", flush=True)

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_index = {
            executor.submit(translate_one, row.ja_path): index for index, row in enumerate(paths)
        }
        for done_count, future in enumerate(concurrent.futures.as_completed(future_to_index), 1):
            index = future_to_index[future]
            paths[index].en_path = future.result()
            if done_count % 50 == 0:
                translated_count = sum(1 for row in paths if row.en_path)
                print(f"translated={done_count} ok={translated_count}", flush=True)

    values = ",\n".join(
        f"({sql_literal(row.genre_id)}::bigint, {sql_literal(row.ja_path)}, {sql_literal(row.en_path or None)})"
        for row in paths
    )
    psql_exec(
        f"""
        WITH incoming(genre_id, ja_path, en_path) AS (
          VALUES
          {values}
        )
        UPDATE genres g
        SET genre_name_ja = incoming.ja_path,
            genre_name_en = incoming.en_path
        FROM incoming
        WHERE g.genre_id = incoming.genre_id;
        """
    )

    missing = psql_csv(
        """
        SELECT COUNT(*) AS missing
        FROM genres
        WHERE active = true
          AND (
            genre_name_ja IS NULL OR genre_name_ja = ''
            OR genre_name_en IS NULL OR genre_name_en = ''
          );
        """
    )
    print(f"missing_after={missing[0]['missing']}", flush=True)


if __name__ == "__main__":
    main()

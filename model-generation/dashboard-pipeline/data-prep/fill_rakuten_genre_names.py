#!/usr/bin/env python3
from __future__ import annotations

import concurrent.futures
import csv
import html
import re
import ssl
import subprocess
import time
import urllib.request
from dataclasses import dataclass


PSQL = ["sudo", "-u", "postgres", "psql", "-d", "tenki_dashboard"]
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.I | re.S)


@dataclass
class GenreName:
    genre_id: str
    label: str


def psql_csv(sql: str) -> list[dict[str, str]]:
    output = subprocess.check_output([*PSQL, "--csv", "-c", sql], text=True)
    return list(csv.DictReader(output.splitlines()))


def psql_exec(sql: str) -> None:
    subprocess.check_call([*PSQL, "-v", "ON_ERROR_STOP=1", "-c", sql])


def parse_title(raw_title: str) -> str | None:
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

    leaf = left
    parents: list[str] = []
    match = re.match(r"^(.*?)（(.*?)）$", left)
    if match:
        leaf = match.group(1).strip()
        parents = [part.strip() for part in match.group(2).split("｜") if part.strip()]

    if not leaf:
        return None

    # Most category labels should stay compact. "Other" needs context because
    # Rakuten has many unrelated categories named その他.
    if leaf == "その他":
        path = [root, *reversed(parents), leaf]
        return " > ".join(part for part in path if part)
    return leaf


def fetch_name(genre_id: str, retries: int = 2) -> GenreName | None:
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
            label = parse_title(match.group(1))
            if label and not label.startswith("Genre "):
                return GenreName(genre_id, label)
            return None
        except Exception:
            if attempt >= retries:
                return None
            time.sleep(0.8 + attempt)
    return None


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    missing = psql_csv(
        """
        SELECT genre_id::text AS genre_id
        FROM genres
        WHERE active = true
          AND (
            genre_name_ja IS NULL
            OR genre_name_ja = ''
            OR genre_name_ja = 'Genre ' || genre_id::text
          )
        ORDER BY genre_id;
        """
    )
    ids = [row["genre_id"] for row in missing]
    print(f"missing_before={len(ids)}", flush=True)
    if not ids:
        return

    names: list[GenreName] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        future_to_id = {executor.submit(fetch_name, genre_id): genre_id for genre_id in ids}
        for index, future in enumerate(concurrent.futures.as_completed(future_to_id), 1):
            result = future.result()
            if result:
                names.append(result)
            if index % 50 == 0:
                print(f"checked={index} found={len(names)}", flush=True)

    print(f"found={len(names)}", flush=True)
    if not names:
        return

    values = ",\n".join(
        f"({sql_literal(row.genre_id)}::bigint, {sql_literal(row.label)})" for row in names
    )
    psql_exec(
        f"""
        WITH incoming(genre_id, label) AS (
          VALUES
          {values}
        )
        UPDATE genres g
        SET genre_name_ja = incoming.label,
            genre_name_en = NULL
        FROM incoming
        WHERE g.genre_id = incoming.genre_id;
        """
    )

    remaining = psql_csv(
        """
        SELECT COUNT(*) AS remaining
        FROM genres
        WHERE active = true
          AND (
            genre_name_ja IS NULL
            OR genre_name_ja = ''
            OR genre_name_ja = 'Genre ' || genre_id::text
          );
        """
    )
    print(f"missing_after={remaining[0]['remaining']}", flush=True)


if __name__ == "__main__":
    main()

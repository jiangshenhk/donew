#!/usr/bin/env python3
"""Scrape TSE stock codes from Japanese Wikipedia listing pages."""

import re
import sys
import json
import time
import urllib.request
import urllib.error
from pathlib import Path
from html.parser import HTMLParser

WIKI_PAGES = {
    "prime": "東京証券取引所プライム市場上場企業一覧",
    "standard": "東京証券取引所スタンダード市場上場企業一覧",
    "growth": "東京証券取引所グロース市場上場企業一覧",
}

OUTPUT_DIR = Path(__file__).parent.parent / "config"
OUTPUT_FILE = OUTPUT_DIR / "tse-codes.txt"
OUTPUT_JSON = OUTPUT_DIR / "tse-codes.json"

UA = "Mozilla/5.0 donew-jp-stocks/1.0"


class StockTableParser(HTMLParser):
    """Parse Wikipedia table rows extracting stock code + name."""

    def __init__(self):
        super().__init__()
        self.results = []
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.cell_idx = 0
        self.cells = []
        self.code_pattern = re.compile(r"^(\d{4}[A-Z]?)$")

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self.in_table = True
        elif tag == "tr":
            self.in_row = True
            self.cells = []
            self.cell_idx = 0
        elif tag in ("td", "th"):
            self.in_cell = True
            if not hasattr(self, "cell_text"):
                self.cell_text = ""

    def handle_endtag(self, tag):
        if tag == "table":
            self.in_table = False
        elif tag == "tr":
            if self.in_row:
                self._process_row()
            self.in_row = False
        elif tag in ("td", "th"):
            if self.in_cell and hasattr(self, "cell_text"):
                self.cells.append(self.cell_text.strip())
                self.cell_text = ""
            self.in_cell = False
            self.cell_idx += 1

    def handle_data(self, data):
        if self.in_cell:
            if not hasattr(self, "cell_text"):
                self.cell_text = ""
            self.cell_text += data

    def _process_row(self):
        if not self.cells:
            return
        first = self.cells[0].strip()
        m = self.code_pattern.match(first)
        if m:
            code = m.group(1)
            name = self.cells[1].strip() if len(self.cells) > 1 else ""
            sector = self.cells[2].strip() if len(self.cells) > 2 else ""
            self.results.append({
                "code": code,
                "name": name,
                "sector": sector,
            })


def wiki_url(page_title):
    encoded = urllib.parse.quote(page_title)
    return f"https://ja.wikipedia.org/wiki/{encoded}"


def fetch_page(url, retry=2):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8")
    except Exception as e:
        if retry > 0:
            time.sleep(2)
            return fetch_page(url, retry - 1)
        raise e


def extract_codes_from_html(html):
    parser = StockTableParser()
    parser.feed(html)
    parser.close()
    return parser.results


def main():
    all_stocks = []
    for market, page_title in WIKI_PAGES.items():
        print(f"Fetching {market} market: {page_title} ...")
        url = wiki_url(page_title)
        try:
            html = fetch_page(url)
            stocks = extract_codes_from_html(html)
            for s in stocks:
                s["market"] = market
            all_stocks.extend(stocks)
            print(f"  -> {len(stocks)} stocks")
        except Exception as e:
            print(f"  -> FAILED: {e}", file=sys.stderr)

    # deduplicate by code
    seen = set()
    unique = []
    for s in all_stocks:
        if s["code"] not in seen:
            seen.add(s["code"])
            unique.append(s)

    print(f"\nTotal: {len(unique)} unique stocks")

    # Save plain text code list
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        for s in unique:
            f.write(s["code"] + "\n")
    print(f"Saved: {OUTPUT_FILE} ({len(unique)} codes)")

    # Save JSON with metadata
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(unique, f, ensure_ascii=False, indent=2)
    print(f"Saved: {OUTPUT_JSON}")

    return unique


if __name__ == "__main__":
    main()

"""
日股清单 + 收盘价 | JPX Excel + Yahoo Finance v8 chart API
用法: python3 jp_stocks_download.py
输出: jp_stocks_YYYYMMDD.csv (date, code, name, market, price)
"""
import re, time, random
import pandas as pd
import requests
from io import BytesIO
from datetime import datetime, timezone, timedelta

JST = timezone(timedelta(hours=9))
DELAY = (1, 5)
PAGE = "https://www.jpx.co.jp/english/markets/statistics-equities/misc/01.html"
CHART_API = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1d&interval=1d"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

def fetch_code_list():
    html = requests.get(PAGE).text
    m = re.search(r'href="(/english/markets/statistics-equities/misc/[^"]+?data_e\.xls)"', html)
    if not m:
        raise RuntimeError("JPX 英文链接未找到")

    print("下载清单...")
    url = f"https://www.jpx.co.jp{m.group(1)}"
    df = pd.read_excel(BytesIO(requests.get(url).content), skiprows=1)
    df.columns = ["date", "code", "name", "market", "s33c", "s33n", "s17c", "s17n", "sc", "sn"]
    df["code"] = df["code"].astype(str).str[:4].str.zfill(4)
    df = df[df["market"].str.contains("Prime")]
    return df

def fetch_price(code):
    url = CHART_API.format(symbol=f"{code}.T")
    resp = requests.get(url, headers=UA, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    result = data["chart"]["result"][0]
    closes = result["indicators"]["quote"][0]["close"]
    if not closes or closes[-1] is None:
        return None
    return round(float(closes[-1]), 1)

def main():
    df = fetch_code_list()
    codes = df["code"].tolist()
    print(f"股票数: {len(codes)}")
    print("获取收盘价...")

    prices = []
    for i, code in enumerate(codes):
        try:
            price = fetch_price(code)
            if price is not None:
                prices.append({"code": code, "price": price})
        except Exception as e:
            print(f"  [{i+1}/{len(codes)}] {code} 失败: {e}")
        else:
            if (i + 1) % 100 == 0 or i == 0:
                print(f"  [{i+1}/{len(codes)}] {code} -> {price}")
        if i < len(codes) - 1:
            time.sleep(random.uniform(*DELAY))

    today = datetime.now(JST).strftime("%Y%m%d")
    result = df[["code", "name", "market"]].merge(pd.DataFrame(prices), on="code", how="left")
    result = result[result["price"].notna()]
    result.insert(0, "date", today)
    filename = f"jp_stocks_{today}.csv"
    result.to_csv(filename, index=False, encoding="utf-8-sig")
    print(f"\nOK: {len(result)} 条 → {filename}")

if __name__ == "__main__":
    main()

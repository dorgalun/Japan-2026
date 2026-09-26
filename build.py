#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Builds index.html for the Japan 2026 trip journal.

Source of truth is the Google Sheet. Set SHEET_CSV_URL to pull live;
otherwise it falls back to data/itinerary.csv committed in the repo.

Pipeline:
  fetch CSV -> parse -> translate -> classify -> schedule -> geo -> describe -> render
"""

import csv, io, json, os, re, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))
from descriptions import DESC
from manual_data import MANUAL_GEO, SPECIFIC_DURATION, SPECIFIC_PRE_BUFFER, HEBREW_TR

MY_MAPS_MID = os.environ.get("MY_MAPS_MID", "1auRDMFLkK3rKKc5S2lpAZQI8GooGjY8")
SHEET_CSV_URL = os.environ.get("SHEET_CSV_URL", "").strip()
FALLBACK_CSV = ROOT / "itinerary.csv"


# ---------------------------------------------------------------- fetch
def get_csv_text():
    if SHEET_CSV_URL:
        print(f"Fetching sheet: {SHEET_CSV_URL[:60]}...")
        req = urllib.request.Request(
            SHEET_CSV_URL, headers={"User-Agent": "Mozilla/5.0 (trip-journal-build)"}
        )
        with urllib.request.urlopen(req, timeout=45) as r:
            text = r.read().decode("utf-8-sig")
        if "<html" in text[:400].lower():
            raise SystemExit(
                "ERROR: sheet URL returned HTML, not CSV.\n"
                "The sheet is probably not shared publicly, or the URL is the\n"
                "normal edit link. See README for the correct URL format."
            )
        # keep a copy so the build still works if the sheet is unreachable later
        FALLBACK_CSV.write_text(text, encoding="utf-8")
        print(f"  got {len(text)} bytes, cached to {FALLBACK_CSV.name}")
        return text
    print(f"No SHEET_CSV_URL set, using {FALLBACK_CSV}")
    return FALLBACK_CSV.read_text(encoding="utf-8-sig")


# ---------------------------------------------------------------- parse
def parse_csv(text):
    reader = csv.reader(io.StringIO(text))
    next(reader, None)  # header
    days, cur_day, cur_city = [], None, None
    for row in reader:
        row = row + [""] * (13 - len(row))
        (date, dow, city, activity, tfrom, tto, gmap,
         l1, l2, l3, info, platform, resv) = [c.strip() for c in row[:13]]
        if not any(row[:13]):
            continue
        if date:
            cur_day = {"date": date, "dow": dow, "city": city or cur_city, "events": []}
            days.append(cur_day)
            cur_city = city or cur_city
        if city:
            cur_city = city
        if cur_day is None or (not activity and not gmap and not tfrom):
            continue
        cur_day["events"].append({
            "city": city or None, "activity": activity,
            "from": tfrom, "to": tto, "gmap": gmap,
            "links": [l for l in (l1, l2, l3) if l],
            "info": info, "platform": platform, "resv": resv,
        })
    return days


def translate(days):
    CITY_FIX = {"tokyo": "Tokyo", "hakone": "Hakone", "kyoto": "Kyoto",
                "nara": "Nara", "osaka": "Osaka", "israel": "Israel"}
    def fix(s):
        for heb, eng in HEBREW_TR.items():
            s = s.replace(heb, eng)
        return s
    for day in days:
        day["city"] = CITY_FIX.get((day["city"] or "").lower(), day["city"])
        for e in day["events"]:
            for f in ("activity", "info", "platform", "resv"):
                e[f] = fix(e.get(f, "") or "")
            if e.get("city"):
                e["city"] = CITY_FIX.get(e["city"].lower(), e["city"])
    return days


# ---------------------------------------------------------------- classify
FOOD_KW = ['tea','teahouse','sweet','dessert','dashi','tsukemen','ramen','sushi','yakiniku','yakitori',
 'kaiseki','omakase','bento','gyoza','curry','burger','pizza','noodle','pancake','bagel','croissant',
 'bakery','cola','maguro','maguroya','onigiri','panchan','bun','dinner','lunch','breakfast','coffee',
 'matcha','snack','cafe','wagyu','katsu','soba','udon','tempura','shabu','custa','izakaya']
BAR_KW = ['bar','pub','whisky','whiskey','sake','distillery','cocktail','gin','brewery','beer']
SHOP_KW = ['shopping','buy','buying','store','shop','market','mart','boutique','camera','record',
 'ceramics','knives','kappabashi','don quijote','itoya','pringles']
STAY_KW = ['check-in','arriving','hotel']
DRIVE_KW = ['drive','shinkensen','trip to','off to']

def _has(al, kw):
    kw = kw.strip()
    if re.search(r'[\s-]', kw):
        return kw in al
    return re.search(r'\b' + re.escape(kw) + r'\b', al) is not None

def classify(days):
    for day in days:
        for e in day["events"]:
            al = e["activity"].lower()
            if 'flight' in al:                       t = 'flight'
            elif any(_has(al, k) for k in STAY_KW):  t = 'stay'
            elif any(_has(al, k) for k in FOOD_KW):  t = 'meal'
            elif any(_has(al, k) for k in BAR_KW):   t = 'bar'
            elif any(_has(al, k) for k in SHOP_KW):  t = 'shopping'
            elif any(_has(al, k) for k in DRIVE_KW): t = 'drive'
            else:                                    t = 'activity'
            e["type"] = t
    return days


# ---------------------------------------------------------------- schedule
TIME_ONLY = re.compile(r'^~?(\d{1,2}):(\d{2})(:\d{2})?$')
TIME_ANY  = re.compile(r'(\d{1,2}):(\d{2})')

def _pmin(s, strict=False):
    if not s: return None
    m = TIME_ONLY.match(s.strip()) if strict else TIME_ANY.search(s)
    if not m: return None
    h, mi = int(m.group(1)), int(m.group(2))
    return (h % 24) * 60 + mi if 0 <= h <= 27 and 0 <= mi < 60 else None

def _r15(m): return round(m / 15) * 15
def _fmt(m):
    m = max(0, min(23 * 60 + 59, round(m)))
    return f"{m//60:02d}:{m%60:02d}"

KEYWORD_DURATION = [
    (re.compile(r'\bflight\b', re.I), 0),
    (re.compile(r'universal studios|theme park', re.I), 480),
    (re.compile(r'workshop', re.I), 90),
    (re.compile(r'\b(museum|gallery|design sight|teamlab|team lab)\b', re.I), 105),
    (re.compile(r'\b(garden|park|botanical)\b', re.I), 60),
    (re.compile(r'\b(market|flea market)\b', re.I), 60),
    (re.compile(r'\bcastle\b', re.I), 75),
    (re.compile(r'\b(shrine|temple|taisha|jingu|jinja|dera)\b', re.I), 80),
    (re.compile(r'-ji\b', re.I), 80),
    (re.compile(r'\bropeway|cable car\b', re.I), 45),
    (re.compile(r'\bdinner\b', re.I), 90),
    (re.compile(r'\blunch\b', re.I), 75),
    (re.compile(r'\bbar\b', re.I), 90),
    (re.compile(r'\b(breakfast|coffee|matcha|tea|cafe)\b', re.I), 40),
    (re.compile(r'\b(sweet|dessert|snack|bakery)\b', re.I), 40),
    (re.compile(r'\b(shopping|buy|buying|store|shop)\b', re.I), 45),
    (re.compile(r'\bstroll', re.I), 60),
    (re.compile(r'\b(hotel|check-?in)\b', re.I), 30),
    (re.compile(r'\barriving\b', re.I), 30),
    (re.compile(r'\b(relaxing|free time|free morning|spontaneous)\b', re.I), 60),
]
FLOORS = [
    (re.compile(r'\bdinner\b', re.I), 18 * 60),
    (re.compile(r'\blunch\b', re.I), 11 * 60 + 30),
    (re.compile(r'\bbreakfast\b', re.I), 7 * 60),
    (re.compile(r'\bbar\b', re.I), 19 * 60 + 30),
]
TRANSITION_BUFFER = 15
DAY_START = 9 * 60

def _duration(date, activity):
    if (date, activity) in SPECIFIC_DURATION:
        return SPECIFIC_DURATION[(date, activity)]
    for rx, dur in KEYWORD_DURATION:
        if rx.search(activity):
            return dur
    return 60

def schedule(days):
    for day in days:
        clock = None
        for e in day["events"]:
            hard = _pmin(e.get("from", ""))
            if hard is None:
                hard = _pmin(e.get("to", ""), strict=True)
            if hard is not None:
                start, e["estTime"] = hard, False
            else:
                pre = SPECIFIC_PRE_BUFFER.get((day["date"], e["activity"]), TRANSITION_BUFFER)
                start = DAY_START if clock is None else clock + pre
                for rx, floor in FLOORS:
                    if rx.search(e["activity"]) and start < floor:
                        start = floor
                start = _r15(start)
                e["estTime"] = True
            e["from"] = _fmt(start)
            clock = start + _duration(day["date"], e["activity"])

    # a later row with an explicit earlier time must not appear out of order
    for day in days:
        ev = day["events"]
        for i in range(len(ev) - 2, -1, -1):
            if not ev[i]["estTime"]:
                continue
            cur, nxt = _pmin(ev[i]["from"]), _pmin(ev[i + 1]["from"])
            if cur > nxt - 15:
                ev[i]["from"] = _fmt(max(0, nxt - 15))

    # "same as X's dinner" rows share one time
    for day in days:
        ev = day["events"]
        for i, e in enumerate(ev):
            tof = (e.get("to") or "").lower()
            if "same as" not in tof:
                continue
            ref = tof.replace("same as", "").strip(" .:-'\u2019")
            j = next((k for k, o in enumerate(ev) if k != i and ref and (
                ref[:12] in o["activity"].lower()
                or o["activity"].lower().split(" - ")[0] in ref
                or any(w in o["activity"].lower() for w in ref.split() if len(w) > 3))), None)
            if j is None:
                continue
            a, b = _pmin(ev[i]["from"]), _pmin(ev[j]["from"])
            if a is None or b is None or a == b:
                continue
            if not ev[i]["estTime"] and ev[j]["estTime"]:
                ev[j]["from"], ev[j]["estTime"] = ev[i]["from"], False
            elif ev[i]["estTime"] and not ev[j]["estTime"]:
                ev[i]["from"], ev[i]["estTime"] = ev[j]["from"], False
            else:
                mid = _fmt(_r15((a + b) / 2))
                ev[i]["from"] = ev[j]["from"] = mid
    return days


# ---------------------------------------------------------------- geo + descriptions
SYN = [(re.compile(r'\b' + w + r'\b'), 'shrine')
       for w in ('jinja', 'jingu', 'taisha', 'temple', 'dera')]

def _norm(s):
    s = s.lower()
    s = re.sub(r'[^a-z0-9\s\-]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    for rx, rep in SYN:
        s = rx.sub(rep, s)
    return s

def _dkey(s):
    s = s.lower().replace('\u200f', '').replace('\u200e', '')
    s = re.sub(r'\s+', ' ', s)
    return re.sub(r'[^a-z0-9\u3000-\u9fff ]', '', s).strip()

def enrich(days, places):
    idx = sorted(((_norm(p["name"]), p) for p in places if len(p["name"]) >= 3),
                 key=lambda x: -len(x[0]))
    dn = {_dkey(k): v for k, v in DESC.items()}

    geo_hits = desc_hits = 0
    missing_desc = []
    for day in days:
        for e in day["events"]:
            a = _norm(e["activity"])
            best, blen = None, 0
            for kn, p in idx:
                if len(kn) >= 6 and (kn in a or a in kn) and len(kn) > blen:
                    best, blen = p, len(kn)
            if best:
                e["geo"] = {"lat": round(best["lat"], 5), "lon": round(best["lon"], 5)}
                if best.get("desc"):
                    e["tip"] = best["desc"]
            elif e["activity"] in MANUAL_GEO:
                lat, lon, note = MANUAL_GEO[e["activity"]]
                e["geo"] = {"lat": round(lat, 5), "lon": round(lon, 5)}
                if note:
                    e["tip"] = note
            if "geo" in e:
                geo_hits += 1

            k = _dkey(e["activity"])
            d = dn.get(k)
            if d is None:
                cands = [v for kk, v in dn.items() if kk[:40] == k[:40]]
                if len(cands) == 1:
                    d = cands[0]
            if d:
                e["desc"] = d
                desc_hits += 1
            else:
                missing_desc.append(e["activity"])

            tip = e.get("tip")
            if tip and (len(tip) < 22 or tip.lower() in (e.get("desc") or "").lower()):
                del e["tip"]

    total = sum(len(d["events"]) for d in days)
    print(f"  geo matched:  {geo_hits}/{total}")
    print(f"  descriptions: {desc_hits}/{total}")
    if missing_desc:
        print(f"  NOTE: {len(set(missing_desc))} row(s) have no description "
              f"(new or renamed in the sheet):")
        for m in sorted(set(missing_desc))[:12]:
            print(f"    - {m[:70]}")
    return days


# ---------------------------------------------------------------- render
def render(days, places):
    css = (ROOT / "style.css").read_text(encoding="utf-8")
    js = (ROOT / "app.js").read_text(encoding="utf-8")
    shell = (ROOT / "shell.html").read_text(encoding="utf-8")
    leaflet_css = (ROOT / "leaflet.css").read_text(encoding="utf-8")
    leaflet_js = (ROOT / "leaflet.js").read_text(encoding="utf-8")

    slim = [{"name": p["name"], "desc": p["desc"],
             "lat": round(p["lat"], 5), "lon": round(p["lon"], 5),
             "cat": p["cat"]} for p in places]

    out = (shell
        .replace("/*LEAFLET_CSS*/", leaflet_css)
        .replace("/*APP_CSS*/", css)
        .replace("/*LEAFLET_JS*/", leaflet_js)
        .replace("/*APP_JS*/", js)
        .replace("__DATA__", json.dumps(days, ensure_ascii=False))
        .replace("__PLACES__", json.dumps(slim, ensure_ascii=False))
        .replace("__EMBED_URL__", f"https://www.google.com/maps/d/embed?mid={MY_MAPS_MID}")
        .replace("__FULL_URL__", f"https://www.google.com/maps/d/viewer?mid={MY_MAPS_MID}&usp=sharing"))

    (ROOT / "index.html").write_text(out, encoding="utf-8")
    return len(out)


def main():
    days = parse_csv(get_csv_text())
    print(f"Parsed {len(days)} days, {sum(len(d['events']) for d in days)} events")
    days = schedule(classify(translate(days)))
    places = json.loads((ROOT / "my_maps_places.json").read_text(encoding="utf-8"))
    days = enrich(days, places)
    size = render(days, places)
    print(f"Wrote index.html ({size:,} bytes)")


if __name__ == "__main__":
    main()

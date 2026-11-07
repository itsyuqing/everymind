from __future__ import annotations

import argparse
import json
import math
import re
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

try:
    from scipy import stats
except ImportError:
    stats = None

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "config"

KNOWLEDGE_ITEMS = [
    ("identify", "I can identify mental health challenges and crises"),
    ("describe", "I can describe 988 and how it works"),
    ("when", "I know when to use 988"),
]
DELIVERY_ITEMS = [
    ("pres_engaged", "Presenter(s) engaged participants"),
    ("pres_knowledge", "Presenter(s) knew the subject well"),
    ("organized", "Training was well organized"),
]
ROLES = ["Student", "School staff", "Caregiver/parent", "Community member"]


def load_json(name: str) -> dict:
    with open(CONFIG / name, encoding="utf-8") as f:
        return json.load(f)


def norm_text(x) -> str:
    """Lowercase, strip, and remove invisible characters (non-breaking spaces,
    left-to-right marks) that Microsoft Forms adds to some answers."""
    if pd.isna(x):
        return ""
    s = str(x).replace("\xa0", " ").replace("‎", "").replace("‏", "")
    s = s.replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", s).strip().lower()


class QualityLog:
    """Collects every cleaning decision so staff can see exactly what changed."""

    def __init__(self):
        self.rows = []

    def add(self, step: str, detail: str, count: int):
        if count:
            self.rows.append({"step": step, "detail": detail, "rows_affected": int(count)})

    def frame(self) -> pd.DataFrame:
        return pd.DataFrame(self.rows, columns=["step", "detail", "rows_affected"])


def find_columns(df: pd.DataFrame, patterns: dict) -> dict:
    """Match each field to a column by keywords in its header, so the pipeline keeps
    working if Microsoft Forms reorders columns or slightly rewords a question."""
    headers = {c: norm_text(c) for c in df.columns}
    found = {}
    for key, options in patterns.items():
        for words in options:
            if key == "id":
                hit = [c for c, h in headers.items() if h == "id"]
            else:
                hit = [c for c, h in headers.items() if all(w in h for w in words)]
            if hit:
                found[key] = hit[0]
                break
    return found


def load_exports(paths: list[Path], settings: dict, log: QualityLog) -> pd.DataFrame:
    frames = []
    for p in paths:
        raw = pd.read_excel(p) if p.suffix.lower() in (".xlsx", ".xls") else pd.read_csv(p)
        cols = find_columns(raw, settings["column_patterns"])
        missing = [k for k in settings["column_patterns"] if k not in cols]
        required = {"post_identify", "post_describe", "post_when", "county", "training_date"}
        if required & set(missing):
            sys.exit(f"ERROR: {p.name} is missing required questions: {sorted(required & set(missing))}")
        if missing:
            log.add("Load", f"{p.name}: optional questions not found ({', '.join(missing)}); left blank", len(raw))
        out = pd.DataFrame({k: raw[v] for k, v in cols.items()})
        for k in missing:
            out[k] = np.nan
        out["source_file"] = p.name
        frames.append(out)
        log.add("Load", f"Read {p.name}", len(raw))
    df = pd.concat(frames, ignore_index=True)

    before = len(df)
    df = df.drop_duplicates(subset=["id", "start_time"], keep="last")
    log.add("Load", "Removed duplicate submissions (same ID + start time) from overlapping exports", before - len(df))

    answer_cols = [c for c in df.columns if c.startswith(("post_", "pre_"))] + ["recommend"]
    empty = df[answer_cols].isna().all(axis=1)
    log.add("Load", "Removed submissions with no answers", empty.sum())
    return df[~empty].reset_index(drop=True)


def clean(df: pd.DataFrame, settings: dict, counties: dict, log: QualityLog) -> pd.DataFrame:
    lik = settings["likert_map"]
    nonstd = set(settings["nonstandard_likert_labels"])

    for key in ["post_identify", "post_describe", "post_when", "pre_identify", "pre_describe",
                "pre_when", "pres_engaged", "pres_knowledge", "organized"]:
        t = df[key].map(norm_text)
        had_ws = df[key].dropna().astype(str).map(lambda s: s != s.strip() or "\xa0" in s).sum()
        log.add("Answer labels", f"{key}: removed stray/invisible spaces (e.g. 'Strongly agree\\xa0')", had_ws)
        for lab in nonstd:
            log.add("Answer labels", f"{key}: non-standard label '{lab}' mapped to {lik[lab]}", (t == lab).sum())
        unknown = t[(t != "") & ~t.isin(lik.keys())]
        if len(unknown):
            log.add("Answer labels", f"{key}: unrecognized labels left blank: {sorted(unknown.unique())[:5]}", len(unknown))
        df[key] = t.map(lik).astype("float")

    for key in ["recommend", "call988"]:
        v = pd.to_numeric(df[key], errors="coerce")
        bad = v.notna() & ~v.between(0, 10)
        log.add("0-10 scales", f"{key}: values outside 0-10 set to blank", bad.sum())
        df[key] = v.where(~bad)
    log.add("0-10 scales", "call988 not asked on most survey versions (blank, not zero)", df["call988"].isna().sum())

    lang = df["language"].map(norm_text)
    df["language"] = np.where(lang.str.startswith(("espa", "spanish")), "Spanish",
                              np.where(lang.str.startswith("eng") | (lang == ""), "English", lang.str.title()))

    rmap = settings["role_map"]
    parts = df["role"].map(norm_text).map(lambda s: [p.strip() for p in s.split(";") if p.strip()])
    for r in ROLES:
        df[f"role_{r}"] = parts.map(lambda ps, r=r: any(rmap.get(p) == r for p in ps))
    unknown_roles = parts.map(lambda ps: [p for p in ps if p not in rmap]).map(len).gt(0)
    log.add("Roles", "Unrecognized role text (kept, but not in a role group)", unknown_roles.sum())
    n_roles = df[[f"role_{r}" for r in ROLES]].sum(axis=1)
    df["role_group"] = np.select(
        [n_roles == 0, n_roles > 1],
        ["Not answered", "Multiple roles"],
        default=df[[f"role_{r}" for r in ROLES]].idxmax(axis=1).str.replace("role_", ""),
    )
    log.add("Roles", "Selected more than one role (counted in each role filter, 'Multiple roles' in comparisons)", (n_roles > 1).sum())
    log.add("Roles", "Trailing ';' removed from single-role answers", df["role"].astype(str).str.strip().str.endswith(";").sum())

    md = counties["maryland_jurisdictions"]
    alias = {**{norm_text(c).replace("'", "").replace(".", ""): c for c in md},
             **{k: v for k, v in counties["aliases"].items()}}

    def county_clean(x):
        s = norm_text(x)
        s = re.split(r"\s+with\s+|\s*\(|,", s)[0]
        s = re.sub(r"\bcounty\b", "", s).replace("'", "").replace(".", "").strip()
        if not s:
            return "Not answered"
        return alias.get(s, "Other / unclear")

    raw_c = df["county"].map(norm_text)
    df["county"] = df["county"].map(county_clean)
    distinct_raw = raw_c.nunique()
    log.add("Counties", f"{distinct_raw} raw spellings standardized to {df['county'].nunique()} county names", len(df))
    other = df["county"] == "Other / unclear"
    log.add("Counties", f"Not a recognizable county (e.g. {sorted(raw_c[other].unique())[:3]})", other.sum())
    df["in_maryland"] = df["county"].isin(md)
    log.add("Counties", "Outside Maryland (e.g. Fairfax, VA) - kept, flagged", (~df["in_maryland"] & ~other & (df["county"] != "Not answered")).sum())

    start = pd.to_datetime(df["start_time"], errors="coerce")
    end = pd.to_datetime(df["end_time"], errors="coerce")
    td = pd.to_datetime(df["training_date"], errors="coerce")
    miss = td.isna()
    df["training_date"] = td.fillna(start.dt.normalize())
    log.add("Dates", "Training date missing - filled with survey submission date", miss.sum())
    future = df["training_date"] > (end.dt.normalize() + pd.Timedelta(days=1))
    log.add("Dates", "Training date after survey submission (possible typo) - kept, flagged", future.sum())
    df["date_flag"] = future
    df["month"] = df["training_date"].dt.to_period("M").astype(str)
    q = df["training_date"].dt.quarter.astype(str)
    df["quarter"] = df["training_date"].dt.year.astype(str) + " Q" + q
    df["session"] = df["training_date"].dt.strftime("%Y-%m-%d") + " | " + df["county"]

    df["seconds"] = (end - start).dt.total_seconds()
    df["flag_speeder"] = df["seconds"] < settings["speeder_seconds"]
    log.add("Response quality", f"Finished in under {settings['speeder_seconds']} seconds (flagged only)", df["flag_speeder"].sum())

    post = df[["post_identify", "post_describe", "post_when"]]
    all_sd = post.eq(1).all(axis=1)
    df["flag_reversed"] = all_sd & (df["recommend"] >= 7)
    log.add("Response quality",
            "Likely reversed scale: 'Strongly disagree' on all 3 post-training items but rated the training 7-10 "
            "(excluded from knowledge results by default; toggle in dashboard)", df["flag_reversed"].sum())
    log.add("Response quality", "'Strongly disagree' on all 3 post items and recommend 0-6 or blank (kept as genuine)",
            (all_sd & ~df["flag_reversed"]).sum())

    for key in ["valuable", "improve"]:
        s = df[key].astype("string").str.replace("\xa0", " ").str.strip()
        df[key] = s.where(s.str.len() > 0)
    return df


QUESTION_RE = re.compile(r"\?|^\s*(how|what|why|when|where|who|which|is|are|can|could|do|does|did|will|would|should)\b", re.I)


def code_themes(df: pd.DataFrame, themes: dict, log: QualityLog) -> pd.DataFrame:
    for field, book in themes.items():
        if field.startswith("_"):
            continue
        compiled = {name: [re.compile(p, re.I) for p in pats] for name, pats in book.items()}
        text = df[field].fillna("").map(norm_text)

        def code(t):
            if not t:
                return []
            return [name for name, pats in compiled.items() if any(p.search(t) for p in pats)]

        codes = text.map(code)
        if field == "improve":
            codes = codes.map(lambda c: [x for x in c if x != "Unsure / no answer"]
                              if "No change needed / praise" in c and len(c) > 1 else c)
        df[f"{field}_themes"] = codes.map(lambda c: "; ".join(c))
        answered = text.str.len() > 0
        uncoded = answered & codes.map(len).eq(0)
        log.add("Comment themes", f"'{field}' comments not matched by any theme (shown as 'Other')", uncoded.sum())
    df["improve_is_question"] = df["improve"].fillna("").map(lambda t: bool(t) and bool(QUESTION_RE.search(t)))
    return df


def pct(x):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(100 * x, 1)


def wilson(k, n, z=1.96):
    if n == 0:
        return (None, None)
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    m = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (round(100 * (c - m) / d, 1), round(100 * (c + m) / d, 1))


def summarize(g: pd.DataFrame, settings: dict) -> dict:
    a = settings["agree_threshold"]
    out = {"responses": len(g), "sessions": g["session"].nunique()}
    for k, _ in KNOWLEDGE_ITEMS:
        pair = g[[f"pre_{k}", f"post_{k}"]].dropna()
        n = len(pair)
        out[f"{k}_n"] = n
        out[f"{k}_pre_pct"] = pct((pair[f"pre_{k}"] >= a).mean()) if n else None
        out[f"{k}_post_pct"] = pct((pair[f"post_{k}"] >= a).mean()) if n else None
        out[f"{k}_gain_pts"] = round(out[f"{k}_post_pct"] - out[f"{k}_pre_pct"], 1) if n else None
        out[f"{k}_mean_change"] = round((pair[f"post_{k}"] - pair[f"pre_{k}"]).mean(), 2) if n else None
        lo, hi = wilson(int((pair[f"post_{k}"] >= a).sum()), n)
        out[f"{k}_post_ci"] = f"{lo}-{hi}" if n else None
    for k, _ in DELIVERY_ITEMS:
        v = g[k].dropna()
        out[f"{k}_pct_agree"] = pct((v >= a).mean()) if len(v) else None
        out[f"{k}_n"] = len(v)
    r = g["recommend"].dropna()
    out["recommend_n"] = len(r)
    out["nps"] = round(100 * ((r >= settings["promoter_min"]).mean() - (r <= settings["detractor_max"]).mean()), 1) if len(r) else None
    out["recommend_mean"] = round(r.mean(), 2) if len(r) else None
    c = g["call988"].dropna()
    out["call988_n"] = len(c)
    out["call988_pct_9_10"] = pct((c >= 9).mean()) if len(c) else None
    out["call988_mean"] = round(c.mean(), 2) if len(c) else None
    return out


def group_table(df, col, settings, label=None):
    rows = []
    for key, g in df.groupby(col, dropna=False):
        s = summarize(g, settings)
        s = {label or col: key, **s}
        n = s["responses"]
        s["sample_note"] = ("Hidden: fewer than %d responses" % settings["small_group_hide_n"] if n < settings["small_group_hide_n"]
                            else "Small sample - interpret with caution" if n < settings["small_group_warn_n"] else "")
        rows.append(s)
    t = pd.DataFrame(rows)
    t = t.sort_values(label or col) if col in ("quarter", "month", "session") else t.sort_values("responses", ascending=False)
    metric_cols = [c for c in t.columns if c not in (label or col, "responses", "sessions", "sample_note")]
    t.loc[t["responses"] < settings["small_group_hide_n"], metric_cols] = None
    return t


def significance_tests(df: pd.DataFrame, settings: dict) -> pd.DataFrame:
    if stats is None:
        return pd.DataFrame([{"test": "scipy not installed - tests skipped"}])
    rows = []
    for k, label in KNOWLEDGE_ITEMS:
        pair = df[[f"pre_{k}", f"post_{k}"]].dropna()
        diff = pair[f"post_{k}"] - pair[f"pre_{k}"]
        w = stats.wilcoxon(pair[f"post_{k}"], pair[f"pre_{k}"], zero_method="wilcox")
        rows.append({"test": "Wilcoxon signed-rank (post vs. retrospective pre)", "item": label, "n": len(pair),
                    "share_improved_%": pct((diff > 0).mean()), "share_same_%": pct((diff == 0).mean()),
                    "share_lower_after_%": pct((diff < 0).mean()), "p_value": f"{w.pvalue:.2e}"})
    big = df["county"].value_counts()
    keep = big[big >= settings["small_group_warn_n"]].index
    sub = df[df["county"].isin(keep)].copy()
    for k, label in KNOWLEDGE_ITEMS:
        sub[f"gain_{k}"] = sub[f"post_{k}"] - sub[f"pre_{k}"]
        groups = [g[f"gain_{k}"].dropna() for _, g in sub.groupby("county")]
        if len(groups) >= 2:
            h = stats.kruskal(*groups)
            rows.append({"test": f"Kruskal-Wallis: change score differs by county (counties with n>={settings['small_group_warn_n']}: {', '.join(keep)})",
                        "item": label, "n": int(sum(len(x) for x in groups)), "p_value": f"{h.pvalue:.2e}"})
        groups = [g[f"post_{k}"].dropna() for _, g in sub.groupby("county")]
        if len(groups) >= 2:
            h = stats.kruskal(*groups)
            rows.append({"test": "Kruskal-Wallis: post-training rating differs by county", "item": label,
                        "n": int(sum(len(x) for x in groups)), "p_value": f"{h.pvalue:.2e}"})
    rg = df[df["role_group"].isin(ROLES)]
    rg_counts = rg["role_group"].value_counts()
    rg = rg[rg["role_group"].isin(rg_counts[rg_counts >= settings["small_group_warn_n"]].index)]
    for k, label in KNOWLEDGE_ITEMS:
        groups = [g[f"post_{k}"].dropna() for _, g in rg.groupby("role_group")]
        if len(groups) >= 2:
            h = stats.kruskal(*groups)
            rows.append({"test": "Kruskal-Wallis: post-training rating differs by role (single-role respondents, n>=30)",
                        "item": label, "n": int(sum(len(x) for x in groups)), "p_value": f"{h.pvalue:.2e}"})
    return pd.DataFrame(rows)


def theme_table(df, field):
    s = df[f"{field}_themes"]
    answered = df[field].notna()
    exploded = s[answered].map(lambda x: x.split("; ") if x else ["Other"]).explode()
    t = exploded.value_counts().rename_axis("theme").reset_index(name="comments")
    t["pct_of_comments"] = (100 * t["comments"] / answered.sum()).round(1)
    t.attrs["n"] = int(answered.sum())
    return t


def write_workbook(df, settings, log, path):
    with pd.ExcelWriter(path, engine="openpyxl") as xw:
        about = pd.DataFrame({
            "EveryMind 988 Training Feedback - Summary": [
                f"Generated {datetime.now():%Y-%m-%d %H:%M} from {', '.join(sorted(df['source_file'].unique()))}",
                f"Responses: {len(df)}  |  Training sessions (date + county): {df['session'].nunique()}  |  "
                f"Training dates {df['training_date'].min():%Y-%m-%d} to {df['training_date'].max():%Y-%m-%d}",
                "'% agree' = Agree or Strongly agree. 'Gain' = post % agree minus retrospective-before % agree, same respondents.",
                "Before-training ratings were collected AFTER the training ('think back...'), so gains may be overstated.",
                f"Knowledge results exclude {int(df['flag_reversed'].sum())} likely reversed-scale responses (see Data quality).",
                f"Groups with fewer than {settings['small_group_hide_n']} responses are hidden; under {settings['small_group_warn_n']} are marked small.",
                "NPS = % rating 9-10 minus % rating 0-6 on 'How likely to recommend'.",
                "'Call 988' was only asked on some survey versions; its n is reported separately.",
            ]})
        about.to_excel(xw, sheet_name="About", index=False)
        k = df[~df["flag_reversed"]]
        pd.DataFrame([summarize(k, settings)]).T.rename(columns={0: "value"}).to_excel(xw, sheet_name="Overall")
        group_table(k, "county", settings).to_excel(xw, sheet_name="By county", index=False)
        group_table(k, "role_group", settings, "role").to_excel(xw, sheet_name="By role", index=False)
        group_table(k, "language", settings).to_excel(xw, sheet_name="By language", index=False)
        group_table(k, "quarter", settings).to_excel(xw, sheet_name="By quarter", index=False)
        st = group_table(k, "session", settings)
        st.to_excel(xw, sheet_name="By session", index=False)
        significance_tests(k, settings).to_excel(xw, sheet_name="Statistical tests", index=False)
        theme_table(df, "valuable").to_excel(xw, sheet_name="Themes - most valuable", index=False)
        theme_table(df, "improve").to_excel(xw, sheet_name="Themes - improve", index=False)
        log.frame().to_excel(xw, sheet_name="Data quality", index=False)
        for ws in xw.book.worksheets:
            for col in ws.columns:
                width = max(len(str(c.value)) if c.value is not None else 0 for c in col[:60])
                ws.column_dimensions[col[0].column_letter].width = min(max(10, width + 2), 70)


def dashboard_payload(df, settings, themes, log):
    """Compact, row-level data for client-side filtering. Free-text comments are NOT
    embedded (privacy) - only their theme codes."""
    vt = list(themes["valuable"].keys()) + ["Other"]
    it = list(themes["improve"].keys()) + ["Other"]
    counties = sorted(df["county"].unique())
    roles = ["Student", "School staff", "Caregiver/parent", "Community member", "Multiple roles", "Not answered"]

    def idx(lst, codes, answered):
        if not answered:
            return []
        c = codes.split("; ") if codes else ["Other"]
        return [lst.index(x) for x in c]

    def nz(v):
        return None if pd.isna(v) else int(v)

    rows = []
    for _, r in df.iterrows():
        rows.append([
            r["training_date"].strftime("%Y-%m-%d"),
            counties.index(r["county"]),
            1 if r["language"] == "Spanish" else 0,
            sum(1 << i for i, ro in enumerate(ROLES) if r[f"role_{ro}"]),
            roles.index(r["role_group"]),
            [nz(r[f"pre_{k}"]) for k, _ in KNOWLEDGE_ITEMS],
            [nz(r[f"post_{k}"]) for k, _ in KNOWLEDGE_ITEMS],
            [nz(r[k]) for k, _ in DELIVERY_ITEMS],
            nz(r["recommend"]), nz(r["call988"]),
            idx(vt, r["valuable_themes"], pd.notna(r["valuable"])),
            idx(it, r["improve_themes"], pd.notna(r["improve"])),
            1 if r["improve_is_question"] else 0,
            1 if r["flag_reversed"] else 0,
            1 if r["flag_speeder"] else 0,
        ])
    return {
        "generated": f"{datetime.now():%Y-%m-%d %H:%M}",
        "sources": sorted(df["source_file"].unique().tolist()),
        "settings": {k: settings[k] for k in ["small_group_warn_n", "small_group_hide_n", "agree_threshold", "promoter_min", "detractor_max"]},
        "counties": counties,
        "maryland": [c for c in counties if c in load_json("counties.json")["maryland_jurisdictions"]],
        "roles": ROLES,
        "roleGroups": roles,
        "knowledge": [l for _, l in KNOWLEDGE_ITEMS],
        "delivery": [l for _, l in DELIVERY_ITEMS],
        "valuableThemes": vt,
        "improveThemes": it,
        "quality": log.frame().to_dict(orient="records"),
        "rows": rows,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+", type=Path, help="One or more survey export files (.xlsx or .csv)")
    ap.add_argument("--out", type=Path, default=ROOT / "output", help="Output folder (default: output/)")
    args = ap.parse_args(argv)

    settings, counties, themes = load_json("settings.json"), load_json("counties.json"), load_json("themes.json")
    log = QualityLog()
    df = load_exports(args.inputs, settings, log)
    df = clean(df, settings, counties, log)
    df = code_themes(df, themes, log)

    args.out.mkdir(parents=True, exist_ok=True)
    keep_cols = ["id", "source_file", "training_date", "month", "quarter", "session", "county", "in_maryland",
                "language", "role_group"] + [f"role_{r}" for r in ROLES] + \
                [f"{p}_{k}" for p in ("pre", "post") for k, _ in KNOWLEDGE_ITEMS] + \
                [k for k, _ in DELIVERY_ITEMS] + ["recommend", "call988", "valuable", "valuable_themes", "improve",
                                                  "improve_themes", "improve_is_question", "seconds", "flag_speeder",
                                                  "flag_reversed", "date_flag"]
    out = df[keep_cols].copy()
    out["training_date"] = out["training_date"].dt.strftime("%Y-%m-%d")
    out.to_csv(args.out / "cleaned_responses.csv", index=False, encoding="utf-8-sig")
    log.frame().to_csv(args.out / "data_quality_report.csv", index=False)
    write_workbook(df, settings, log, args.out / "summary_tables.xlsx")

    payload = dashboard_payload(df, settings, themes, log)
    template = (ROOT / "dashboard_template.html").read_text(encoding="utf-8")
    html = template.replace("/*__DATA__*/null", json.dumps(payload, separators=(",", ":")))
    (args.out / "dashboard.html").write_text(html, encoding="utf-8")
    (args.out / "dashboard_data.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")

    k = df[~df["flag_reversed"]]
    s = summarize(k, settings)
    print(f"Processed {len(df)} responses from {len(args.inputs)} file(s); {df['session'].nunique()} sessions.")
    print(f"  Know when to use 988: {s['when_pre_pct']}% before -> {s['when_post_pct']}% after (n={s['when_n']})")
    print(f"  Can describe 988:     {s['describe_pre_pct']}% before -> {s['describe_post_pct']}% after")
    print(f"  NPS: {s['nps']} (n={s['recommend_n']})  |  Call-988 very likely (9-10): {s['call988_pct_9_10']}% (n={s['call988_n']})")
    print(f"Outputs written to {args.out}/: dashboard.html, dashboard_data.json, summary_tables.xlsx, cleaned_responses.csv, data_quality_report.csv")


if __name__ == "__main__":
    main()
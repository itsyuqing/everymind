"""Simulates a future data update and checks the pipeline still runs correctly.
Run:  python tests/test_update.py"""
import subprocess, sys, tempfile
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
raw = pd.read_excel(ROOT / "data" / "survey_raw.xlsx")

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    new = raw.sample(60, random_state=1).copy()
    new["Id"] = new["Id"] + 100000
    county_col = [c for c in new.columns if "county" in c.lower()][0]
    new.iloc[:5, new.columns.get_loc(county_col)] = "  howard county "
    new.iloc[5:8, new.columns.get_loc(county_col)] = "PG"
    post_col = [c for c in new.columns if "statements" in c and "when to use" in c][0]
    new.iloc[8, new.columns.get_loc(post_col)] = "Totalmente de acuerdo"
    blank = new.iloc[[0]].copy().astype(object)
    for c in blank.columns[7:]: blank[c] = None
    blank["Id"] = 999999
    overlap = raw.head(25)
    update = pd.concat([new, blank, overlap]).sample(frac=1, random_state=2)
    update = update[list(reversed(update.columns))]  # reorder every column
    update.to_excel(tmp / "november_export.xlsx", index=False)

    out = tmp / "out"
    r = subprocess.run([sys.executable, str(ROOT / "run_pipeline.py"), str(ROOT / "data" / "survey_raw.xlsx"),
                        str(tmp / "november_export.xlsx"), "--out", str(out)], capture_output=True, text=True)
    print(r.stdout, r.stderr)
    assert r.returncode == 0, "pipeline failed"
    clean = pd.read_csv(out / "cleaned_responses.csv")
    assert len(clean) == len(raw) + 60, f"expected {len(raw)+60} rows (duplicates and blank removed), got {len(clean)}"
    assert (clean["county"] == "Howard").sum() == 5, "new county spelling not standardized"
    assert clean.loc[clean["id"] == new.iloc[8]["Id"], "post_when"].iloc[0] == 5, "Spanish label not mapped"
    assert (out / "dashboard.html").stat().st_size > 50000
    print("ALL CHECKS PASSED: reordered columns, new county spelling, Spanish label, duplicates and blank rows handled.")
# 988 Training Insights — Technical Artifact

A repeatable pipeline that turns EveryMind's raw "Understanding 988" post-training survey
export (Microsoft Forms → Excel) into a dashboard, summary tables and clean data.

| Output (in `output/`) | What it is | Who uses it |
|---|---|---|
| `dashboard.html` | Interactive dashboard: filters for date, county, role and language; before/after learning; knowing-vs-intending gap; group comparisons with small-sample warnings; trends; comment themes; data-quality log | Program staff, leadership |
| `summary_tables.xlsx` | Ready-to-paste tables by county, role, language, quarter and session, plus statistical tests and theme counts | Grant writers, reporting |
| `cleaned_responses.csv` | One clean row per response with standardized fields, theme codes and quality flags | Analysts |
| `data_quality_report.csv` | Every cleaning decision and how many rows it affected | Anyone checking the numbers |
| `dashboard_data.json` | The same data, read by the React app in `frontend/` | The React app |

## Two ways to view the dashboard
- **React app** (`frontend/`): React + TypeScript + Tailwind + Vite, with an overview, session explorer, county map and filter panel. See `frontend/README.md`. `npm run build` creates one file, `frontend/dist/index.html`, which opens by double-click.
- **Lightweight HTML** (`output/dashboard.html`): generated directly by the Python pipeline, with no Node needed.

## Quick start — view the results (no install)
Open **`output/dashboard.html`** (or the built React app, `frontend/dist/index.html`) in any web browser. It works offline.

## Run it on new survey data

### Option A: On a computer with Python 3.9+
```bash
python -m pip install pandas numpy openpyxl scipy     # one time
python run_pipeline.py data/survey_raw.xlsx
```
Combine several exports (overlapping rows are removed automatically):
```bash
python run_pipeline.py data/survey_raw.xlsx data/november_export.xlsx
```
Takes about 5 seconds. Output goes to `output/` (or use `--out other_folder`).

### Option B: Google Colab (no install)
1. Zip only `run_pipeline.py`, `dashboard_template.html` and the `config` folder (not the whole project).
2. Go to colab.research.google.com → **File → Upload notebook** → `Run_in_Colab.ipynb`.
3. Click **Runtime → Run all**. Upload the zip when the first cell asks, then the Forms Excel export when the second cell asks.
4. `dashboard.html` and `summary_tables.xlsx` download automatically.

### Updating the React app
After running the pipeline: `cd frontend` → `npm run build`. See `frontend/README.md` for first-time setup.

## Built to handle data updates
- **Columns are found by keywords in the question text,** not by position, so reordered or slightly reworded Forms columns still work. If a required question is missing, the script stops with a clear message.
- **New county spellings** ("PG", "Howard County ") are standardized automatically. Unrecognized ones show up as "Other / unclear" in the data-quality log; add them to `config/counties.json`.
- **Answer labels** are cleaned of invisible characters. Non-standard labels ("Very agree", "Satisfied") and Spanish labels are mapped in `config/settings.json`.
- **Duplicates** across overlapping exports and fully blank submissions are removed and logged.
- **Comment themes** are keyword rules in `config/themes.json`. Staff can add a theme or keyword without touching code.
- `python tests/test_update.py` simulates a messy next-month export (shuffled columns, new spellings, duplicates, a blank row, a Spanish label) and checks the results.

## Key definitions
- **% agree** = "Agree" or "Strongly agree".
- **Gain** = % agree after − % agree before, using the same respondents. "Before" is retrospective: it was asked after the training.
- **NPS** = % rating 9–10 minus % rating 0–6 on "likely to recommend" (range −100 to +100).
- **Very likely to call 988** = rating 9–10. This question was only on some survey versions (n = 290).
- **Session** = one training date in one county.
- **Small groups:** under 30 responses are marked "small sample"; under 10 are hidden (privacy and reliability). Change these thresholds in `config/settings.json`.
- **Likely reversed scale:** "Strongly disagree" on all three post-training knowledge items, yet a 7–10 rating for the training (19 responses). These are excluded from results by default; a dashboard checkbox includes them.

## Privacy
The dashboards contain no free-text comments, only their theme codes. Groups under 10 responses are hidden. The survey data is EveryMind's: keep it within the team and do not post it publicly.

## Files
```
run_pipeline.py          main script (load → clean → code themes → analyze → build outputs)
dashboard_template.html  layout for output/dashboard.html; the pipeline injects the data
config/settings.json     thresholds, answer-label mapping, column keywords
config/counties.json     Maryland jurisdictions + spelling aliases
config/themes.json       keyword rules for comment themes
tests/test_update.py     simulated data-update test
Run_in_Colab.ipynb       no-install runner for Google Colab
data/survey_raw.xlsx     the survey export (not included in public copies)
output/                  generated by run_pipeline.py
frontend/                React dashboard (see frontend/README.md)
```
# Experimental provider ranking

This administrator-only preview uses synthetic training data. It does not replace operational matching or assign workers. Eligibility comes from the existing database matching policy. Disabled, invalid or unavailable ML responses fall back to rule-based ranking.

Requires Python 3.11+ (tested with 3.14). LightGBM is pinned to 4.6.0 because 4.7.0 crashed during native training on this Windows/Python environment. From this directory in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-test.txt
.\.venv\Scripts\python.exe train_model.py
.\.venv\Scripts\python.exe -m unittest test_api.py
$env:KUMPUNINJA_ML_KEY="replace-with-a-long-random-secret"
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Set matching server-only values in the Next.js `.env.local` and restart Next.js:

```ini
ML_API_URL=http://127.0.0.1:8001
KUMPUNINJA_ML_KEY=replace-with-the-same-long-random-secret
KUMPUNINJA_ML_EXPERIMENTAL=true
```

Sign in as an administrator, open an active booking, and expand **Team & schedule → Add workers**. Recommendations load automatically and update as workers are selected. Choose a suggestion to fill the active worker row, or use the eligible worker selector. Standard services fill the role automatically; renovation roles remain editable. Send offers using the assignment controls. Customers and providers cannot access the preview endpoint.

Leave the experimental flag false for operational rule-based recommendations. Never prefix the secret with NEXT_PUBLIC_. Deploy Python separately on a private network or behind HTTPS; localhost refers to the Next.js server itself. No database migration is required.

Only provider IDs, booking ID, distance, average rating and completed job count are sent to Python. Missing ratings use zero (the archive's convention); this synthetic model may disadvantage new providers and must be reviewed by an administrator. More than 100 candidates or unsupported features retain the operational ranking.

The model is rebuilt from the supplied CSVs and saved as native LightGBM text; the uploaded pickle/joblib artifact is not loaded. See models/training_report.json for reproduced synthetic NDCG metrics, which are not real-world accuracy. Database-backed eligibility and signed-in browser flows require a configured Supabase environment and separate acceptance testing.

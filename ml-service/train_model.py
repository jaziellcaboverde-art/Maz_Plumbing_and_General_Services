"""Train a reduced-feature, synthetic-only LightGBM ranker. Run from ml-service/."""
from pathlib import Path
import json
import numpy as np
import pandas as pd
from lightgbm import LGBMRanker

from sklearn.metrics import ndcg_score

ROOT = Path(__file__).resolve().parent
FEATURES = ['distance_km', 'average_customer_rating', 'prior_jobs_completed']

def load(name):
    frame = pd.read_csv(ROOT / f'{name}_eligible.csv').sort_values(['booking_id','provider_id']).reset_index(drop=True)
    # Only train on bookings with multiple candidates and nonconstant relevance labels.
    frame = frame.groupby('booking_id', sort=False).filter(lambda g: len(g) >= 2 and g.relevance_grade.nunique() > 1)
    return frame.reset_index(drop=True)

def evaluate(frame, model):
    if frame.empty: return None
    scores = model.predict(frame[FEATURES]); frame = frame.assign(pred=scores)
    return float(np.mean([ndcg_score([g.relevance_grade.to_numpy()], [g.pred.to_numpy()], k=3)
        for _, g in frame.groupby('booking_id', sort=False)]))

train, val, test = (load(s) for s in ['train','validation','test'])
groups = [set(frame.booking_id) for frame in (train, val, test)]
if any(groups[i] & groups[j] for i in range(3) for j in range(i + 1, 3)):
    raise ValueError('Training and evaluation booking groups must be disjoint')
model = LGBMRanker(objective='lambdarank', n_estimators=100, learning_rate=0.05,
    num_leaves=7, min_child_samples=12, random_state=20261104, verbosity=-1, n_jobs=1)
model.fit(train[FEATURES], train.relevance_grade,
    group=train.groupby('booking_id', sort=False).size().tolist())
(ROOT/'models').mkdir(exist_ok=True)
model.booster_.save_model(str(ROOT / "models" / "reduced_lightgbm.txt"))
report = {'dataset':'synthetic only', 'features':FEATURES,
 'train_groups':int(train.booking_id.nunique()),'validation_groups':int(val.booking_id.nunique()),
 'test_groups':int(test.booking_id.nunique()),'validation_ndcg_at_3':evaluate(val,model),
 'test_ndcg_at_3':evaluate(test,model),
 'warning':'Not validated for actual MAZ provider selection; use rule-based ranking operationally.'}
(ROOT/'models'/'training_report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))

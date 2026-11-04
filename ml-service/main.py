"""Experimental synthetic-trained ranking API; never authorizes assignments."""
import os
from pathlib import Path
from hmac import compare_digest
import lightgbm as lgb
import pandas as pd
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, ConfigDict

ROOT = Path(__file__).resolve().parent
FEATURES = ['distance_km', 'average_customer_rating', 'prior_jobs_completed']
MODEL = lgb.Booster(model_file=str(ROOT / "models" / "reduced_lightgbm.txt"))
app = FastAPI(title='KumpuNinja Experimental ML')
class Candidate(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra="forbid")
    provider_id: str
    distance_km: float = Field(ge=0, le=500)
    average_customer_rating: float = Field(ge=0, le=5)
    prior_jobs_completed: int = Field(ge=0)
class RankRequest(BaseModel):
    booking_id: str
    candidates: list[Candidate] = Field(min_length=1, max_length=100)
@app.get('/health')
def health():
    return {'ok': True, 'mode': 'synthetic_experimental'}
@app.post('/rank')
def rank(payload: RankRequest, x_ml_key: str | None = Header(default=None)):
    secret = os.getenv('KUMPUNINJA_ML_KEY')
    if not secret or not x_ml_key or not compare_digest(secret, x_ml_key):
        raise HTTPException(401, 'Unauthorized')
    ids = [c.provider_id for c in payload.candidates]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, 'Duplicate providers')
    df = pd.DataFrame([c.model_dump() for c in payload.candidates])
    scores = MODEL.predict(df[FEATURES])
    order = sorted(zip(ids, map(float,scores)),key=lambda pair:(-pair[1],pair[0]))
    return {'mode':'synthetic_experimental', 'booking_id':payload.booking_id,
      'top_three':[{'provider_id':p,'rank':i+1,'ranking_score':s} for i,(p,s) in enumerate(order[:3])]}

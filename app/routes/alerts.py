from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List
from datetime import datetime, timedelta
from bson import ObjectId
from app.database import alerts_inactivity_collection, alerts_anomaly_collection, sites_collection, generators_collection, electricity_readings_collection
from app.database.schemas.alerts_schema import InactivityAlertModel, AnomalyAlertModel
import logging

alerts_router = APIRouter(prefix="/api/alerts", tags=["Alerts"])
logger = logging.getLogger("alerts_api")

def obj_id_to_str(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
    return doc

# ----------- Inactivity Alerts CRUD -------------

@alerts_router.get("/inactivity", response_model=List[InactivityAlertModel])
async def list_inactivity_alerts(alerts_inactivity_collection=Depends(alerts_inactivity_collection)):
    docs = alerts_inactivity_collection.find()
    alerts = [obj_id_to_str(doc) for doc in docs] if docs else []
    logger.info(f"Fetched {len(alerts)} inactivity alerts")
    return alerts

@alerts_router.get("/inactivity/{alert_id}", response_model=InactivityAlertModel)
async def get_inactivity_alert(alert_id: str, alerts_inactivity_collection=Depends(alerts_inactivity_collection)):
    if not ObjectId.is_valid(alert_id):
        raise HTTPException(status_code=400, detail="Invalid alert ID")
    doc = alerts_inactivity_collection.find_one({"_id": ObjectId(alert_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Inactivity alert not found")
    return obj_id_to_str(doc)

#-----For Readings Anomalies----------

@alerts_router.get("/anomaly/detect", response_model=List[AnomalyAlertModel])
async def detect_anomaly_alerts(
    start: str = Query(...),
    end: str = Query(...),
    sites_collection=Depends(sites_collection),
    readings_collection=Depends(electricity_readings_collection),
    generators_collection=Depends(generators_collection)
):
    start_date = datetime.strptime(start, "%Y-%m-%d").date()
    end_date = datetime.strptime(end, "%Y-%m-%d").date()
    alerts: List[AnomalyAlertModel] = []
    active_sites = list(sites_collection.find({"status": "Active"}))

    for site in active_sites:
        site_id = site.get("id") or str(site.get("_id"))
        generators = list(generators_collection.find({"site_id": site_id}))
        for generator in generators:
            gen_id = generator.get("id") or str(generator.get("_id"))
            d = start_date
            while d <= end_date:
                reading = readings_collection.find_one({
                    "site_id": site_id,
                    "generator_id": gen_id,
                    "date": str(d)
                })
                if not reading or reading.get("electricity_reading", 0) == 0:
                    alerts.append(AnomalyAlertModel(
                        site_id=site_id,
                        site=site.get("site_name", ""),
                        generator_id=gen_id,
                        device=generator.get("name", generator.get("generator_name", gen_id)),
                        anomaly="No electricity reading" if not reading else "Reading is zero",
                        detected=str(d),
                        status="open",
                        createdAt=datetime.now()
                    ))
                d += timedelta(days=1)
    logger.info(f"Generated {len(alerts)} anomaly alerts (dynamic)")
    return alerts


@alerts_router.get("/anomaly", response_model=List[AnomalyAlertModel])
async def list_anomaly_alerts(alerts_anomaly_collection=Depends(alerts_anomaly_collection)):
    docs = alerts_anomaly_collection.find()
    alerts = [obj_id_to_str(doc) for doc in docs] if docs else []
    logger.info(f"Fetched {len(alerts)} anomaly alerts from DB")
    return alerts


@alerts_router.get("/anomaly/{alert_id}", response_model=AnomalyAlertModel)
async def get_anomaly_alert(alert_id: str, alerts_anomaly_collection=Depends(alerts_anomaly_collection)):
    if not ObjectId.is_valid(alert_id):
        raise HTTPException(status_code=400, detail="Invalid alert ID")
    doc = alerts_anomaly_collection.find_one({"_id": ObjectId(alert_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Anomaly alert not found")
    return obj_id_to_str(doc)
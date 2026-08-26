from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta, date
from bson import ObjectId
from app.database import (
    alerts_inactivity_collection,
    alerts_anomaly_collection,
    generator_usage_collection,
    electricity_readings_collection,
    sites_collection,
    generators_collection,
)
import logging

logger = logging.getLogger("alert_jobs")
scheduler = BackgroundScheduler()

def check_inactivity_alerts():
    now = datetime.utcnow()
    inactive_threshold = now - timedelta(hours=8)

    active_gens = generator_usage_collection().find()
    for gen in active_gens:
        gen_id = gen.get("generator_id")
        if not gen_id:
            continue
        last_entry = generator_usage_collection().find_one(
            {"generator_id": gen_id}, sort=[("date", -1)]
        )
        last_entry_date_str = last_entry["date"] if last_entry else None
        last_entry_date = datetime.fromisoformat(last_entry_date_str) if last_entry_date_str else None
        if not last_entry or (last_entry_date and last_entry_date < inactive_threshold):
            existing_alert = alerts_inactivity_collection().find_one(
                {
                    "type": "generator",
                    "generator": gen_id,
                    "status": {"$in": ["Unresolved", "Critical"]},
                }
            )
            if not existing_alert:
                alert_doc = {
                    "type": "generator",
                    "site": gen.get("site", ""),
                    "generator": gen_id,
                    "issue": "No activity detected for 8 hours",
                    "start": last_entry_date_str,
                    "status": "Unresolved",
                    "created_at": now,
                }
                alerts_inactivity_collection().insert_one(alert_doc)
                logger.info(f"Inserted inactivity alert for generator {gen_id}")

def check_anomaly_alerts():
    now = datetime.utcnow()
    today = date.today()
    # Optionally adjust window (e.g., for past N days)
    check_dates = [today]

    # For each active site, check all assigned generators
    active_sites = sites_collection().find({"status": "Active"})
    for site in active_sites:
        site_id = site.get("id") or str(site.get("_id"))
        site_name = site.get("site_name", "")
        assigned_gens = generators_collection().find({"site_id": site_id})
        for generator in assigned_gens:
            gen_id = generator.get("id") or str(generator.get("_id"))
            gen_name = generator.get("name") or generator.get("generator_name") or gen_id
            # For each relevant date (single day: today, or all dates logic if needed)
            for check_date in check_dates:
                # Check if there is a reading for this site/generator/date
                reading = electricity_readings_collection().find_one({
                    "site_id": site_id,
                    "generator_id": gen_id,
                    "date": str(check_date),
                })
                if not reading or reading.get("electricity_reading", 0) == 0:
                    anomaly_type = "No electricity reading" if not reading else "Reading is zero"
                    # Prevent duplicate open alerts for this generator/date
                    existing_alert = alerts_anomaly_collection().find_one({
                        "type": "site_generator_anomaly",
                        "site_id": site_id,
                        "generator_id": gen_id,
                        "detected": str(check_date),
                        "status": {"$in": ["open", "Critical", "Unresolved"]},
                    })
                    if not existing_alert:
                        alert_doc = {
                            "type": "site_generator_anomaly",
                            "site_id": site_id,
                            "site": site_name,
                            "generator_id": gen_id,
                            "device": gen_name,
                            "anomaly": anomaly_type,
                            "detected": str(check_date),
                            "status": "open",
                            "created_at": now,
                        }
                        alerts_anomaly_collection().insert_one(alert_doc)
                        logger.info(f"Inserted anomaly alert for {site_name}/{gen_name} on {check_date} (reason: {anomaly_type})")

def start_alert_scheduler():
    scheduler.add_job(check_inactivity_alerts, "interval", minutes=1)
    scheduler.add_job(check_anomaly_alerts, "interval", minutes=10)
    scheduler.start()
    logger.info("Alert scheduler started.")

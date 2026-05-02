from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId
from typing import Optional, List
from collections import defaultdict
from datetime import timedelta
from datetime import datetime
from app.database import (
    generators_collection,
    generator_usage_collection,
    electricity_readings_collection,
    maintenance_logs_collection,
    sites_collection as sites_collection_dep,
    vehicles_collection,
)
from app.database.schemas.generator_schema import (
    GeneratorModel, GeneratorUsageModel,
    ElectricityReadingModel, MaintenanceLogModel, 
    GeneratorUsageSummary, GeneratorTrendPoint, GeneratorUsageReportResponse,
    VehicleModel
)
from app.dependencies import get_current_user
generators_router = APIRouter(prefix="/api/generators-utilities", tags=["GeneratorsUtilities"], dependencies=[Depends(get_current_user)] )

def generate_generator_id(name: str, generators_collection):
    prefix = ''.join([c for c in name if c.isalnum()]).upper()[:3]
    regex = f"^{prefix}-\\d+$"
    last = generators_collection.find_one({"generator_id": {"$regex": regex}}, sort=[("generator_id", -1)])
    if last and "generator_id" in last:
        try:
            last_num = int(last["generator_id"].split("-")[1])
            new_num = last_num + 1
        except Exception:
            new_num = 1
    else:
        new_num = 1
    return f"{prefix}-{new_num:02d}"

def obj_id_to_str(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc

# ---------- CRUD: GENERATORS ----------
@generators_router.post("/generators", response_model=GeneratorModel)
async def add_generator(generator: GeneratorModel, generators_collection=Depends(generators_collection)):
    gen = generator.dict(exclude_unset=True, by_alias=True)
    gen.pop("location", None)
    gen.pop("status", None)
    gen["generator_id"] = generate_generator_id(gen["generator_name"], generators_collection)
    gen["created_at"] = datetime.now()
    result = generators_collection.insert_one(gen)
    gen["id"] = str(result.inserted_id)
    return gen

@generators_router.get("/generators", response_model=List[GeneratorModel])
async def list_generators(generators_collection=Depends(generators_collection)):
    gens = [obj_id_to_str(gen) for gen in generators_collection.find()]
    return gens

@generators_router.get("/generators/{generator_id}", response_model=GeneratorModel)
async def get_generator(generator_id: str, generators_collection=Depends(generators_collection)):
    gen = generators_collection.find_one({"generator_id": generator_id})
    if not gen:
        raise HTTPException(status_code=404, detail="Generator not found")
    return obj_id_to_str(gen)

@generators_router.put("/generators/{generator_id}", response_model=GeneratorModel)
async def update_generator(generator_id: str, generator: GeneratorModel, generators_collection=Depends(generators_collection)):
    old = generators_collection.find_one({"generator_id": generator_id})
    if not old:
        raise HTTPException(status_code=404, detail="Generator not found")
    new_data = {**old, **generator.dict(exclude_unset=True, by_alias=True)}
    new_data.pop("location", None)
    new_data.pop("status", None)
    generators_collection.update_one({"generator_id": generator_id}, {"$set": new_data})
    gen = generators_collection.find_one({"generator_id": generator_id})
    return obj_id_to_str(gen)

@generators_router.delete("/generators/{generator_id}")
async def delete_generator(generator_id: str, generators_collection=Depends(generators_collection)):
    res = generators_collection.delete_one({"generator_id": generator_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Generator not found")
    return {"detail": "Deleted successfully"}

# ---------- CRUD: USAGE ----------
def compute_total_fuel_cost(usage_doc):
    consumption = usage_doc.get("fuel_consumed") or 0
    cost_per_litre = usage_doc.get("fuel_cost_per_litre") or 0
    usage_doc["total_fuel_cost"] = round(float(consumption) * float(cost_per_litre), 2)
    return usage_doc

@generators_router.post("/usage", response_model=GeneratorUsageModel)
async def add_usage(
    usage: GeneratorUsageModel,
    generator_usage_collection=Depends(generator_usage_collection),
    generators_collection=Depends(generators_collection)
):
    usage_doc = usage.dict(exclude_unset=True, by_alias=True)
    # logging for debug
    print("USAGE POST PAYLOAD:", usage_doc)
    if not usage_doc.get("generator_id"):
        raise HTTPException(status_code=400, detail="generator_id required. Please select an existing generator.")
    usage_doc["created_at"] = datetime.now()
    usage_doc = compute_total_fuel_cost(usage_doc)
    result = generator_usage_collection.insert_one(usage_doc)
    usage_doc["id"] = str(result.inserted_id)
    return usage_doc

@generators_router.get("/usage", response_model=List[GeneratorUsageModel])
async def list_usage(generator_id: Optional[str] = None, site_id: Optional[str] = None, generator_usage_collection=Depends(generator_usage_collection)):
    query = {}
    if generator_id:
        query["generator_id"] = generator_id
    if site_id:
        query["site_id"] = site_id
    usage = [obj_id_to_str(u) for u in generator_usage_collection.find(query)]
    return usage

@generators_router.put("/usage/{usage_id}", response_model=GeneratorUsageModel)
async def update_usage(usage_id: str, usage: GeneratorUsageModel, generator_usage_collection=Depends(generator_usage_collection)):
    old = generator_usage_collection.find_one({"_id": ObjectId(usage_id)}) if ObjectId.is_valid(usage_id) else None
    if not old:
        raise HTTPException(status_code=404, detail="Usage record not found")
    new_doc = {**old, **usage.dict(exclude_unset=True, by_alias=True)}
    new_doc = compute_total_fuel_cost(new_doc)
    generator_usage_collection.update_one({"_id": ObjectId(usage_id)}, {"$set": new_doc})
    doc = generator_usage_collection.find_one({"_id": ObjectId(usage_id)})
    return obj_id_to_str(doc)

@generators_router.delete("/usage/{usage_id}")
async def delete_usage(usage_id: str, generator_usage_collection=Depends(generator_usage_collection)):
    res = generator_usage_collection.delete_one({"_id": ObjectId(usage_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usage record not found")
    return {"detail": "Deleted successfully"}

def obj_id_to_str(doc):
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc

# ---------- CRUD: ELECTRICITY READINGS ----------

@generators_router.post("/readings", response_model=ElectricityReadingModel)
async def add_reading(
    reading: ElectricityReadingModel,
    electricity_readings_collection=Depends(electricity_readings_collection)
):
    doc = reading.dict(exclude_unset=True, by_alias=True)
    # Validate required fields
    if not doc.get("site_id"):
        raise HTTPException(status_code=400, detail="site_id required.")
    if not doc.get("generator_id"):
        raise HTTPException(status_code=400, detail="generator_id required.")
    meter = doc.get("electricity_reading")
    per_unit = doc.get("per_unit_cost")
    if meter is None or per_unit is None:
        raise HTTPException(status_code=400, detail="electricity_reading and per_unit_cost required.")
    doc["total_energy_cost"] = round(float(meter) * float(per_unit), 2)
    doc["created_at"] = datetime.utcnow()  # Always UTC!
    result = electricity_readings_collection.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc

@generators_router.get("/readings", response_model=List[ElectricityReadingModel])
async def list_readings(
    site_id: Optional[str] = None,
    electricity_readings_collection=Depends(electricity_readings_collection)
):
    query = {}
    if site_id:
        query["site_id"] = site_id
    readings = []
    for r in electricity_readings_collection.find(query):
        rec = obj_id_to_str(r)
        # Recalculate total_energy_cost
        meter = rec.get("electricity_reading")
        per_unit = rec.get("per_unit_cost")
        if meter is not None and per_unit is not None:
            rec["total_energy_cost"] = round(float(meter) * float(per_unit), 2)
        readings.append(rec)
    return readings

@generators_router.put("/readings/{reading_id}", response_model=ElectricityReadingModel)
async def update_reading(
    reading_id: str,
    reading: ElectricityReadingModel,
    electricity_readings_collection=Depends(electricity_readings_collection)
):
    old = electricity_readings_collection.find_one({"_id": ObjectId(reading_id)}) if ObjectId.is_valid(reading_id) else None
    if not old:
        raise HTTPException(status_code=404, detail="Electricity reading not found")
    new_doc = {**old, **reading.dict(exclude_unset=True, by_alias=True)}
    meter = new_doc.get("electricity_reading")
    per_unit = new_doc.get("per_unit_cost")
    if meter is not None and per_unit is not None:
        new_doc["total_energy_cost"] = round(float(meter) * float(per_unit), 2)
    electricity_readings_collection.update_one({"_id": ObjectId(reading_id)}, {"$set": new_doc})
    doc = electricity_readings_collection.find_one({"_id": ObjectId(reading_id)})
    return obj_id_to_str(doc)

@generators_router.delete("/readings/{reading_id}")
async def delete_reading(
    reading_id: str,
    electricity_readings_collection=Depends(electricity_readings_collection)
):
    res = electricity_readings_collection.delete_one({"_id": ObjectId(reading_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Electricity reading not found")
    return {"detail": "Deleted successfully"}

# ---------- CRUD: MAINTENANCE LOGS ----------
@generators_router.post("/maintenance", response_model=MaintenanceLogModel)
async def add_maintenance(
    log: MaintenanceLogModel,
    maintenance_logs_collection=Depends(maintenance_logs_collection)
):
    doc = log.dict(exclude_unset=True, by_alias=True)
    if not doc.get("generator_id"):
        raise HTTPException(status_code=400, detail="generator_id required.")
    if not doc.get("date"):
        raise HTTPException(status_code=400, detail="date required.")
    if not doc.get("technician"):
        raise HTTPException(status_code=400, detail="technician required.")
    if not doc.get("maintenance_status"):
        raise HTTPException(status_code=400, detail="maintenance_status required.")
    doc["created_at"] = datetime.utcnow()
    result = maintenance_logs_collection.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc

@generators_router.get("/maintenance", response_model=List[MaintenanceLogModel])
async def list_maintenance(
    generator_id: Optional[str] = None,
    maintenance_logs_collection=Depends(maintenance_logs_collection)
):
    query = {}
    if generator_id:
        query["generator_id"] = generator_id
    logs = [obj_id_to_str(l) for l in maintenance_logs_collection.find(query)]
    return logs

@generators_router.put("/maintenance/{log_id}", response_model=MaintenanceLogModel)
async def update_maintenance(
    log_id: str,
    log: MaintenanceLogModel,
    maintenance_logs_collection=Depends(maintenance_logs_collection)
):
    old = maintenance_logs_collection.find_one({"_id": ObjectId(log_id)}) if ObjectId.is_valid(log_id) else None
    if not old:
        raise HTTPException(status_code=404, detail="Maintenance log not found")
    new_doc = {**old, **log.dict(exclude_unset=True, by_alias=True)}
    maintenance_logs_collection.update_one({"_id": ObjectId(log_id)}, {"$set": new_doc})
    doc = maintenance_logs_collection.find_one({"_id": ObjectId(log_id)})
    return obj_id_to_str(doc)

@generators_router.delete("/maintenance/{log_id}")
async def delete_maintenance(
    log_id: str,
    maintenance_logs_collection=Depends(maintenance_logs_collection)
):
    res = maintenance_logs_collection.delete_one({"_id": ObjectId(log_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Maintenance log not found")
    return {"detail": "Deleted successfully"}


# --------------Reports Endpoint------------------

@generators_router.get("/reports")
async def get_generator_report(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
    technician: Optional[str] = Query(None, description="Filter by Technician ID"),
    site_id: Optional[str] = Query(None, description="Filter by Site ID"),
    generator_usage_collection=Depends(generator_usage_collection),
    generators_collection=Depends(generators_collection),
    maintenance_logs_collection=Depends(maintenance_logs_collection),
    sites_collection=Depends(sites_collection_dep),
    electricity_readings_collection=Depends(electricity_readings_collection),
):
    try:
        start_dt = datetime.fromisoformat(start)
        end_dt = datetime.fromisoformat(end)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid start/end date")

    usage_reports = []
    date_usage = defaultdict(lambda: {"energy": 0, "cost": 0})

    if site_id:
        # -------- SITE-WISE REPORT --------
        site = sites_collection.find_one({"_id": ObjectId(site_id)})
        if not site:
            raise HTTPException(status_code=404, detail="Site not found")
        site_name = site.get("site_name")
        site_location = site.get("site_location")
        assigned_employee_id = site.get("assigned_employee_id")
        status = site.get("status")
        generator_ids = site.get("generator_ids", [])

        for gen_id in generator_ids:
            gen_doc = generators_collection.find_one({"generator_id": gen_id}) or {}
            gen_name = gen_doc.get("generator_name", gen_id)

            # DEBUG: Find ALL usage logs for this generator to see what's stored
            all_gen_usage = list(generator_usage_collection.find({"generator_id": gen_id}))
            print(f"\n=== DEBUG: Generator {gen_id} ===")
            print(f"Total usage logs in DB: {len(all_gen_usage)}")
            for idx, log in enumerate(all_gen_usage):
                print(f"  Log {idx+1}:")
                print(f"    - site_id: {log.get('site_id')} (type: {type(log.get('site_id'))})")
                print(f"    - date: {log.get('date')}")
                print(f"    - fuel: {log.get('fuel_consumed')}")
                print(f"    - cost: {log.get('total_fuel_cost')}")
            
            print(f"\nSearching for site_id: {site_id} (type: {type(site_id)})")
            print(f"Date range: {start} to {end}")
            
            # Try finding by generator only (no site filter, no date filter)
            usage_logs = list(generator_usage_collection.find({"generator_id": gen_id}))
            print(f"\nQuery without filters: Found {len(usage_logs)} logs")
            
            # Filter by site manually
            filtered_logs = []
            for log in usage_logs:
                log_site_id = str(log.get('site_id', ''))
                target_site_id = str(site_id)
                if log_site_id == target_site_id:
                    filtered_logs.append(log)
                    print(f"  ✓ Matched log: {log.get('date')}")
                else:
                    print(f"  ✗ Skipped log: site_id '{log_site_id}' != '{target_site_id}'")
            
            usage_logs = filtered_logs
            print(f"\nAfter site filtering: {len(usage_logs)} logs")
            
            # Filter by date manually
            date_filtered = []
            for log in usage_logs:
                log_date = str(log.get('date', ''))
                if log_date >= start and log_date <= end:
                    date_filtered.append(log)
                    print(f"  ✓ Date in range: {log_date}")
                else:
                    print(f"  ✗ Date out of range: {log_date} (need {start} to {end})")
            
            usage_logs = date_filtered
            print(f"\nFinal filtered logs: {len(usage_logs)} entries")
            
            total_usage = sum(u.get("fuel_consumed", 0) for u in usage_logs)
            total_cost = sum(u.get("total_fuel_cost", 0) for u in usage_logs)
            print(f"Calculated totals - Usage: {total_usage}, Cost: {total_cost}\n")

            # NEW: Build fuel usage rows
            usage_rows = [
                {
                    "date": u.get("date"),
                    "fuel_usage": u.get("fuel_consumed", 0),
                    "cost_per_litre": u.get("fuel_cost_per_litre", 0),
                    "total_cost": u.get("total_fuel_cost", 0)
                } for u in usage_logs
            ]
            
            # Debug logging
            print(f"Generator {gen_id} - Found {len(usage_logs)} usage logs")
            print(f"Generator {gen_id} - Total Usage: {total_usage}, Total Cost: {total_cost}")
            print(f"Generator {gen_id} - Usage rows: {usage_rows}")

            for u in usage_logs:
                day_val = u.get("date")
                if isinstance(day_val, datetime):
                    ds = day_val.date().isoformat()
                elif isinstance(day_val, str):
                    ds = day_val[:10]
                else:
                    continue
                date_usage[ds]["energy"] += u.get("fuel_consumed", 0)
                date_usage[ds]["cost"] += u.get("total_fuel_cost", 0)

            readings = list(electricity_readings_collection.find({
                "generator_id": gen_id,
                "site_id": site_id,
                "date": {"$gte": start, "$lte": end}
            }))
            reading_rows = [
                {
                    "date": r.get("date"),
                    "electricity_reading": r.get("electricity_reading"),
                    "per_unit_cost": r.get("per_unit_cost"),
                    "total_energy_cost": r.get("total_energy_cost")
                } for r in readings
            ]
            usage_reports.append({
                "site_id": site_id,
                "site_name": site_name,
                "generator_id": gen_id,
                "generator_name": gen_name,
                "total_usage": total_usage,
                "total_cost": total_cost,
                "readings": reading_rows,
                "usage": usage_rows,  # <-- ADDED!
            })

        trend = []
        day = start_dt.date()
        end_day = end_dt.date()
        while day <= end_day:
            ds = day.isoformat()
            trend.append({
                "date": ds,
                "energy": date_usage[ds]["energy"] if ds in date_usage else 0,
                "cost": date_usage[ds]["cost"] if ds in date_usage else 0
            })
            day += timedelta(days=1)

        report = {
            "site_id": site_id,
            "site_name": site_name,
            "site_location": site_location,
            "assigned_employee_id": assigned_employee_id,
            "status": status,
            "generators": usage_reports,
            "trend": trend
        }

    else:
        # -------- COMBINED ALL-SITES REPORT --------
        all_sites = list(sites_collection.find({}))
        for site in all_sites:
            sid = str(site["_id"])
            sname = site.get("site_name")
            generator_ids = site.get("generator_ids", [])
            for gen_id in generator_ids:
                gen_doc = generators_collection.find_one({"generator_id": gen_id}) or {}
                gen_name = gen_doc.get("generator_name", gen_id)
                usage_logs = list(generator_usage_collection.find({
                    "generator_id": gen_id,
                    "site_id": sid,
                    "date": {"$gte": start, "$lte": end}
                }))
                total_usage = sum(u.get("fuel_consumed", 0) for u in usage_logs)
                total_cost = sum(u.get("total_fuel_cost", 0) for u in usage_logs)

                # NEW: Build fuel usage rows
                usage_rows = [
                    {
                        "date": u.get("date"),
                        "fuel_usage": u.get("fuel_consumed", 0),
                        "cost_per_litre": u.get("cost_per_litre", None),
                        "total_cost": u.get("total_fuel_cost", 0)
                    } for u in usage_logs
                ]

                for u in usage_logs:
                    day = u.get("date")
                    if day:
                        ds = day[:10] if isinstance(day, str) else day.date().isoformat()
                        date_usage[ds]["energy"] += u.get("fuel_consumed", 0)
                        date_usage[ds]["cost"] += u.get("total_fuel_cost", 0)

                readings = list(electricity_readings_collection.find({
                    "generator_id": gen_id,
                    "site_id": sid,
                    "date": {"$gte": start, "$lte": end}
                }))
                reading_rows = [
                    {
                        "date": r.get("date"),
                        "electricity_reading": r.get("electricity_reading"),
                        "per_unit_cost": r.get("per_unit_cost"),
                        "total_energy_cost": r.get("total_energy_cost")
                    } for r in readings
                ]
                usage_reports.append({
                    "site_id": sid,
                    "site_name": sname,
                    "generator_id": gen_id,
                    "generator_name": gen_name,
                    "total_usage": total_usage,
                    "total_cost": total_cost,
                    "readings": reading_rows,
                    "usage": usage_rows, 
                })

        trend = []
        day = start_dt.date()
        end_day = end_dt.date()
        while day <= end_day:
            ds = day.isoformat()
            trend.append({
                "date": ds,
                "energy": date_usage[ds]["energy"] if ds in date_usage else 0,
                "cost": date_usage[ds]["cost"] if ds in date_usage else 0
            })
            day += timedelta(days=1)

        report = {
            "site_id": None,
            "site_name": "All Sites Combined",
            "generators": usage_reports,
            "trend": trend
        }

    return report


# ---------- CRUD: VEHICLES ----------
def generate_vehicle_id(name: str, col):
    prefix = ''.join([c for c in name if c.isalnum()]).upper()[:3]
    regex = f"^{prefix}-\\d+$"
    last = col.find_one({"vehicle_id": {"$regex": regex}}, sort=[("vehicle_id", -1)])
    if last and "vehicle_id" in last:
        try:
            last_num = int(last["vehicle_id"].split("-")[1])
            new_num = last_num + 1
        except Exception:
            new_num = 1
    else:
        new_num = 1
    return f"{prefix}-{new_num:02d}"

@generators_router.post("/vehicles", response_model=VehicleModel)
async def add_vehicle(vehicle: VehicleModel, col=Depends(vehicles_collection)):
    doc = vehicle.dict(exclude_unset=True, by_alias=True)
    doc["vehicle_id"] = generate_vehicle_id(doc["vehicle_name"], col)
    doc["created_at"] = datetime.now()
    result = col.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc

@generators_router.get("/vehicles", response_model=List[VehicleModel])
async def list_vehicles(col=Depends(vehicles_collection)):
    return [obj_id_to_str(v) for v in col.find()]

@generators_router.put("/vehicles/{vehicle_id}", response_model=VehicleModel)
async def update_vehicle(vehicle_id: str, vehicle: VehicleModel, col=Depends(vehicles_collection)):
    old = col.find_one({"vehicle_id": vehicle_id})
    if not old:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    new_data = {**old, **vehicle.dict(exclude_unset=True, by_alias=True)}
    col.update_one({"vehicle_id": vehicle_id}, {"$set": new_data})
    return obj_id_to_str(col.find_one({"vehicle_id": vehicle_id}))

@generators_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, col=Depends(vehicles_collection)):
    res = col.delete_one({"vehicle_id": vehicle_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"detail": "Deleted successfully"}

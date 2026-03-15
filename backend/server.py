from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError
from twilio.rest import Client as TwilioClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

twilio_client = TwilioClient(os.environ.get('TWILIO_ACCOUNT_SID'), os.environ.get('TWILIO_AUTH_TOKEN'))
TWILIO_VERIFY_SERVICE = os.environ.get('TWILIO_VERIFY_SERVICE')

app = FastAPI()
api_router = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Models ────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "employee"
    department: str = ""
    phone: str = ""

class FirmRegister(BaseModel):
    firm_name: str
    admin_name: str
    admin_email: str
    admin_password: str
    admin_phone: str = ""
    firm_phone: str = ""
    firm_address: str = ""
    firm_gstin: str = ""

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    assigned_to: str
    client_id: Optional[str] = None
    priority: str = "medium"
    due_date: str = ""

class TaskStatusUpdate(BaseModel):
    status: str

class LeaveCreate(BaseModel):
    leave_type: str
    start_date: str
    end_date: str
    reason: str = ""

class ClientCreate(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    company: str = ""
    pan_number: str = ""
    gst_number: str = ""
    services: List[str] = []
    notes: str = ""

class QueryCreate(BaseModel):
    title: str
    description: str
    to_user_id: Optional[str] = None

class QueryResponseModel(BaseModel):
    message: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

class SendOTPRequest(BaseModel):
    email: str

class VerifyOTPResetRequest(BaseModel):
    email: str
    code: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    code: str
    new_password: str

class DailyReportCreate(BaseModel):
    date: str
    tasks_completed: List[dict] = []
    total_hours: float = 0
    summary: str = ""

class ComplianceCreate(BaseModel):
    title: str
    category: str = "custom"
    due_date: str
    recurring: str = "one_time"
    description: str = ""
    assigned_to: Optional[str] = None

class ComplianceStatusUpdate(BaseModel):
    status: str

# ─── Helpers ───────────────────────────────────────────────────

def create_token(user_id: str, role: str) -> str:
    payload = {"sub": user_id, "role": role, "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(authorization.split(" ")[1], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_role(roles, user):
    if user["role"] not in roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

def ff(user):
    """Firm filter shorthand."""
    return {"firm_id": user.get("firm_id", "")}

async def notify(user_id, ntype, message, ref_id="", firm_id=""):
    await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": user_id, "firm_id": firm_id, "type": ntype, "message": message, "reference_id": ref_id, "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()})

def send_twilio_otp(phone_number):
    if not phone_number:
        raise HTTPException(status_code=400, detail="No phone number registered. Please update your profile with a phone number.")
    phone = phone_number.strip()
    if not phone.startswith('+'):
        phone = '+91' + phone
    try:
        v = twilio_client.verify.v2.services(TWILIO_VERIFY_SERVICE).verifications.create(to=phone, channel="sms")
        return v.status
    except Exception as e:
        logger.error(f"Twilio error: {e}")
        if "unverified" in str(e).lower():
            raise HTTPException(status_code=400, detail="Phone not verified in Twilio. Verify at twilio.com/console or contact admin.")
        raise HTTPException(status_code=400, detail="Failed to send OTP. Check phone number.")

def verify_twilio_otp(phone_number, code):
    phone = phone_number.strip()
    if not phone.startswith('+'):
        phone = '+91' + phone
    try:
        c = twilio_client.verify.v2.services(TWILIO_VERIFY_SERVICE).verification_checks.create(to=phone, code=code)
        return c.status == "approved"
    except:
        return False

PRESET_DEADLINES = [
    {"title": "GSTR-1 Filing", "category": "gst", "recurring": "monthly", "description": "Monthly return for outward supplies. Due 11th of next month.", "day": 11},
    {"title": "GSTR-3B Filing", "category": "gst", "recurring": "monthly", "description": "Monthly summary return. Due 20th of next month.", "day": 20},
    {"title": "GSTR-9 Annual Return", "category": "gst", "recurring": "annually", "description": "Annual GST return. Due December 31.", "month": 12, "day": 31},
    {"title": "GSTR-9C Reconciliation", "category": "gst", "recurring": "annually", "description": "GST audit reconciliation statement. Due December 31.", "month": 12, "day": 31},
    {"title": "ITR Filing (Non-Audit)", "category": "income_tax", "recurring": "annually", "description": "Income Tax Return for individuals/non-audit cases. Due July 31.", "month": 7, "day": 31},
    {"title": "ITR Filing (Audit Cases)", "category": "income_tax", "recurring": "annually", "description": "ITR for audit cases. Due October 31.", "month": 10, "day": 31},
    {"title": "Advance Tax - Q1", "category": "income_tax", "recurring": "quarterly", "description": "First installment of advance tax. Due June 15.", "month": 6, "day": 15},
    {"title": "Advance Tax - Q2", "category": "income_tax", "recurring": "quarterly", "description": "Second installment. Due September 15.", "month": 9, "day": 15},
    {"title": "Advance Tax - Q3", "category": "income_tax", "recurring": "quarterly", "description": "Third installment. Due December 15.", "month": 12, "day": 15},
    {"title": "Advance Tax - Q4", "category": "income_tax", "recurring": "quarterly", "description": "Fourth installment. Due March 15.", "month": 3, "day": 15},
    {"title": "TDS Return - Q1", "category": "income_tax", "recurring": "quarterly", "description": "TDS return for Apr-Jun quarter. Due July 31.", "month": 7, "day": 31},
    {"title": "TDS Return - Q2", "category": "income_tax", "recurring": "quarterly", "description": "TDS return for Jul-Sep quarter. Due October 31.", "month": 10, "day": 31},
    {"title": "TDS Return - Q3", "category": "income_tax", "recurring": "quarterly", "description": "TDS return for Oct-Dec quarter. Due January 31.", "month": 1, "day": 31},
    {"title": "TDS Return - Q4", "category": "income_tax", "recurring": "quarterly", "description": "TDS return for Jan-Mar quarter. Due May 31.", "month": 5, "day": 31},
    {"title": "Tax Audit Report", "category": "income_tax", "recurring": "annually", "description": "Tax audit report u/s 44AB. Due September 30.", "month": 9, "day": 30},
    {"title": "ROC Annual Return (MGT-7)", "category": "roc", "recurring": "annually", "description": "Annual return filing with ROC. Due November 29.", "month": 11, "day": 29},
    {"title": "ROC Financial Statements (AOC-4)", "category": "roc", "recurring": "annually", "description": "Filing of financial statements. Due October 30.", "month": 10, "day": 30},
]

async def seed_compliance_for_firm(firm_id):
    now = datetime.now(timezone.utc)
    year = now.year
    for p in PRESET_DEADLINES:
        if p["recurring"] == "monthly":
            for m in range(1, 13):
                d = min(p["day"], 28)
                due = f"{year}-{m:02d}-{d:02d}"
                await db.compliance.insert_one({"id": str(uuid.uuid4()), "firm_id": firm_id, "title": f"{p['title']} ({datetime(year,m,1).strftime('%b')})", "category": p["category"], "due_date": due, "recurring": "monthly", "description": p["description"], "status": "upcoming" if due >= now.strftime("%Y-%m-%d") else "overdue", "assigned_to": "", "assigned_to_name": "", "is_preset": True, "created_at": now.isoformat()})
        elif p["recurring"] == "quarterly":
            due = f"{year}-{p['month']:02d}-{p['day']:02d}"
            await db.compliance.insert_one({"id": str(uuid.uuid4()), "firm_id": firm_id, "title": p["title"], "category": p["category"], "due_date": due, "recurring": "quarterly", "description": p["description"], "status": "upcoming" if due >= now.strftime("%Y-%m-%d") else "overdue", "assigned_to": "", "assigned_to_name": "", "is_preset": True, "created_at": now.isoformat()})
        else:
            due = f"{year}-{p['month']:02d}-{p['day']:02d}"
            await db.compliance.insert_one({"id": str(uuid.uuid4()), "firm_id": firm_id, "title": p["title"], "category": p["category"], "due_date": due, "recurring": "annually", "description": p["description"], "status": "upcoming" if due >= now.strftime("%Y-%m-%d") else "overdue", "assigned_to": "", "assigned_to_name": "", "is_preset": True, "created_at": now.isoformat()})

# ─── Firm Registration (Public) ────────────────────────────────

@api_router.post("/firms/register")
async def register_firm(req: FirmRegister):
    existing = await db.users.find_one({"email": req.admin_email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    firm_id = str(uuid.uuid4())
    firm = {"id": firm_id, "name": req.firm_name, "phone": req.firm_phone, "address": req.firm_address, "gstin": req.firm_gstin, "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.firms.insert_one(firm)
    admin_id = str(uuid.uuid4())
    admin_user = {"id": admin_id, "firm_id": firm_id, "email": req.admin_email, "password_hash": pwd_context.hash(req.admin_password), "name": req.admin_name, "role": "admin", "department": "Management", "phone": req.admin_phone, "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(admin_user)
    await seed_compliance_for_firm(firm_id)
    token = create_token(admin_id, "admin")
    safe = {k: v for k, v in admin_user.items() if k not in ("password_hash", "_id")}
    return {"token": token, "user": safe, "firm": {"id": firm_id, "name": req.firm_name}}

# ─── Auth Routes ───────────────────────────────────────────────

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user or not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")
    token = create_token(user["id"], user["role"])
    await db.login_logs.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "firm_id": user.get("firm_id", ""), "user_name": user["name"], "login_time": datetime.now(timezone.utc).isoformat()})
    safe = {k: v for k, v in user.items() if k != "password_hash"}
    firm = await db.firms.find_one({"id": user.get("firm_id", "")}, {"_id": 0})
    return {"token": token, "user": safe, "firm": firm}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    firm = await db.firms.find_one({"id": user.get("firm_id", "")}, {"_id": 0})
    return {**user, "firm": firm}

@api_router.put("/auth/profile")
async def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated

@api_router.post("/auth/register")
async def register_user(req: RegisterRequest, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    if req.role == "admin" and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create admin users")
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = {"id": str(uuid.uuid4()), "firm_id": user.get("firm_id", ""), "email": req.email, "password_hash": pwd_context.hash(req.password), "name": req.name, "role": req.role, "department": req.department, "phone": req.phone, "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(new_user)
    new_user.pop("password_hash"); new_user.pop("_id", None)
    return new_user

# ─── OTP Password Routes ──────────────────────────────────────

@api_router.post("/auth/forgot-password/send-otp")
async def forgot_password_send_otp(req: SendOTPRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email")
    if not user.get("phone"):
        raise HTTPException(status_code=400, detail="No phone number registered. Contact admin.")
    status = send_twilio_otp(user["phone"])
    phone = user["phone"]
    masked = phone[:4] + "****" + phone[-2:] if len(phone) > 6 else "****"
    return {"status": status, "masked_phone": masked, "message": f"OTP sent to {masked}"}

@api_router.post("/auth/forgot-password/verify-reset")
async def forgot_password_verify_reset(req: VerifyOTPResetRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="No account found")
    if not user.get("phone"):
        raise HTTPException(status_code=400, detail="No phone number registered")
    if not verify_twilio_otp(user["phone"], req.code):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code")
    await db.users.update_one({"email": req.email}, {"$set": {"password_hash": pwd_context.hash(req.new_password)}})
    return {"message": "Password reset successfully. You can now login."}

@api_router.post("/auth/change-password/send-otp")
async def change_password_send_otp(user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not full.get("phone"):
        raise HTTPException(status_code=400, detail="No phone number registered. Update your profile first.")
    status = send_twilio_otp(full["phone"])
    phone = full["phone"]
    masked = phone[:4] + "****" + phone[-2:] if len(phone) > 6 else "****"
    return {"status": status, "masked_phone": masked, "message": f"OTP sent to {masked}"}

@api_router.post("/auth/change-password/verify")
async def change_password_verify(req: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not full.get("phone"):
        raise HTTPException(status_code=400, detail="No phone number registered")
    if not verify_twilio_otp(full["phone"], req.code):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": pwd_context.hash(req.new_password)}})
    return {"message": "Password changed successfully"}

# ─── Employee Routes ───────────────────────────────────────────

@api_router.get("/employees")
async def list_employees(user: dict = Depends(get_current_user)):
    return await db.users.find({**ff(user)}, {"_id": 0, "password_hash": 0}).to_list(1000)

@api_router.get("/employees/{eid}")
async def get_employee(eid: str, user: dict = Depends(get_current_user)):
    emp = await db.users.find_one({"id": eid, **ff(user)}, {"_id": 0, "password_hash": 0})
    if not emp: raise HTTPException(status_code=404, detail="Employee not found")
    return emp

@api_router.put("/employees/{eid}")
async def update_employee(eid: str, data: EmployeeUpdate, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "role" in updates and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can change roles")
    if updates:
        await db.users.update_one({"id": eid, **ff(user)}, {"$set": updates})
    return await db.users.find_one({"id": eid}, {"_id": 0, "password_hash": 0})

@api_router.delete("/employees/{eid}")
async def delete_employee(eid: str, user: dict = Depends(get_current_user)):
    await require_role(["admin"], user)
    r = await db.users.delete_one({"id": eid, **ff(user)})
    if r.deleted_count == 0: raise HTTPException(status_code=404, detail="Not found")
    return {"message": "Employee deleted"}

# ─── Task Routes ───────────────────────────────────────────────

@api_router.post("/tasks")
async def create_task(data: TaskCreate, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    assignee = await db.users.find_one({"id": data.assigned_to}, {"_id": 0})
    if not assignee: raise HTTPException(status_code=404, detail="Assignee not found")
    client_name = ""
    if data.client_id:
        cl = await db.clients.find_one({"id": data.client_id}, {"_id": 0})
        client_name = cl["name"] if cl else ""
    task = {"id": str(uuid.uuid4()), "firm_id": user.get("firm_id", ""), "title": data.title, "description": data.description, "assigned_to": data.assigned_to, "assigned_to_name": assignee["name"], "assigned_by": user["id"], "assigned_by_name": user["name"], "client_id": data.client_id or "", "client_name": client_name, "status": "pending", "priority": data.priority, "due_date": data.due_date, "created_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.tasks.insert_one(task)
    task.pop("_id", None)
    await notify(data.assigned_to, "task_assigned", f"New task: {data.title}", task["id"], user.get("firm_id", ""))
    return task

@api_router.get("/tasks")
async def list_tasks(status: Optional[str] = None, priority: Optional[str] = None, assigned_to: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {**ff(user)}
    if user["role"] == "employee": q["assigned_to"] = user["id"]
    elif assigned_to: q["assigned_to"] = assigned_to
    if status: q["status"] = status
    if priority: q["priority"] = priority
    return await db.tasks.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api_router.get("/tasks/{tid}")
async def get_task(tid: str, user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"id": tid, **ff(user)}, {"_id": 0})
    if not t: raise HTTPException(status_code=404, detail="Task not found")
    return t

@api_router.put("/tasks/{tid}")
async def update_task(tid: str, data: TaskCreate, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    updates = data.model_dump()
    assignee = await db.users.find_one({"id": data.assigned_to}, {"_id": 0})
    if assignee: updates["assigned_to_name"] = assignee["name"]
    if data.client_id:
        cl = await db.clients.find_one({"id": data.client_id}, {"_id": 0})
        updates["client_name"] = cl["name"] if cl else ""
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.tasks.update_one({"id": tid, **ff(user)}, {"$set": updates})
    return await db.tasks.find_one({"id": tid}, {"_id": 0})

@api_router.put("/tasks/{tid}/status")
async def update_task_status(tid: str, data: TaskStatusUpdate, user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": tid, **ff(user)}, {"_id": 0})
    if not task: raise HTTPException(status_code=404, detail="Task not found")
    if user["role"] == "employee" and task["assigned_to"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your task")
    await db.tasks.update_one({"id": tid}, {"$set": {"status": data.status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    if data.status == "completed":
        await notify(task["assigned_by"], "task_updated", f"Task completed: {task['title']}", tid, user.get("firm_id", ""))
    return await db.tasks.find_one({"id": tid}, {"_id": 0})

@api_router.delete("/tasks/{tid}")
async def delete_task(tid: str, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    r = await db.tasks.delete_one({"id": tid, **ff(user)})
    if r.deleted_count == 0: raise HTTPException(status_code=404, detail="Not found")
    return {"message": "Task deleted"}

# ─── Attendance Routes ─────────────────────────────────────────

@api_router.post("/attendance/clock-in")
async def clock_in(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if await db.attendance.find_one({"user_id": user["id"], "date": today}):
        raise HTTPException(status_code=400, detail="Already clocked in today")
    rec = {"id": str(uuid.uuid4()), "firm_id": user.get("firm_id", ""), "user_id": user["id"], "user_name": user["name"], "date": today, "clock_in": datetime.now(timezone.utc).isoformat(), "clock_out": None, "status": "present", "total_hours": None}
    await db.attendance.insert_one(rec)
    rec.pop("_id", None)
    return rec

@api_router.post("/attendance/clock-out")
async def clock_out(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rec = await db.attendance.find_one({"user_id": user["id"], "date": today})
    if not rec: raise HTTPException(status_code=400, detail="No clock-in found")
    if rec.get("clock_out"): raise HTTPException(status_code=400, detail="Already clocked out")
    cin = datetime.fromisoformat(rec["clock_in"])
    cout = datetime.now(timezone.utc)
    hours = round((cout - cin).total_seconds() / 3600, 2)
    status = "present" if hours >= 4 else "half_day"
    await db.attendance.update_one({"id": rec["id"]}, {"$set": {"clock_out": cout.isoformat(), "total_hours": hours, "status": status}})
    return await db.attendance.find_one({"id": rec["id"]}, {"_id": 0})

@api_router.get("/attendance")
async def list_attendance(date: Optional[str] = None, user_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {**ff(user)}
    if user["role"] == "employee": q["user_id"] = user["id"]
    elif user_id: q["user_id"] = user_id
    if date: q["date"] = date
    return await db.attendance.find(q, {"_id": 0}).sort("date", -1).to_list(1000)

@api_router.get("/attendance/today")
async def today_attendance(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if user["role"] == "employee":
        rec = await db.attendance.find_one({"user_id": user["id"], "date": today}, {"_id": 0})
        return rec or {}
    return await db.attendance.find({"date": today, **ff(user)}, {"_id": 0}).to_list(1000)

# ─── Leave Routes ──────────────────────────────────────────────

@api_router.post("/leaves")
async def apply_leave(data: LeaveCreate, user: dict = Depends(get_current_user)):
    leave = {"id": str(uuid.uuid4()), "firm_id": user.get("firm_id", ""), "user_id": user["id"], "user_name": user["name"], "leave_type": data.leave_type, "start_date": data.start_date, "end_date": data.end_date, "reason": data.reason, "status": "pending", "approved_by": None, "approved_by_name": None, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.leaves.insert_one(leave)
    leave.pop("_id", None)
    admins = await db.users.find({"role": {"$in": ["admin", "manager"]}, **ff(user)}, {"_id": 0}).to_list(100)
    for a in admins:
        await notify(a["id"], "leave_request", f"{user['name']} requested {data.leave_type} leave", leave["id"], user.get("firm_id", ""))
    return leave

@api_router.get("/leaves")
async def list_leaves(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {**ff(user)}
    if user["role"] == "employee": q["user_id"] = user["id"]
    if status: q["status"] = status
    return await db.leaves.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api_router.put("/leaves/{lid}/approve")
async def approve_leave(lid: str, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    leave = await db.leaves.find_one({"id": lid, **ff(user)}, {"_id": 0})
    if not leave: raise HTTPException(status_code=404, detail="Leave not found")
    await db.leaves.update_one({"id": lid}, {"$set": {"status": "approved", "approved_by": user["id"], "approved_by_name": user["name"]}})
    await notify(leave["user_id"], "leave_approved", f"Your {leave['leave_type']} leave approved", lid, user.get("firm_id", ""))
    return await db.leaves.find_one({"id": lid}, {"_id": 0})

@api_router.put("/leaves/{lid}/reject")
async def reject_leave(lid: str, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    leave = await db.leaves.find_one({"id": lid, **ff(user)}, {"_id": 0})
    if not leave: raise HTTPException(status_code=404, detail="Leave not found")
    await db.leaves.update_one({"id": lid}, {"$set": {"status": "rejected", "approved_by": user["id"], "approved_by_name": user["name"]}})
    await notify(leave["user_id"], "leave_rejected", f"Your {leave['leave_type']} leave rejected", lid, user.get("firm_id", ""))
    return await db.leaves.find_one({"id": lid}, {"_id": 0})

# ─── Client Routes ─────────────────────────────────────────────

@api_router.post("/clients")
async def create_client(data: ClientCreate, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    cl = {"id": str(uuid.uuid4()), "firm_id": user.get("firm_id", ""), "name": data.name, "email": data.email, "phone": data.phone, "company": data.company, "pan_number": data.pan_number, "gst_number": data.gst_number, "services": data.services, "notes": data.notes, "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.clients.insert_one(cl)
    cl.pop("_id", None)
    return cl

@api_router.get("/clients")
async def list_clients(user: dict = Depends(get_current_user)):
    return await db.clients.find({**ff(user)}, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api_router.get("/clients/{cid}")
async def get_client(cid: str, user: dict = Depends(get_current_user)):
    cl = await db.clients.find_one({"id": cid, **ff(user)}, {"_id": 0})
    if not cl: raise HTTPException(status_code=404, detail="Client not found")
    return cl

@api_router.put("/clients/{cid}")
async def update_client(cid: str, data: ClientCreate, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    await db.clients.update_one({"id": cid, **ff(user)}, {"$set": data.model_dump()})
    return await db.clients.find_one({"id": cid}, {"_id": 0})

@api_router.delete("/clients/{cid}")
async def delete_client(cid: str, user: dict = Depends(get_current_user)):
    await require_role(["admin"], user)
    r = await db.clients.delete_one({"id": cid, **ff(user)})
    if r.deleted_count == 0: raise HTTPException(status_code=404, detail="Not found")
    return {"message": "Client deleted"}

# ─── Query Routes ──────────────────────────────────────────────

@api_router.post("/queries")
async def create_query(data: QueryCreate, user: dict = Depends(get_current_user)):
    to_name = ""
    if data.to_user_id:
        to_u = await db.users.find_one({"id": data.to_user_id}, {"_id": 0})
        to_name = to_u["name"] if to_u else ""
    doc = {"id": str(uuid.uuid4()), "firm_id": user.get("firm_id", ""), "title": data.title, "description": data.description, "from_user_id": user["id"], "from_user_name": user["name"], "to_user_id": data.to_user_id or "", "to_user_name": to_name, "status": "open", "responses": [], "created_at": datetime.now(timezone.utc).isoformat()}
    await db.queries.insert_one(doc)
    doc.pop("_id", None)
    if data.to_user_id:
        await notify(data.to_user_id, "query_new", f"New query from {user['name']}: {data.title}", doc["id"], user.get("firm_id", ""))
    return doc

@api_router.get("/queries")
async def list_queries(user: dict = Depends(get_current_user)):
    if user["role"] == "employee":
        qf = {"$or": [{"from_user_id": user["id"]}, {"to_user_id": user["id"]}], **ff(user)}
    else:
        qf = {**ff(user)}
    return await db.queries.find(qf, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api_router.get("/queries/{qid}")
async def get_query(qid: str, user: dict = Depends(get_current_user)):
    q = await db.queries.find_one({"id": qid, **ff(user)}, {"_id": 0})
    if not q: raise HTTPException(status_code=404, detail="Query not found")
    return q

@api_router.post("/queries/{qid}/respond")
async def respond_to_query(qid: str, data: QueryResponseModel, user: dict = Depends(get_current_user)):
    q = await db.queries.find_one({"id": qid, **ff(user)}, {"_id": 0})
    if not q: raise HTTPException(status_code=404, detail="Query not found")
    resp = {"id": str(uuid.uuid4()), "user_id": user["id"], "user_name": user["name"], "message": data.message, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.queries.update_one({"id": qid}, {"$push": {"responses": resp}, "$set": {"status": "responded"}})
    nu = q["from_user_id"] if user["id"] != q["from_user_id"] else q.get("to_user_id", "")
    if nu:
        await notify(nu, "query_response", f"{user['name']} responded to: {q['title']}", qid, user.get("firm_id", ""))
    return await db.queries.find_one({"id": qid}, {"_id": 0})

@api_router.put("/queries/{qid}/close")
async def close_query(qid: str, user: dict = Depends(get_current_user)):
    await db.queries.update_one({"id": qid, **ff(user)}, {"$set": {"status": "closed"}})
    return await db.queries.find_one({"id": qid}, {"_id": 0})

# ─── Notification Routes ──────────────────────────────────────

@api_router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    return await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)

@api_router.put("/notifications/{nid}/read")
async def mark_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"is_read": True}})
    return {"message": "Read"}

@api_router.put("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"is_read": True}})
    return {"message": "All read"}

# ─── Daily Reports ─────────────────────────────────────────────

@api_router.post("/daily-reports")
async def create_daily_report(data: DailyReportCreate, user: dict = Depends(get_current_user)):
    existing = await db.daily_reports.find_one({"user_id": user["id"], "date": data.date, **ff(user)})
    if existing:
        await db.daily_reports.update_one({"id": existing["id"]}, {"$set": {"tasks_completed": data.tasks_completed, "total_hours": data.total_hours, "summary": data.summary, "submitted_at": datetime.now(timezone.utc).isoformat()}})
        return await db.daily_reports.find_one({"id": existing["id"]}, {"_id": 0})
    report = {"id": str(uuid.uuid4()), "firm_id": user.get("firm_id", ""), "user_id": user["id"], "user_name": user["name"], "date": data.date, "tasks_completed": data.tasks_completed, "total_hours": data.total_hours, "summary": data.summary, "submitted_at": datetime.now(timezone.utc).isoformat()}
    await db.daily_reports.insert_one(report)
    report.pop("_id", None)
    return report

@api_router.get("/daily-reports")
async def list_daily_reports(date: Optional[str] = None, user_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {**ff(user)}
    if user["role"] == "employee": q["user_id"] = user["id"]
    elif user_id: q["user_id"] = user_id
    if date: q["date"] = date
    return await db.daily_reports.find(q, {"_id": 0}).sort("date", -1).to_list(1000)

@api_router.get("/daily-reports/my/{date}")
async def get_my_report(date: str, user: dict = Depends(get_current_user)):
    r = await db.daily_reports.find_one({"user_id": user["id"], "date": date}, {"_id": 0})
    return r or {}

# ─── Compliance Deadlines ──────────────────────────────────────

@api_router.get("/compliance")
async def list_compliance(category: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {**ff(user)}
    if category: q["category"] = category
    if status: q["status"] = status
    deadlines = await db.compliance.find(q, {"_id": 0}).sort("due_date", 1).to_list(1000)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for d in deadlines:
        if d["status"] != "completed":
            if d["due_date"] < today: d["status"] = "overdue"
            elif d["due_date"] <= (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d"): d["status"] = "due_soon"
    return deadlines

@api_router.post("/compliance")
async def create_compliance(data: ComplianceCreate, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    assignee_name = ""
    if data.assigned_to:
        a = await db.users.find_one({"id": data.assigned_to}, {"_id": 0})
        assignee_name = a["name"] if a else ""
    dl = {"id": str(uuid.uuid4()), "firm_id": user.get("firm_id", ""), "title": data.title, "category": data.category, "due_date": data.due_date, "recurring": data.recurring, "description": data.description, "status": "upcoming", "assigned_to": data.assigned_to or "", "assigned_to_name": assignee_name, "is_preset": False, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.compliance.insert_one(dl)
    dl.pop("_id", None)
    return dl

@api_router.put("/compliance/{did}/status")
async def update_compliance_status(did: str, data: ComplianceStatusUpdate, user: dict = Depends(get_current_user)):
    await db.compliance.update_one({"id": did, **ff(user)}, {"$set": {"status": data.status}})
    return await db.compliance.find_one({"id": did}, {"_id": 0})

@api_router.put("/compliance/{did}/assign")
async def assign_compliance(did: str, assigned_to: str, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    a = await db.users.find_one({"id": assigned_to}, {"_id": 0})
    name = a["name"] if a else ""
    await db.compliance.update_one({"id": did, **ff(user)}, {"$set": {"assigned_to": assigned_to, "assigned_to_name": name}})
    return await db.compliance.find_one({"id": did}, {"_id": 0})

@api_router.delete("/compliance/{did}")
async def delete_compliance(did: str, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    await db.compliance.delete_one({"id": did, **ff(user)})
    return {"message": "Deleted"}

# ─── Compliance Reminder Check ─────────────────────────────────

@api_router.post("/compliance/check-reminders")
async def check_compliance_reminders(user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    week_later = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
    upcoming = await db.compliance.find({"firm_id": user.get("firm_id", ""), "status": {"$ne": "completed"}, "due_date": {"$gte": today, "$lte": week_later}}, {"_id": 0}).to_list(100)
    sent = 0
    for dl in upcoming:
        existing = await db.notifications.find_one({"reference_id": dl["id"], "type": "compliance_reminder", "created_at": {"$gte": today}})
        if not existing:
            admins = await db.users.find({"role": {"$in": ["admin", "manager"]}, **ff(user)}, {"_id": 0}).to_list(50)
            for a in admins:
                await notify(a["id"], "compliance_reminder", f"Due soon: {dl['title']} ({dl['due_date']})", dl["id"], user.get("firm_id", ""))
            if dl.get("assigned_to"):
                await notify(dl["assigned_to"], "compliance_reminder", f"Assigned to you - Due: {dl['title']} ({dl['due_date']})", dl["id"], user.get("firm_id", ""))
            # SMS to admin
            admin_user = await db.users.find_one({"role": "admin", **ff(user)}, {"_id": 0})
            if admin_user and admin_user.get("phone"):
                try:
                    phone = admin_user["phone"].strip()
                    if not phone.startswith('+'): phone = '+91' + phone
                    twilio_client.messages.create(body=f"CA.OS Reminder: {dl['title']} due on {dl['due_date']}", from_=os.environ.get('TWILIO_PHONE', ''), to=phone)
                except Exception as e:
                    logger.warning(f"SMS reminder failed: {e}")
            sent += 1
    return {"reminders_sent": sent, "deadlines_checked": len(upcoming)}

# ─── Dashboard ─────────────────────────────────────────────────

@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filt = ff(user)
    total_employees = await db.users.count_documents({"is_active": True, **filt})
    if user["role"] == "employee":
        active_tasks = await db.tasks.count_documents({"assigned_to": user["id"], "status": {"$ne": "completed"}, **filt})
        completed_tasks = await db.tasks.count_documents({"assigned_to": user["id"], "status": "completed", **filt})
    else:
        active_tasks = await db.tasks.count_documents({"status": {"$ne": "completed"}, **filt})
        completed_tasks = await db.tasks.count_documents({"status": "completed", **filt})
    present_today = await db.attendance.count_documents({"date": today, **filt})
    pending_leaves = await db.leaves.count_documents({"status": "pending", **filt})
    task_q = filt if user["role"] != "employee" else {"assigned_to": user["id"], **filt}
    recent_tasks = await db.tasks.find(task_q, {"_id": 0}).sort("created_at", -1).to_list(5)
    week_data = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        count = await db.attendance.count_documents({"date": d, **filt})
        week_data.append({"date": d, "present": count})
    # Upcoming compliance
    week_later = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
    upcoming_compliance = await db.compliance.find({"status": {"$ne": "completed"}, "due_date": {"$gte": today, "$lte": week_later}, **filt}, {"_id": 0}).sort("due_date", 1).to_list(5)
    return {"total_employees": total_employees, "active_tasks": active_tasks, "completed_tasks": completed_tasks, "present_today": present_today, "pending_leaves": pending_leaves, "recent_tasks": recent_tasks, "weekly_attendance": week_data, "upcoming_compliance": upcoming_compliance}

# ─── Login Logs ────────────────────────────────────────────────

@api_router.get("/login-logs")
async def list_login_logs(user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    return await db.login_logs.find({**ff(user)}, {"_id": 0}).sort("login_time", -1).to_list(100)

# ─── Firm Info ─────────────────────────────────────────────────

@api_router.get("/firm")
async def get_firm(user: dict = Depends(get_current_user)):
    firm = await db.firms.find_one({"id": user.get("firm_id", "")}, {"_id": 0})
    return firm or {}

# ─── Router & Middleware ───────────────────────────────────────

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','), allow_methods=["*"], allow_headers=["*"])

# ─── Seed Default Firm + Admin ─────────────────────────────────

@app.on_event("startup")
async def seed_data():
    admin = await db.users.find_one({"email": "admin@caos.com"})
    if not admin:
        firm_id = str(uuid.uuid4())
        await db.firms.insert_one({"id": firm_id, "name": "Default CA Firm", "phone": "", "address": "", "gstin": "", "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()})
        await db.users.insert_one({"id": str(uuid.uuid4()), "firm_id": firm_id, "email": "admin@caos.com", "password_hash": pwd_context.hash("admin123"), "name": "Admin User", "role": "admin", "department": "Management", "phone": "", "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()})
        await seed_compliance_for_firm(firm_id)
        logger.info("Default firm + admin seeded: admin@caos.com / admin123")
    else:
        # Ensure existing users have firm_id
        if not admin.get("firm_id"):
            firm = await db.firms.find_one({})
            if not firm:
                firm_id = str(uuid.uuid4())
                await db.firms.insert_one({"id": firm_id, "name": "Default CA Firm", "phone": "", "address": "", "gstin": "", "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()})
                await seed_compliance_for_firm(firm_id)
            else:
                firm_id = firm["id"]
            await db.users.update_many({"firm_id": {"$exists": False}}, {"$set": {"firm_id": firm_id}})
            await db.users.update_many({"firm_id": ""}, {"$set": {"firm_id": firm_id}})
            for coll in ["tasks", "attendance", "leaves", "clients", "queries", "notifications", "login_logs", "daily_reports"]:
                await db[coll].update_many({"firm_id": {"$exists": False}}, {"$set": {"firm_id": firm_id}})
                await db[coll].update_many({"firm_id": ""}, {"$set": {"firm_id": firm_id}})
            logger.info(f"Migrated existing data to firm {firm_id}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

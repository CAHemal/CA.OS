from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Pydantic Models ───────────────────────────────────────────

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

class QueryResponse(BaseModel):
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

# ─── Auth Helpers ──────────────────────────────────────────────

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_role(roles: list, user: dict):
    if user["role"] not in roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

async def create_notification(user_id: str, ntype: str, message: str, reference_id: str = ""):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": ntype,
        "message": message,
        "reference_id": reference_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(doc)

# ─── Auth Routes ───────────────────────────────────────────────

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user or not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")
    token = create_token(user["id"], user["role"])
    # Record login time
    await db.login_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "login_time": datetime.now(timezone.utc).isoformat()
    })
    user_safe = {k: v for k, v in user.items() if k != "password_hash"}
    return {"token": token, "user": user_safe}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

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
    new_user = {
        "id": str(uuid.uuid4()),
        "email": req.email,
        "password_hash": pwd_context.hash(req.password),
        "name": req.name,
        "role": req.role,
        "department": req.department,
        "phone": req.phone,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_user)
    new_user.pop("password_hash")
    new_user.pop("_id", None)
    return new_user

# ─── Employee Routes ───────────────────────────────────────────

@api_router.get("/employees")
async def list_employees(user: dict = Depends(get_current_user)):
    employees = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return employees

@api_router.get("/employees/{employee_id}")
async def get_employee(employee_id: str, user: dict = Depends(get_current_user)):
    emp = await db.users.find_one({"id": employee_id}, {"_id": 0, "password_hash": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp

@api_router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, data: EmployeeUpdate, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "role" in updates and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can change roles")
    if updates:
        await db.users.update_one({"id": employee_id}, {"$set": updates})
    updated = await db.users.find_one({"id": employee_id}, {"_id": 0, "password_hash": 0})
    return updated

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, user: dict = Depends(get_current_user)):
    await require_role(["admin"], user)
    result = await db.users.delete_one({"id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deleted"}

# ─── Task Routes ───────────────────────────────────────────────

@api_router.post("/tasks")
async def create_task(data: TaskCreate, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    assignee = await db.users.find_one({"id": data.assigned_to}, {"_id": 0})
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found")
    client_name = ""
    if data.client_id:
        cl = await db.clients.find_one({"id": data.client_id}, {"_id": 0})
        client_name = cl["name"] if cl else ""
    task = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "description": data.description,
        "assigned_to": data.assigned_to,
        "assigned_to_name": assignee["name"],
        "assigned_by": user["id"],
        "assigned_by_name": user["name"],
        "client_id": data.client_id or "",
        "client_name": client_name,
        "status": "pending",
        "priority": data.priority,
        "due_date": data.due_date,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tasks.insert_one(task)
    task.pop("_id", None)
    await create_notification(data.assigned_to, "task_assigned", f"New task assigned: {data.title}", task["id"])
    return task

@api_router.get("/tasks")
async def list_tasks(status: Optional[str] = None, priority: Optional[str] = None, assigned_to: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "employee":
        query["assigned_to"] = user["id"]
    elif assigned_to:
        query["assigned_to"] = assigned_to
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    tasks = await db.tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return tasks

@api_router.get("/tasks/{task_id}")
async def get_task(task_id: str, user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: TaskCreate, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    updates = data.model_dump()
    assignee = await db.users.find_one({"id": data.assigned_to}, {"_id": 0})
    if assignee:
        updates["assigned_to_name"] = assignee["name"]
    if data.client_id:
        cl = await db.clients.find_one({"id": data.client_id}, {"_id": 0})
        updates["client_name"] = cl["name"] if cl else ""
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.tasks.update_one({"id": task_id}, {"$set": updates})
    updated = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return updated

@api_router.put("/tasks/{task_id}/status")
async def update_task_status(task_id: str, data: TaskStatusUpdate, user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if user["role"] == "employee" and task["assigned_to"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your task")
    await db.tasks.update_one({"id": task_id}, {"$set": {"status": data.status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    if data.status == "completed":
        await create_notification(task["assigned_by"], "task_updated", f"Task completed: {task['title']}", task_id)
    updated = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return updated

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}

# ─── Attendance Routes ─────────────────────────────────────────

@api_router.post("/attendance/clock-in")
async def clock_in(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.attendance.find_one({"user_id": user["id"], "date": today})
    if existing:
        raise HTTPException(status_code=400, detail="Already clocked in today")
    record = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "date": today,
        "clock_in": datetime.now(timezone.utc).isoformat(),
        "clock_out": None,
        "status": "present",
        "total_hours": None
    }
    await db.attendance.insert_one(record)
    record.pop("_id", None)
    return record

@api_router.post("/attendance/clock-out")
async def clock_out(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    record = await db.attendance.find_one({"user_id": user["id"], "date": today})
    if not record:
        raise HTTPException(status_code=400, detail="No clock-in found for today")
    if record.get("clock_out"):
        raise HTTPException(status_code=400, detail="Already clocked out today")
    clock_in_time = datetime.fromisoformat(record["clock_in"])
    clock_out_time = datetime.now(timezone.utc)
    total_hours = round((clock_out_time - clock_in_time).total_seconds() / 3600, 2)
    status = "present" if total_hours >= 4 else "half_day"
    await db.attendance.update_one(
        {"id": record["id"]},
        {"$set": {"clock_out": clock_out_time.isoformat(), "total_hours": total_hours, "status": status}}
    )
    updated = await db.attendance.find_one({"id": record["id"]}, {"_id": 0})
    return updated

@api_router.get("/attendance")
async def list_attendance(date: Optional[str] = None, user_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "employee":
        query["user_id"] = user["id"]
    elif user_id:
        query["user_id"] = user_id
    if date:
        query["date"] = date
    records = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return records

@api_router.get("/attendance/today")
async def today_attendance(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if user["role"] == "employee":
        record = await db.attendance.find_one({"user_id": user["id"], "date": today}, {"_id": 0})
        return record or {}
    records = await db.attendance.find({"date": today}, {"_id": 0}).to_list(1000)
    return records

# ─── Leave Routes ──────────────────────────────────────────────

@api_router.post("/leaves")
async def apply_leave(data: LeaveCreate, user: dict = Depends(get_current_user)):
    leave = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "leave_type": data.leave_type,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "reason": data.reason,
        "status": "pending",
        "approved_by": None,
        "approved_by_name": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.leaves.insert_one(leave)
    leave.pop("_id", None)
    admins = await db.users.find({"role": {"$in": ["admin", "manager"]}}, {"_id": 0}).to_list(100)
    for admin in admins:
        await create_notification(admin["id"], "leave_request", f"{user['name']} requested {data.leave_type} leave", leave["id"])
    return leave

@api_router.get("/leaves")
async def list_leaves(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "employee":
        query["user_id"] = user["id"]
    if status:
        query["status"] = status
    leaves = await db.leaves.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return leaves

@api_router.put("/leaves/{leave_id}/approve")
async def approve_leave(leave_id: str, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    leave = await db.leaves.find_one({"id": leave_id}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    await db.leaves.update_one({"id": leave_id}, {"$set": {"status": "approved", "approved_by": user["id"], "approved_by_name": user["name"]}})
    await create_notification(leave["user_id"], "leave_approved", f"Your {leave['leave_type']} leave has been approved", leave_id)
    updated = await db.leaves.find_one({"id": leave_id}, {"_id": 0})
    return updated

@api_router.put("/leaves/{leave_id}/reject")
async def reject_leave(leave_id: str, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    leave = await db.leaves.find_one({"id": leave_id}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    await db.leaves.update_one({"id": leave_id}, {"$set": {"status": "rejected", "approved_by": user["id"], "approved_by_name": user["name"]}})
    await create_notification(leave["user_id"], "leave_rejected", f"Your {leave['leave_type']} leave has been rejected", leave_id)
    updated = await db.leaves.find_one({"id": leave_id}, {"_id": 0})
    return updated

# ─── Client Routes ─────────────────────────────────────────────

@api_router.post("/clients")
async def create_client(data: ClientCreate, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    cl = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "company": data.company,
        "pan_number": data.pan_number,
        "gst_number": data.gst_number,
        "services": data.services,
        "notes": data.notes,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.clients.insert_one(cl)
    cl.pop("_id", None)
    return cl

@api_router.get("/clients")
async def list_clients(user: dict = Depends(get_current_user)):
    clients = await db.clients.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return clients

@api_router.get("/clients/{client_id}")
async def get_client(client_id: str, user: dict = Depends(get_current_user)):
    cl = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not cl:
        raise HTTPException(status_code=404, detail="Client not found")
    return cl

@api_router.put("/clients/{client_id}")
async def update_client(client_id: str, data: ClientCreate, user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    updates = data.model_dump()
    await db.clients.update_one({"id": client_id}, {"$set": updates})
    updated = await db.clients.find_one({"id": client_id}, {"_id": 0})
    return updated

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user: dict = Depends(get_current_user)):
    await require_role(["admin"], user)
    result = await db.clients.delete_one({"id": client_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Client deleted"}

# ─── Query Routes ──────────────────────────────────────────────

@api_router.post("/queries")
async def create_query(data: QueryCreate, user: dict = Depends(get_current_user)):
    to_user_name = ""
    if data.to_user_id:
        to_user = await db.users.find_one({"id": data.to_user_id}, {"_id": 0})
        to_user_name = to_user["name"] if to_user else ""
    query_doc = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "description": data.description,
        "from_user_id": user["id"],
        "from_user_name": user["name"],
        "to_user_id": data.to_user_id or "",
        "to_user_name": to_user_name,
        "status": "open",
        "responses": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.queries.insert_one(query_doc)
    query_doc.pop("_id", None)
    if data.to_user_id:
        await create_notification(data.to_user_id, "query_new", f"New query from {user['name']}: {data.title}", query_doc["id"])
    return query_doc

@api_router.get("/queries")
async def list_queries(user: dict = Depends(get_current_user)):
    if user["role"] == "employee":
        query_filter = {"$or": [{"from_user_id": user["id"]}, {"to_user_id": user["id"]}]}
    else:
        query_filter = {}
    queries = await db.queries.find(query_filter, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return queries

@api_router.get("/queries/{query_id}")
async def get_query(query_id: str, user: dict = Depends(get_current_user)):
    q = await db.queries.find_one({"id": query_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Query not found")
    return q

@api_router.post("/queries/{query_id}/respond")
async def respond_to_query(query_id: str, data: QueryResponse, user: dict = Depends(get_current_user)):
    q = await db.queries.find_one({"id": query_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Query not found")
    response_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "message": data.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.queries.update_one({"id": query_id}, {"$push": {"responses": response_doc}, "$set": {"status": "responded"}})
    notify_user = q["from_user_id"] if user["id"] != q["from_user_id"] else q.get("to_user_id", "")
    if notify_user:
        await create_notification(notify_user, "query_response", f"{user['name']} responded to: {q['title']}", query_id)
    updated = await db.queries.find_one({"id": query_id}, {"_id": 0})
    return updated

@api_router.put("/queries/{query_id}/close")
async def close_query(query_id: str, user: dict = Depends(get_current_user)):
    await db.queries.update_one({"id": query_id}, {"$set": {"status": "closed"}})
    updated = await db.queries.find_one({"id": query_id}, {"_id": 0})
    return updated

# ─── Notification Routes ──────────────────────────────────────

@api_router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": notification_id, "user_id": user["id"]}, {"$set": {"is_read": True}})
    return {"message": "Marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"is_read": True}})
    return {"message": "All marked as read"}

# ─── Dashboard Route ───────────────────────────────────────────

@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total_employees = await db.users.count_documents({"is_active": True})
    if user["role"] == "employee":
        active_tasks = await db.tasks.count_documents({"assigned_to": user["id"], "status": {"$ne": "completed"}})
        completed_tasks = await db.tasks.count_documents({"assigned_to": user["id"], "status": "completed"})
    else:
        active_tasks = await db.tasks.count_documents({"status": {"$ne": "completed"}})
        completed_tasks = await db.tasks.count_documents({"status": "completed"})
    present_today = await db.attendance.count_documents({"date": today})
    pending_leaves = await db.leaves.count_documents({"status": "pending"})
    recent_tasks = await db.tasks.find({} if user["role"] != "employee" else {"assigned_to": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(5)
    # Weekly attendance for chart
    week_data = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        count = await db.attendance.count_documents({"date": d})
        week_data.append({"date": d, "present": count})
    return {
        "total_employees": total_employees,
        "active_tasks": active_tasks,
        "completed_tasks": completed_tasks,
        "present_today": present_today,
        "pending_leaves": pending_leaves,
        "recent_tasks": recent_tasks,
        "weekly_attendance": week_data
    }

# ─── Login Logs ────────────────────────────────────────────────

@api_router.get("/login-logs")
async def list_login_logs(user: dict = Depends(get_current_user)):
    await require_role(["admin", "manager"], user)
    logs = await db.login_logs.find({}, {"_id": 0}).sort("login_time", -1).to_list(100)
    return logs

# ─── Include Router & Middleware ───────────────────────────────

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Seed Admin on Startup ────────────────────────────────────

@app.on_event("startup")
async def seed_admin():
    admin = await db.users.find_one({"role": "admin"})
    if not admin:
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@caos.com",
            "password_hash": pwd_context.hash("admin123"),
            "name": "Admin User",
            "role": "admin",
            "department": "Management",
            "phone": "",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        logger.info("Admin user seeded: admin@caos.com / admin123")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

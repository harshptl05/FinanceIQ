from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.database import get_db

router = APIRouter()


class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/signup")
def signup(req: SignupRequest):
    db = get_db()
    try:
        result = db.auth.sign_up({"email": req.email, "password": req.password})
        user = result.user
        if not user:
            raise HTTPException(status_code=400, detail="Signup failed")
        db.table("user_profiles").insert(
            {"id": user.id, "full_name": req.full_name}
        ).execute()
        return {"user_id": user.id, "email": user.email}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
def login(req: LoginRequest):
    db = get_db()
    try:
        result = db.auth.sign_in_with_password({"email": req.email, "password": req.password})
        session = result.session
        if not session:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return {
            "access_token": session.access_token,
            "user_id": result.user.id,
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

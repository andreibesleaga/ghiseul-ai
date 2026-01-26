import hashlib
import time
from http_service import HttpService

class AuthService:
    def __init__(self, base_url, login_name, password):
        self.http = HttpService(base_url)
        self.login_name = login_name
        self.password = password
        self.access_token = None
        self.refresh_token = None
        self.token_expiry = 0

    def _hash_password(self, password: str) -> str:
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    async def login(self):
        enc_password = self._hash_password(self.password)
        data = await self.http.post("/api/auth/login", {
            "loginName": self.login_name,
            "encPassword": enc_password
        })
        self.access_token = data["accessToken"]
        self.refresh_token = data["refreshToken"]
        self.token_expiry = time.time() + data.get("expiresIn", 15 * 60)
        return data

    async def refresh(self):
        data = await self.http.post("/auth/refresh-token", {
            "refreshToken": self.refresh_token
        })
        self.access_token = data["accessToken"]
        self.refresh_token = data.get("refreshToken", self.refresh_token)
        self.token_expiry = time.time() + data.get("expiresIn", 15 * 60)
        return data

    async def get_token(self):
        if not self.access_token or time.time() >= self.token_expiry - 30:
            try:
                await self.refresh()
            except Exception:
                await self.login()
        return self.access_token

    async def auth_headers(self):
        token = await self.get_token()
        return {"Authorization": f"Bearer {token}"}

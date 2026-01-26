from fastapi import FastAPI, Depends
from auth_service import AuthService
import uvicorn
import os

app = FastAPI()

auth = AuthService(
    os.getenv("AUTH_SERVICE_URL", "https://genie-ai.itu.int/"),
    os.getenv("AUTH_SERVICE_USERNAME", "genie-ai-manager"),
    os.getenv("AUTH_SERVICE_PASSWORD", "1357924680+Manager")
)

@app.get("/get-token")
async def get_token():
    """Test route: log in and return access + refresh tokens"""
    try:
        data = await auth.login()
        accessToken = data.get("accessToken")
        if accessToken:
            return {"accessToken": accessToken}
        else:
            return {"error": "No access token received"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=6666)
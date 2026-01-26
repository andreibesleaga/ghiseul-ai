import httpx

class HttpService:
    def __init__(self, base_url: str, default_headers: dict = None):
        self.base_url = base_url.rstrip("/")
        self.default_headers = default_headers or {}

    async def get(self, endpoint: str, headers: dict = None):
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.base_url}{endpoint}",
                                    headers={**self.default_headers, **(headers or {})})
            resp.raise_for_status()
            return resp.json()

    async def post(self, endpoint: str, data: dict = None, headers: dict = None):
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.base_url}{endpoint}",
                                     json=data,
                                     headers={**self.default_headers, **(headers or {})})
            resp.raise_for_status()
            return resp.json()
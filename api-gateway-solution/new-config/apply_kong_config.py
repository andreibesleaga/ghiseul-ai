import json
import requests
import sys
import time
import os

# Configuration defaults
KONG_ADMIN_URL = os.environ.get("KONG_ADMIN_URL", "http://localhost:8001")
CONFIG_FILE = "kong_config.json"

def log(msg):
    print(f"[LOG] {msg}")

def wait_for_kong():
    """Wait for Kong Admin API to be available"""
    max_retries = 30
    for i in range(max_retries):
        try:
            resp = requests.get(KONG_ADMIN_URL)
            if resp.status_code == 200:
                log("Kong Admin API is available")
                return True
        except requests.exceptions.ConnectionError:
            pass
        log(f"Waiting for Kong Admin API... ({i+1}/{max_retries})")
        time.sleep(2)
    return False

def apply_config():
    log(f"Reading config file: {CONFIG_FILE}")
    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
    except Exception as e:
        log(f"Failed to load config file: {e}")
        return False

    # 1. Services
    for service in config.get('services', []):
        name = service['name']
        log(f"Processing service: {name}")
        payload = {k:v for k,v in service.items() if k not in ['id', 'created_at', 'updated_at']}
        
        # Check if exists
        try:
            resp = requests.put(f"{KONG_ADMIN_URL}/services/{name}", json=payload)
            if resp.status_code not in [200, 201]:
                log(f"Error applying service {name}: {resp.text}")
        except Exception as e:
            log(f"Exception applying service {name}: {e}")

    # 2. Routes
    for route in config.get('routes', []):
        name = route['name']
        log(f"Processing route: {name}")
        route_copy = route.copy() 
        plugins = route_copy.pop('plugins', [])
        
        payload = {k:v for k,v in route_copy.items() if k not in ['id', 'created_at', 'updated_at']}
        try:
            resp = requests.put(f"{KONG_ADMIN_URL}/routes/{name}", json=payload)
            if resp.status_code not in [200, 201]:
                log(f"Error applying route {name}: {resp.text}")
                continue
            
            # Plugins for route
            for plugin in plugins:
                p_name = plugin['name']
                log(f"Processing plugin {p_name} for route {name}")
                p_payload = {k:v for k,v in plugin.items() if k not in ['id', 'created_at', 'updated_at']}
                p_payload['route'] = {'name': name}
                
                # Check if exists (using GET on plugins list for the route)
                existing_resp = requests.get(f"{KONG_ADMIN_URL}/routes/{name}/plugins")
                if existing_resp.status_code == 200:
                    existing = existing_resp.json().get('data', [])
                    existing_id = next((p['id'] for p in existing if p['name'] == p_name), None)
                    
                    if existing_id:
                        requests.patch(f"{KONG_ADMIN_URL}/plugins/{existing_id}", json=p_payload)
                    else:
                        requests.post(f"{KONG_ADMIN_URL}/routes/{name}/plugins", json=p_payload)
        except Exception as e:
            log(f"Exception processing route {name}: {e}")

    # 3. Global/Service Plugins
    for plugin in config.get('plugins', []):
        p_name = plugin['name']
        log(f"Processing global/service plugin {p_name}")
        payload = {k:v for k,v in plugin.items() if k not in ['id', 'created_at', 'updated_at']}
        
        endpoint = f"{KONG_ADMIN_URL}/plugins"
        target_check_url = endpoint
        
        if 'service' in plugin:
             svc_name = plugin['service']['name']
             endpoint = f"{KONG_ADMIN_URL}/services/{svc_name}/plugins"
             target_check_url = endpoint
        
        try:
            existing_resp = requests.get(target_check_url)
            if existing_resp.status_code == 200:
                existing = existing_resp.json().get('data', [])
                existing_id = next((p['id'] for p in existing if p['name'] == p_name), None)
                
                if existing_id:
                    requests.patch(f"{KONG_ADMIN_URL}/plugins/{existing_id}", json=payload)
                else:
                    requests.post(endpoint, json=payload)
        except Exception as e:
            log(f"Exception processing plugin {p_name}: {e}")

    # 4. Upstreams
    for upstream in config.get('upstreams', []):
        name = upstream['name']
        log(f"Processing upstream: {name}")
        payload = {k:v for k,v in upstream.items() if k not in ['id', 'created_at', 'updated_at']}
        try:
            requests.put(f"{KONG_ADMIN_URL}/upstreams/{name}", json=payload)
        except Exception as e:
            log(f"Exception processing upstream {name}: {e}")

    # 5. Targets
    for target in config.get('targets', []):
        t_addr = target['target']
        t_upstream_id = target['upstream']['id']
        # Find upstream name by ID in the config
        upstream_name = next((u['name'] for u in config['upstreams'] if u['id'] == t_upstream_id), None)
        
        # Fallback: if upstream name logic matches what we expect (e.g. backend:3000 -> express-api-servers)
        # config.json usually links them. 
        if not upstream_name:
             log(f"Warning: Could not find upstream name for target {t_addr} in config file.")
             continue
             
        log(f"Processing target {t_addr} for upstream {upstream_name}")
        try:
            requests.post(f"{KONG_ADMIN_URL}/upstreams/{upstream_name}/targets", json={'target': t_addr})
        except Exception as e:
             log(f"Error processing target {t_addr}: {e}")

    return True

def fix_auth():
    log("Fixing auth routes (removing JWT plugin if present)...")
    auth_routes = ["auth-login-route", "auth-refresh-route", "auth-route"]
    for route in auth_routes:
        try:
            resp = requests.get(f"{KONG_ADMIN_URL}/routes/{route}/plugins")
            if resp.status_code == 200:
                plugins = resp.json().get('data', [])
                jwt_plugin = next((p for p in plugins if p['name'] == 'jwt'), None)
                if jwt_plugin:
                    log(f"Removing JWT plugin from {route}")
                    requests.delete(f"{KONG_ADMIN_URL}/plugins/{jwt_plugin['id']}")
        except Exception as e:
            log(f"Error fixing auth for {route}: {e}")

if __name__ == "__main__":
    if wait_for_kong():
        apply_config()
        fix_auth()
    else:
        log("Could not connect to Kong. Aborting configuration.")
        sys.exit(1)

#!/bin/bash
#
# start.sh
# Starts the Vue app in the background using nohup and stores the PID in 'server.pid'.

# Move into your app's directory (adjust path as needed)
cd /root/chat-ui-vue-app/gov-chat-app

echo "Starting app..."
nohup npm run serve > server.log 2>&1 &

# Capture the PID of the last background command ($!)
echo $! > server.pid

echo "App started with PID $(cat server.pid). Logs are in server.log."


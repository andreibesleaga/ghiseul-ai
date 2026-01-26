#!/bin/bash
#
# stop.sh
# Stops the Vue app by killing the PID stored in 'server.pid'.

# Move into your app's directory (adjust path as needed)
cd /root/chat-ui-vue-app/gov-chat-app

# Read the PID from server.pid
if [ -f server.pid ]; then
  PID=$(cat server.pid)
  echo "Stopping app with PID $PID..."
  kill "$PID"
  rm server.pid
  echo "App stopped."
else
  echo "No server.pid file found. Is the app running?"
fi


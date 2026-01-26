#!/bin/bash
echo "#Starting ClamAV daemon..."
freshclam --quiet --no-warnings || true
clamd &
CLAMD_PID=$!

echo "Wait a moment for clamav to start"
sleep 15

while ! clamdscan --version > /dev/null 2>&1; do
    echo "Waiting for ClamAV daemon to start..."  
    sleep 5
done

echo "ClamAV daemon started successfully"
echo "Starting Node.js application..."
exec node src/server.js
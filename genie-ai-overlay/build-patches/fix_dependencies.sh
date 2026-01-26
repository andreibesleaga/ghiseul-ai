#!/bin/sh
set -e

REQUIREMENTS_FILE=$1

if [ -f "$REQUIREMENTS_FILE" ]; then
    echo "Patching $REQUIREMENTS_FILE to fix dependencies..."

    # 1. Remove the non-existent Pathway dependency
    sed -i '/pathway==0.3.3/d' "$REQUIREMENTS_FILE"

    # 2. Remove the conflicting graspologic dependency
    sed -i '/graspologic==3.4.1/d' "$REQUIREMENTS_FILE"

    # 3. (NEW) Swap psycopg2 for psycopg2-binary to avoid compiling from source
    sed -i 's/psycopg2==2.9.10/psycopg2-binary==2.9.10/' "$REQUIREMENTS_FILE"

    echo "Patching complete. Dependencies fixed."
else
    echo "Warning: requirements file $REQUIREMENTS_FILE not found. Skipping patch."
fi
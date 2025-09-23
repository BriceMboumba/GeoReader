#!/bin/bash

# Launch the frontend (Vue.js)
npm run dev &
FRONT_PID=$!

# Launch back (Electron)
npm run electron &
ELECTRON_PID=$!

# Function to kill both processes cleanly
cleanup() {
    echo "Stopping processes..."
    kill -TERM $FRONT_PID 2>/dev/null
    kill -TERM $ELECTRON_PID 2>/dev/null
    wait $FRONT_PID 2>/dev/null
    wait $ELECTRON_PID 2>/dev/null
    exit 0
}

# Intercept Ctrl+C (SIGINT) and SIGTERM
trap cleanup SIGINT SIGTERM

# Wait for one of the two to die
wait -n $FRONT_PID $ELECTRON_PID

# If we get here, it's because one of the two is finished → we kill the other
cleanup

#!/usr/bin/env bash
# Serve the game locally (games need HTTP; file:// won't work).
PORT="${PORT:-8000}"
python3 -m http.server "$PORT" --bind 0.0.0.0

# Hermes Dashboard

Local web dashboard for Hermes Agent stats & config.

## Run

```bash
cd /media/dev/.../hermes-dashboard

# Install deps
pip install flask flask-cors pyyaml

# Start
python app.py
# → http://localhost:9300
```

## What it shows
- Model config (provider, model, toolsets)
- Skills list with timestamps
- Memory entries count
- Cron jobs
- Session stats from state.db
- System info (version, Python, HERMES_HOME)

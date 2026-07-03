"""
Hermes Dashboard — Local dashboard for Hermes Agent stats & config.

Reads:
- ~/.hermes/config.yaml → provider, model, toolsets
- ~/.hermes/memories/MEMORY.md → memory count
- ~/.hermes/skills/ → skill list
- ~/.hermes/state.db → session stats (via sqlite3)
- ~/.hermes/cron/ → cron jobs
"""
import json
import os
import re
import shutil
import sqlite3
import subprocess
from pathlib import Path
from datetime import datetime, timezone

try:
    import yaml
except ImportError:
    yaml = None

HERMES_HOME = Path.home() / ".hermes"

# ── Data collectors ───────────────────────────

def get_config():
    """Parse Hermes config.yaml"""
    path = HERMES_HOME / "config.yaml"
    if not path.exists():
        return {"error": "config.yaml not found"}
    try:
        with open(path) as f:
            cfg = yaml.safe_load(f) if yaml else {}
        return {
            "model": cfg.get("model", {}),
            "toolsets": cfg.get("toolsets", []),
            "agent": cfg.get("agent", {}),
            "providers": list(cfg.get("providers", {}).keys()),
            "approvals": cfg.get("approvals", {}),
        }
    except Exception as e:
        return {"error": str(e)}


def get_memories():
    """Read memories directory"""
    mem_dir = HERMES_HOME / "memories"
    if not mem_dir.exists():
        return {"memory_count": 0, "user_count": 0}
    mem_file = mem_dir / "MEMORY.md"
    user_file = mem_dir / "USER.md"
    return {
        "memory_count": len(mem_file.read_text().split("\n")) if mem_file.exists() else 0,
        "user_count": len(user_file.read_text().split("\n")) if user_file.exists() else 0,
        "last_modified": datetime.fromtimestamp(
            max(
                mem_file.stat().st_mtime if mem_file.exists() else 0,
                user_file.stat().st_mtime if user_file.exists() else 0,
            )
        ).isoformat() if (mem_file.exists() or user_file.exists()) else None,
    }


def parse_skill_description(skill_file):
    """Extract description from SKILL.md YAML frontmatter"""
    try:
        text = skill_file.read_text(encoding="utf-8", errors="replace")
        if not text.startswith("---"):
            return ""
        end = text.find("\n---", 3)
        if end == -1:
            return ""
        front = text[3:end]
        if yaml:
            meta = yaml.safe_load(front) or {}
            desc = meta.get("description", "")
            return str(desc).strip() if desc else ""
        for line in front.splitlines():
            if line.startswith("description:"):
                return line.split(":", 1)[1].strip()
        return ""
    except Exception:
        return ""


def _skill_entry(skill_dir, category):
    skill_file = skill_dir / "SKILL.md"
    return {
        "name": skill_dir.name,
        "description": parse_skill_description(skill_file),
        "category": category,
        "path": str(skill_dir),
        "modified": datetime.fromtimestamp(skill_file.stat().st_mtime).isoformat(),
    }


def get_skills():
    """List skills grouped by category (subfolder)"""
    skills_dir = HERMES_HOME / "skills"
    if not skills_dir.exists():
        return {"count": 0, "categories": {}}
    categories = {}
    count = 0
    for d in sorted(skills_dir.iterdir()):
        if not d.is_dir() or d.name.startswith("."):
            continue
        if (d / "SKILL.md").exists():
            categories.setdefault("general", []).append(_skill_entry(d, "general"))
            count += 1
            continue
        for sub in sorted(d.iterdir()):
            if sub.is_dir() and not sub.name.startswith(".") and (sub / "SKILL.md").exists():
                categories.setdefault(d.name, []).append(_skill_entry(sub, d.name))
                count += 1
    return {"count": count, "categories": categories}


# ── Config editing ────────────────────────────

def _config_path():
    return HERMES_HOME / "config.yaml"


def _load_full_config():
    with open(_config_path()) as f:
        return yaml.safe_load(f) or {}


def _save_full_config(cfg):
    """Backup then write config.yaml"""
    path = _config_path()
    backup = path.with_name(f"config.yaml.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    shutil.copy2(path, backup)
    with open(path, "w") as f:
        yaml.safe_dump(cfg, f, sort_keys=False, allow_unicode=True, default_flow_style=False)


def set_config_key(dotted_path, value):
    cfg = _load_full_config()
    keys = dotted_path.split(".")
    node = cfg
    for k in keys[:-1]:
        if not isinstance(node.get(k), dict):
            node[k] = {}
        node = node[k]
    node[keys[-1]] = value
    _save_full_config(cfg)


def delete_config_key(dotted_path):
    cfg = _load_full_config()
    keys = dotted_path.split(".")
    node = cfg
    for k in keys[:-1]:
        node = node.get(k)
        if not isinstance(node, dict):
            raise KeyError(dotted_path)
    if keys[-1] not in node:
        raise KeyError(dotted_path)
    del node[keys[-1]]
    _save_full_config(cfg)


CRON_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
CRON_FIELDS = ("schedule", "prompt", "skills", "repeat", "deliver")


def _cron_dir():
    d = HERMES_HOME / "cron"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _cron_path(name):
    """Resolve a cron job file, rejecting names that could escape ~/.hermes/cron"""
    if not CRON_NAME_RE.match(name):
        raise ValueError(f"invalid cron name: {name!r}")
    return _cron_dir() / f"{name}.json"


def get_cron_jobs():
    """List cron jobs with full details"""
    cron_dir = HERMES_HOME / "cron"
    if not cron_dir.exists():
        return {"count": 0, "jobs": []}
    jobs = []
    for f in sorted(cron_dir.iterdir()):
        if f.suffix == ".json":
            try:
                data = json.loads(f.read_text())
                jobs.append({
                    "name": data.get("name", f.stem),
                    "schedule": data.get("schedule", "?"),
                    "prompt": data.get("prompt", ""),
                    "skills": data.get("skills", []),
                    "repeat": data.get("repeat", True),
                    "deliver": data.get("deliver", False),
                    "last_run": data.get("last_run", None),
                    "status": data.get("status", "unknown"),
                })
            except:
                pass
    return {"count": len(jobs), "jobs": jobs}


def create_cron_job(body):
    name = str(body.get("name", "")).strip()
    path = _cron_path(name)
    if path.exists():
        raise FileExistsError(name)
    job = {"name": name}
    for k in CRON_FIELDS:
        if k in body:
            job[k] = body[k]
    job.setdefault("skills", [])
    job.setdefault("repeat", True)
    job.setdefault("deliver", False)
    job["created"] = datetime.now(timezone.utc).isoformat()
    path.write_text(json.dumps(job, indent=2, ensure_ascii=False))
    return job


def update_cron_job(name, body):
    path = _cron_path(name)
    if not path.exists():
        raise FileNotFoundError(name)
    job = json.loads(path.read_text())
    for k in CRON_FIELDS:
        if k in body:
            job[k] = body[k]
    job["name"] = name
    job["updated"] = datetime.now(timezone.utc).isoformat()
    path.write_text(json.dumps(job, indent=2, ensure_ascii=False))
    return job


def delete_cron_job(name):
    path = _cron_path(name)
    if not path.exists():
        raise FileNotFoundError(name)
    path.unlink()


def get_sessions():
    """Read Hermes SQLite state.db for session stats"""
    db_path = HERMES_HOME / "state.db"
    if not db_path.exists():
        return {"count": 0}
    try:
        conn = sqlite3.connect(str(db_path))
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM sessions")
        count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM conversations")
        conv_count = cur.fetchone()[0]
        conn.close()
        return {"session_count": count, "conversation_count": conv_count}
    except Exception as e:
        return {"error": str(e)}


def _fmt_ts(ts):
    """Format timestamp to ISO string for last-seen display"""
    if ts is None:
        return None
    try:
        return datetime.fromtimestamp(float(ts), tz=timezone.utc).isoformat()
    except (ValueError, OSError, OverflowError):
        s = str(ts)
        if len(s) >= 19 and s[4] == "-":
            return s[:19]
        return str(ts)[:19]


def _session_date(started_at):
    """Normalize sessions.started_at (unix epoch or ISO string) to YYYY-MM-DD"""
    if started_at is None:
        return None
    s = str(started_at)
    try:
        return datetime.fromtimestamp(float(s)).strftime("%Y-%m-%d")
    except (ValueError, OSError, OverflowError):
        pass
    if len(s) >= 10 and s[4] == "-":
        return s[:10]
    return None


def _usage_rows_from_db():
    """Yield (model, input_tokens, output_tokens, cost, started_at) from state.db"""
    db_path = HERMES_HOME / "state.db"
    if not db_path.exists():
        return None
    conn = sqlite3.connect(str(db_path))
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT model,
                   COALESCE(input_tokens, 0),
                   COALESCE(output_tokens, 0),
                   COALESCE(actual_cost_usd, estimated_cost_usd, 0),
                   started_at
            FROM sessions
            WHERE model IS NOT NULL AND model != ''
            """
        )
        return cur.fetchall()
    finally:
        conn.close()


def _usage_rows_from_jsonl():
    """Fallback: parse ~/.hermes/sessions.jsonl conversation log"""
    path = HERMES_HOME / "sessions.jsonl"
    if not path.exists():
        return None
    rows = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        model = rec.get("model")
        if not model:
            continue
        rows.append((
            model,
            rec.get("input_tokens", 0) or 0,
            rec.get("output_tokens", 0) or 0,
            rec.get("total_cost_usd", 0) or 0,
            rec.get("timestamp") or rec.get("started_at") or rec.get("date"),
        ))
    return rows


def _usage_rows():
    rows = _usage_rows_from_db()
    if rows is None:
        rows = _usage_rows_from_jsonl()
    return rows or []


def get_usage():
    """Aggregate token usage & cost per model"""
    try:
        models = {}
        for model, inp, out, cost, _ in _usage_rows():
            m = models.setdefault(
                model, {"input_tokens": 0, "output_tokens": 0, "total_cost": 0.0, "calls": 0}
            )
            m["input_tokens"] += int(inp)
            m["output_tokens"] += int(out)
            m["total_cost"] += float(cost)
            m["calls"] += 1
        for m in models.values():
            m["total_cost"] = round(m["total_cost"], 6)
        return {"models": models}
    except Exception as e:
        return {"models": {}, "error": str(e)}


def get_usage_timeline(start=None, end=None):
    """Daily token totals per model: [{date, model, tokens}], optionally bounded to [start, end]"""
    try:
        buckets = {}
        for model, inp, out, _, started_at in _usage_rows():
            date = _session_date(started_at)
            if not date:
                continue
            if start and date < start:
                continue
            if end and date > end:
                continue
            buckets[(date, model)] = buckets.get((date, model), 0) + int(inp) + int(out)
        return [
            {"date": date, "model": model, "tokens": tokens}
            for (date, model), tokens in sorted(buckets.items())
        ]
    except Exception:
        return []


AGENT_NAMES = [
    "Athena", "Sora", "Tet", "Rin", "Yui", "Nova",
    "Shiro", "Chad", "Orion", "Kira", "Maverick", "Echo",
]
AGENT_MENTION_RE = re.compile(r"\b(" + "|".join(AGENT_NAMES) + r")\b")


def _iter_session_records():
    """Yield parsed records from state.db (sessions + messages), skipping bad entries"""
    state_db = HERMES_HOME / "state.db"
    if not state_db.exists():
        return
    try:
        conn = sqlite3.connect(str(state_db))
        conn.row_factory = sqlite3.Row
        # First pass: sessions (for agent-level stats)
        cur = conn.execute(
            "SELECT id, model, started_at, ended_at, input_tokens, output_tokens, "
            "message_count, tool_call_count, title FROM sessions ORDER BY started_at DESC"
        )
        for row in cur.fetchall():
            yield dict(row)
        # Second pass: messages with tool_calls containing delegate_task
        cur = conn.execute(
            "SELECT session_id, role, content, tool_calls, tool_name, timestamp "
            "FROM messages ORDER BY timestamp DESC"
        )
        for row in cur.fetchall():
            yield dict(row)
        conn.close()
    except Exception:
        return


def _find_agents_in_text(text):
    """Find agent names mentioned in text (case-insensitive). Safe with non-string types."""
    found = set()
    if not text:
        return found
    if not isinstance(text, str):
        text = str(text)
    text_lower = text.lower()
    for name in AGENT_NAMES:
        if name.lower() in text_lower:
            found.add(name)
    return found


def _extract_delegate_info_from_content(content):
    """Parse delegate info from assistant message content.
    Detects patterns like 'spawn Sora', 'gue deploy Rin', 'Sora udah gue deploy', etc."""
    results = []
    if not content:
        return results
    # Multi-pattern detection for Indonesian + English delegation
    agent_alt = "|".join(AGENT_NAMES)
    patterns = [
        # "spawn/deploy Sora", "delegate to Rin", "panggil Sora"
        rf"(?:spawn|deploy|delegat|panggil|kirim|assign|dispatch|suruh|tugasin)\s+(?:ke\s+|agent\s+)?({agent_alt})",
        # "Sora udah gue deploy", "Rin diminta review"
        rf"({agent_alt})\s+(?:udah\s+)?(?:gue\s+)?(?:di|gue|saya|aku)\s*(?:deploy|spawn|panggil|kirim|assign)",
        # "agent: Sora" / "persona: Rin"
        rf"(?:agent|persona)[:\s]+({agent_alt})",
        # "Review ... oleh Sora" / "audit ... oleh Rin"
        rf"(?:oleh|by)\s+({agent_alt})",
    ]
    for p in patterns:
        for m in re.finditer(p, content, re.IGNORECASE):
            results.append(m.group(1))
    return results


def get_agent_tasks(start=None, end=None):
    """Parse delegate_task calls + agent name mentions from state.db for agent-level task counts.
    
    Tracks:
    1. delegate_task() tool calls (function name = 'delegate_task')
    2. Session titles mentioning agent names (e.g. 'Sora review dashboard')
    3. Session model config that matches agent names
    4. Content messages with agent delegation patterns
    """
    try:
        agents = {}
        recent = []
        seen_sessions = set()

        for rec in _iter_session_records():
            ts = rec.get("timestamp") or rec.get("started_at")
            # Date filter
            if start or end:
                date = _session_date(ts)
                if not date:
                    continue
                if start and date < start:
                    continue
                if end and date > end:
                    continue

            sid = rec.get("id") or rec.get("session_id", "")

            # 1) Tool calls: delegate_task
            tool_calls_raw = rec.get("tool_calls")
            if tool_calls_raw:
                if isinstance(tool_calls_raw, str):
                    try:
                        tcs = json.loads(tool_calls_raw)
                    except json.JSONDecodeError:
                        tcs = []
                else:
                    tcs = tool_calls_raw

                for tc in tcs:
                    if isinstance(tc, dict):
                        fn = tc.get("function", {})
                        fn_name = fn.get("name", "") if isinstance(fn, dict) else ""
                        fn_args = fn.get("arguments", "{}") if isinstance(fn, dict) else "{}"
                        if isinstance(fn_args, str):
                            try:
                                fn_args = json.loads(fn_args)
                            except json.JSONDecodeError:
                                fn_args = {}
                        goal = ""
                        if isinstance(fn_args, dict):
                            goal = fn_args.get("goal", "") or fn_args.get("context", "")

                        if fn_name == "delegate_task":
                            raw_agent = fn_args.get("agent", "") or fn_args.get("persona", "")
                            detected = None
                            if raw_agent:
                                # Only accept if it matches a known agent (case-insensitive)
                                raw_lower = raw_agent.lower().strip()
                                for name in AGENT_NAMES:
                                    if name.lower() == raw_lower:
                                        detected = name
                                        break
                                # If gak cocok exact, coba partial match dari goal
                            if not detected and goal:
                                for name in AGENT_NAMES:
                                    if name.lower() in goal.lower():
                                        detected = name
                                        break
                            if detected:
                                if detected not in agents:
                                    agents[detected] = {"count": 0, "last": None}
                                agents[detected]["count"] += 1
                                agents[detected]["last"] = _fmt_ts(ts)
                                recent.append({"agent": detected, "task": str(goal)[:200], "timestamp": ts})

                        # Also scan goal text for agent names
                        if goal:
                            for name in _find_agents_in_text(goal):
                                session_key = (sid, name)
                                if session_key not in seen_sessions:
                                    seen_sessions.add(session_key)
                                    if name not in agents:
                                        agents[name] = {"count": 0, "last": None}
                                    agents[name]["count"] += 1
                                    agents[name]["last"] = _fmt_ts(ts)
                                    recent.append({"agent": name, "task": str(goal)[:200], "timestamp": ts})

            # 2) Session title mentioning agents
            title = rec.get("title", "") or ""
            if title and sid:
                for name in _find_agents_in_text(title):
                    session_key = (sid, name)
                    if session_key not in seen_sessions:
                        seen_sessions.add(session_key)
                        if name not in agents:
                            agents[name] = {"count": 0, "last": None}
                        agents[name]["count"] += 1
                        agents[name]["last"] = _fmt_ts(ts)
                        recent.append({"agent": name, "task": str(title)[:200], "timestamp": ts})

            # 3) Session model matching agent names (e.g. deepseek-chat -> Athena?)
            model = rec.get("model", "")
            if isinstance(model, str) and model and sid:
                for name in AGENT_NAMES:
                    if name.lower() in model.lower() and (sid, name) not in seen_sessions:
                        seen_sessions.add((sid, name))
                        if name not in agents:
                            agents[name] = {"count": 0, "last": None}
                        agents[name]["count"] += 1
                        agents[name]["last"] = _fmt_ts(rec.get("ended_at") or ts)
                        # No recent entry for model-level matches (no specific task)

            # 4) Message content mentioning agents with delegation keywords
            content = rec.get("content", "") or ""
            role = rec.get("role", "")
            if content and role == "assistant" and sid:
                delegate_agents = _extract_delegate_info_from_content(content)
                for name in delegate_agents:
                    session_key = (sid, name)
                    if session_key not in seen_sessions:
                        seen_sessions.add(session_key)
                        if name not in agents:
                            agents[name] = {"count": 0, "last": None}
                        agents[name]["count"] += 1
                        agents[name]["last"] = _fmt_ts(ts)
                        recent.append({"agent": name, "task": str(content)[:200], "timestamp": ts})

        # Normalize agent name casing — merge lowercase keys into proper nouns
        proper_names = {}
        for name, info in agents.items():
            proper = name.title()
            for valid in AGENT_NAMES:
                if name.lower() == valid.lower():
                    proper = valid
                    break
            if proper != name:
                if proper in proper_names:
                    proper_names[proper]["count"] += info["count"]
                    # Keep the latest last timestamp
                    if info["last"] and (not proper_names[proper]["last"] or info["last"] > proper_names[proper]["last"]):
                        proper_names[proper]["last"] = info["last"]
                else:
                    proper_names[proper] = dict(info)
                # Also fix recent entries
                for r in recent:
                    if r["agent"] == name:
                        r["agent"] = proper
            else:
                if name in proper_names:
                    proper_names[name]["count"] += info["count"]
                    if info["last"] and (not proper_names[name]["last"] or info["last"] > proper_names[name]["last"]):
                        proper_names[name]["last"] = info["last"]
                else:
                    proper_names[name] = dict(info)

        return {
            "agents": proper_names,
            "total": sum(a["count"] for a in proper_names.values()),
            "recent": [r for r in recent[-50:][::-1] if r["agent"] in proper_names]
        }
    except Exception as e:
        return {"agents": {}, "total": 0, "recent": [], "error": str(e)}


def get_agents():
    """List agent personas from ~/.hermes/skills/persona/"""
    persona_dir = HERMES_HOME / "skills" / "persona"
    if not persona_dir.exists():
        return {"count": 0, "agents": []}
    agents = []
    for d in sorted(persona_dir.iterdir()):
        if not d.is_dir() or d.name.startswith(".") or not (d / "SKILL.md").exists():
            continue
        m = re.match(r"^persona-([a-z0-9]+)-(.+)$", d.name)
        category, name = (m.group(1), m.group(2)) if m else ("persona", d.name)
        agents.append({
            "name": name,
            "description": parse_skill_description(d / "SKILL.md"),
            "category": category,
        })
    return {"count": len(agents), "agents": agents}


def get_system_info():
    """System info"""
    try:
        result = subprocess.run(["hermes", "--version"], capture_output=True, text=True, timeout=5)
        version = result.stdout.strip() or result.stderr.strip()
    except:
        version = "unknown"
    return {
        "version": version,
        "python": subprocess.run(["python3", "--version"], capture_output=True, text=True).stdout.strip(),
        "hermes_home": str(HERMES_HOME),
    }


# ── Flask app ─────────────────────────────────

try:
    from flask import Flask, jsonify, render_template_string, request
    from flask_cors import CORS

    app = Flask(__name__)
    CORS(app)

    HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hermes Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-950 text-gray-100 font-sans">
<div class="max-w-6xl mx-auto p-6">
  <header class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">⚡ Hermes Dashboard</h1>
      <p class="text-sm text-gray-400">Local agent status &amp; configuration</p>
    </div>
    <span class="text-xs text-gray-500" id="uptime"></span>
  </header>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8" id="stats">
    <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div class="text-2xl font-bold text-blue-400" id="session-count">-</div>
      <div class="text-xs text-gray-400 mt-1">Sessions</div>
    </div>
    <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div class="text-2xl font-bold text-green-400" id="skills-count">-</div>
      <div class="text-xs text-gray-400 mt-1">Skills</div>
    </div>
    <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div class="text-2xl font-bold text-purple-400" id="memory-count">-</div>
      <div class="text-xs text-gray-400 mt-1">Memory Entries</div>
    </div>
    <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div class="text-2xl font-bold text-amber-400" id="cron-count">-</div>
      <div class="text-xs text-gray-400 mt-1">Cron Jobs</div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Config -->
    <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <h2 class="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Model Config</h2>
      <pre class="text-xs text-gray-400 font-mono whitespace-pre-wrap" id="config">Loading...</pre>
    </div>

    <!-- Skills -->
    <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <h2 class="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Skills</h2>
      <div id="skills-list" class="space-y-1">
        <div class="text-xs text-gray-500">Loading...</div>
      </div>
    </div>

    <!-- Cron Jobs -->
    <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <h2 class="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Cron Jobs</h2>
      <div id="cron-list" class="space-y-1">
        <div class="text-xs text-gray-500">Loading...</div>
      </div>
    </div>

    <!-- System -->
    <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <h2 class="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">System</h2>
      <div id="system-info" class="space-y-2 text-xs">
        <div class="text-gray-500">Loading...</div>
      </div>
    </div>
  </div>
</div>
<script>
async function load() {
  const sections = ['config', 'memories', 'skills', 'cron', 'sessions', 'system'];
  const [config, memories, skills, cron, sessions, system] = await Promise.all(
    sections.map(s => fetch(`/api/${s}`).then(r => r.json()))
  );

  // Stats
  document.getElementById('session-count').textContent = sessions.session_count ?? sessions.count ?? '?';
  document.getElementById('skills-count').textContent = skills.count ?? '?';
  document.getElementById('memory-count').textContent = (memories.memory_count ?? 0) + (memories.user_count ?? 0);
  document.getElementById('cron-count').textContent = cron.count ?? '?';

  // Config
  document.getElementById('config').textContent = JSON.stringify(config, null, 2);

  // Skills
  const skillsList = document.getElementById('skills-list');
  skillsList.innerHTML = (skills.skills || []).slice(0, 20).map(s =>
    `<div class="flex items-center justify-between text-xs"><span class="text-gray-300">${s.name}</span><span class="text-gray-500">${(s.modified || '').slice(0, 10)}</span></div>`
  ).join('') || '<div class="text-xs text-gray-500">No skills</div>';

  // Cron
  const cronList = document.getElementById('cron-list');
  cronList.innerHTML = (cron.jobs || []).slice(0, 10).map(j =>
    `<div class="flex items-center justify-between text-xs"><span class="text-gray-300">${j.name}</span><span class="text-gray-500">${j.schedule}</span></div>`
  ).join('') || '<div class="text-xs text-gray-500">No cron jobs</div>';

  // System
  document.getElementById('system-info').innerHTML = Object.entries(system).map(([k, v]) =>
    `<div class="flex justify-between"><span class="text-gray-400">${k}</span><span class="text-gray-300">${v || '?'}</span></div>`
  ).join('');
}
load();
</script>
</body>
</html>"""

    @app.route("/")
    def index():
        return render_template_string(HTML)

    @app.route("/api/config")
    def api_config():
        return jsonify(get_config())

    @app.route("/api/config/<path:cfg_path>", methods=["PUT"])
    def api_config_update(cfg_path):
        if yaml is None:
            return jsonify({"error": "pyyaml not installed"}), 500
        if not _config_path().exists():
            return jsonify({"error": "config.yaml not found"}), 404
        body = request.get_json(silent=True) or {}
        if "value" not in body:
            return jsonify({"error": "missing 'value' in request body"}), 400
        try:
            set_config_key(cfg_path, body["value"])
            return jsonify({"ok": True, "path": cfg_path, "value": body["value"]})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/config/<path:cfg_path>", methods=["DELETE"])
    def api_config_delete(cfg_path):
        if yaml is None:
            return jsonify({"error": "pyyaml not installed"}), 500
        if not _config_path().exists():
            return jsonify({"error": "config.yaml not found"}), 404
        try:
            delete_config_key(cfg_path)
            return jsonify({"ok": True, "path": cfg_path})
        except KeyError:
            return jsonify({"error": f"key not found: {cfg_path}"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/memories")
    def api_memories():
        return jsonify(get_memories())

    @app.route("/api/skills")
    def api_skills():
        return jsonify(get_skills())

    @app.route("/api/cron")
    def api_cron():
        return jsonify(get_cron_jobs())

    @app.route("/api/cron", methods=["POST"])
    def api_cron_create():
        body = request.get_json(silent=True) or {}
        if not str(body.get("name", "")).strip():
            return jsonify({"error": "missing 'name'"}), 400
        if not body.get("schedule") or not body.get("prompt"):
            return jsonify({"error": "'schedule' and 'prompt' are required"}), 400
        try:
            job = create_cron_job(body)
            return jsonify({"ok": True, "job": job}), 201
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except FileExistsError:
            return jsonify({"error": f"cron job already exists: {body['name']}"}), 409
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/cron/<name>", methods=["PUT"])
    def api_cron_update(name):
        body = request.get_json(silent=True) or {}
        try:
            job = update_cron_job(name, body)
            return jsonify({"ok": True, "job": job})
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except FileNotFoundError:
            return jsonify({"error": f"cron job not found: {name}"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/cron/<name>", methods=["DELETE"])
    def api_cron_delete(name):
        try:
            delete_cron_job(name)
            return jsonify({"ok": True, "name": name})
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except FileNotFoundError:
            return jsonify({"error": f"cron job not found: {name}"}), 404
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/sessions")
    def api_sessions():
        return jsonify(get_sessions())

    @app.route("/api/usage")
    def api_usage():
        return jsonify(get_usage())

    @app.route("/api/usage/timeline")
    def api_usage_timeline():
        return jsonify(get_usage_timeline(request.args.get("start"), request.args.get("end")))

    @app.route("/api/usage/tasks")
    def api_usage_tasks():
        return jsonify(get_agent_tasks(request.args.get("start"), request.args.get("end")))

    @app.route("/api/agents")
    def api_agents():
        return jsonify(get_agents())

    @app.route("/api/system")
    def api_system():
        return jsonify(get_system_info())

    if __name__ == "__main__":
        port = int(os.getenv("PORT", 9300))
        print(f"🔧 Hermes Dashboard → http://localhost:{port}")
        app.run(host="0.0.0.0", port=port, debug=True)

except ImportError:
    print("Install flask: pip install flask flask-cors")
    print("Or run: pip install flask flask-cors pyyaml")

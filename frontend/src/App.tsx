import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Chart } from 'chart.js/auto'
import {
  MessageSquare,
  Code2,
  Brain,
  Timer,
  Cpu,
  Search,
  LayoutDashboard,
  Settings,
  Users,
  Pencil,
  Trash2,
  X,
  Copy,
  Check,
  ChevronDown,
  FolderOpen,
  Plus,
  Eye,
  type LucideIcon,
} from 'lucide-react'
import { useApi, apiSend } from './api'

type TabId = 'overview' | 'config' | 'personalities' | 'skills' | 'cron' | 'system'

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'config', label: 'Config', icon: Settings },
  { id: 'personalities', label: 'Personalities', icon: Users },
  { id: 'skills', label: 'Skills', icon: Code2 },
  { id: 'cron', label: 'Cron', icon: Timer },
  { id: 'system', label: 'System', icon: Cpu },
]

export default function App() {
  const [tab, setTab] = useState<TabId>('overview')

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 sticky top-0 z-10 shadow-lg shadow-black/20">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <h1 className="text-2xl font-bold tracking-tight">⚡ Hermes Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            Live view of sessions, skills, memory, cron jobs, and system state
          </p>
        </div>
        <nav className="mx-auto max-w-6xl px-6 flex gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 ${
                  active
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8 flex-1">
        {tab === 'overview' && <Overview />}
        {tab === 'config' && <Config />}
        {tab === 'personalities' && <Personalities />}
        {tab === 'skills' && <Skills />}
        {tab === 'cron' && <Cron />}
        {tab === 'system' && <System />}
      </main>

      <Toasts />
    </div>
  )
}

/* ---------- Toasts ---------- */

interface ToastItem {
  id: number
  msg: string
  kind: 'success' | 'error'
}

let toastSeq = 0
let pushToast: (msg: string, kind: 'success' | 'error') => void = () => {}

function toast(msg: string, kind: 'success' | 'error' = 'success') {
  pushToast(msg, kind)
}

function Toasts() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    pushToast = (msg, kind) => {
      const id = ++toastSeq
      setItems((t) => [...t, { id, msg, kind }])
      setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 3200)
    }
    return () => {
      pushToast = () => {}
    }
  }, [])

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg border px-4 py-2.5 text-sm shadow-xl backdrop-blur transition-all ${
            t.kind === 'success'
              ? 'border-emerald-700 bg-emerald-950/80 text-emerald-200'
              : 'border-red-800 bg-red-950/80 text-red-200'
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  )
}

/* ---------- Shared UI ---------- */

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-gray-800 bg-gray-900 p-5 transition-all duration-200 hover:border-gray-600 hover:shadow-lg hover:shadow-black/30 ${className}`}
    >
      {children}
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[85vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function ConfirmModal({
  title,
  message,
  onConfirm,
  onClose,
  busy,
}: {
  title: string
  message: string
  onConfirm: () => void
  onClose: () => void
  busy?: boolean
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-gray-300">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  )
}

function StateWrap({
  loading,
  error,
  children,
  skeleton,
}: {
  loading: boolean
  error: string | null
  children: ReactNode
  skeleton?: ReactNode
}) {
  if (loading)
    return (
      skeleton ?? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-gray-900 animate-pulse" />
          ))}
        </div>
      )
    )
  if (error)
    return (
      <div className="rounded-lg border border-red-900 bg-red-950/40 text-red-300 px-4 py-3">
        Failed to load: {error}
      </div>
    )
  return <>{children}</>
}

function count(v: unknown): number {
  if (Array.isArray(v)) return v.length
  if (v && typeof v === 'object') return Object.keys(v).length
  if (typeof v === 'number') return v
  return 0
}

/* ---------- Simple markdown renderer ---------- */

function inlineMd(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`
    if (part.startsWith('**') && part.endsWith('**'))
      return (
        <strong key={key} className="font-semibold text-gray-100">
          {part.slice(2, -2)}
        </strong>
      )
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <code key={key} className="rounded bg-gray-800 px-1 py-0.5 font-mono text-[0.85em] text-emerald-300">
          {part.slice(1, -1)}
        </code>
      )
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      return (
        <em key={key} className="italic">
          {part.slice(1, -1)}
        </em>
      )
    return <span key={key}>{part}</span>
  })
}

function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1.5 text-sm text-gray-300">
      {lines.map((line, i) => {
        const key = `l${i}`
        if (line.startsWith('### '))
          return (
            <h5 key={key} className="font-semibold text-gray-100">
              {inlineMd(line.slice(4), key)}
            </h5>
          )
        if (line.startsWith('## '))
          return (
            <h4 key={key} className="text-base font-semibold text-gray-100">
              {inlineMd(line.slice(3), key)}
            </h4>
          )
        if (line.startsWith('# '))
          return (
            <h3 key={key} className="text-lg font-bold text-gray-100">
              {inlineMd(line.slice(2), key)}
            </h3>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <div key={key} className="flex gap-2 pl-1">
              <span className="text-gray-500">•</span>
              <span>{inlineMd(line.slice(2), key)}</span>
            </div>
          )
        if (line.trim() === '') return <div key={key} className="h-1" />
        return <p key={key}>{inlineMd(line, key)}</p>
      })}
    </div>
  )
}

/* ---------- Overview ---------- */

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  error,
  accent,
  gradient,
}: {
  icon: LucideIcon
  label: string
  value: number
  loading: boolean
  error: string | null
  accent: string
  gradient: string
}) {
  return (
    <div
      className={`rounded-xl border border-gray-800 bg-gradient-to-br ${gradient} p-5 transition-all duration-200 hover:border-gray-600 hover:shadow-lg hover:shadow-black/30`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{label}</span>
        <span className={`rounded-lg p-2 ${accent}`}>
          <Icon size={18} />
        </span>
      </div>
      {loading ? (
        <div className="mt-3 h-9 w-16 rounded-lg bg-gray-800/80 animate-pulse" />
      ) : (
        <div className="mt-3 text-3xl font-bold tabular-nums">{error ? '!' : value}</div>
      )}
    </div>
  )
}

function pickCount(s: { data: unknown }): number {
  const d = s.data as Record<string, unknown> | unknown[] | null
  if (d && !Array.isArray(d)) {
    if (typeof d.count === 'number') return d.count
    if (typeof d.total === 'number') return d.total
    const nested = (d.items ?? d.skills ?? d.sessions ?? d.memories ?? d.cron ?? d.jobs) as unknown
    if (nested !== undefined) return count(nested)
  }
  return count(d)
}

const CHART_COLORS = [
  '#818cf8',
  '#34d399',
  '#e879f9',
  '#fbbf24',
  '#38bdf8',
  '#f87171',
  '#a3e635',
  '#fb923c',
  '#2dd4bf',
  '#c084fc',
]

function DonutChart({ labels, values }: { labels: string[]; values: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current || labels.length === 0) return
    const chart = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: CHART_COLORS,
            borderColor: '#111827',
            borderWidth: 2,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#9ca3af', boxWidth: 12, padding: 12 },
          },
        },
      },
    })
    return () => chart.destroy()
  }, [labels, values])

  if (labels.length === 0)
    return <div className="flex h-64 items-center justify-center text-sm text-gray-500">No data</div>
  return (
    <div className="h-64">
      <canvas ref={ref} />
    </div>
  )
}

function BarChart({ labels, values }: { labels: string[]; values: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: ['#818cf8', '#e879f9', '#34d399', '#fbbf24'],
            borderRadius: 6,
            maxBarThickness: 56,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#9ca3af' },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(75, 85, 99, 0.25)' },
            ticks: { color: '#9ca3af', precision: 0 },
          },
        },
      },
    })
    return () => chart.destroy()
  }, [labels, values])

  return (
    <div className="h-64">
      <canvas ref={ref} />
    </div>
  )
}

const AGENT_COLORS: Record<string, string> = {
  Athena: '#3b82f6',
  Sora: '#8b5cf6',
  Tet: '#10b981',
  Rin: '#ef4444',
  Yui: '#f59e0b',
  Nova: '#ec4899',
  Shiro: '#06b6d4',
  Chad: '#84cc16',
  Orion: '#a855f7',
  Kira: '#64748b',
  Maverick: '#f97316',
  Echo: '#14b8a6',
}

function AgentBarChart({ labels, values }: { labels: string[]; values: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current || labels.length === 0) return
    const chart = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: labels.map((l) => AGENT_COLORS[l] ?? '#818cf8'),
            borderRadius: 6,
            maxBarThickness: 28,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(75, 85, 99, 0.25)' },
            ticks: { color: '#9ca3af', precision: 0 },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#9ca3af' },
          },
        },
      },
    })
    return () => chart.destroy()
  }, [labels, values])

  if (labels.length === 0)
    return <div className="flex h-64 items-center justify-center text-sm text-gray-500">No data</div>
  return (
    <div className="h-64">
      <canvas ref={ref} />
    </div>
  )
}

// Blue, green, purple first — per model-usage chart spec
const LINE_COLORS = [
  '#38bdf8',
  '#34d399',
  '#c084fc',
  '#fbbf24',
  '#f87171',
  '#818cf8',
  '#fb923c',
  '#2dd4bf',
  '#e879f9',
  '#a3e635',
]

function LineChart({
  labels,
  datasets,
}: {
  labels: string[]
  datasets: { label: string; data: number[] }[]
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current || labels.length === 0) return
    const chart = new Chart(ref.current, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((d, i) => ({
          label: d.label,
          data: d.data,
          borderColor: LINE_COLORS[i % LINE_COLORS.length],
          backgroundColor: LINE_COLORS[i % LINE_COLORS.length],
          tension: 0.3,
          pointRadius: 3,
          borderWidth: 2,
        })),
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#9ca3af', boxWidth: 12, padding: 12 },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#9ca3af' },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(75, 85, 99, 0.25)' },
            ticks: { color: '#9ca3af', precision: 0 },
          },
        },
      },
    })
    return () => chart.destroy()
  }, [labels, datasets])

  if (labels.length === 0)
    return <div className="flex h-64 items-center justify-center text-sm text-gray-500">No data</div>
  return (
    <div className="h-64">
      <canvas ref={ref} />
    </div>
  )
}

interface ModelUsage {
  input_tokens: number
  output_tokens: number
  total_cost: number
  calls: number
}

interface UsagePayload {
  models: Record<string, ModelUsage>
}

interface TimelinePoint {
  date: string
  model: string
  tokens: number
}

interface AgentTaskInfo {
  count: number
  last: string | null
}
interface TasksPayload {
  agents: Record<string, AgentTaskInfo>
  total: number
  recent: { agent: string; task: string; timestamp: string | null }[]
}

function Overview() {
  const sessions = useApi<unknown>('/sessions')
  const skills = useApi<SkillsPayload>('/skills')
  const memories = useApi<unknown>('/memories')
  const cron = useApi<unknown>('/cron')
  const usage = useApi<UsagePayload>('/usage')

  const today = new Date().toISOString().split("T")[0]
  const [range, setRange] = useState({ start: "", end: today })
  const defaultRange = { start: "", end: today }

  const rangeQuery = useMemo(() => {
    const params = new URLSearchParams()
    if (range.start) params.set('start', range.start)
    if (range.end) params.set('end', range.end)
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }, [range])

  const timeline = useApi<TimelinePoint[]>(`/usage/timeline${rangeQuery}`)
  const tasks = useApi<TasksPayload>(`/usage/tasks${rangeQuery}`)

  const usageTimeline = useMemo(() => {
    const rows = timeline.data ?? []
    const dates = [...new Set(rows.map((r) => r.date))].sort()
    const models = [...new Set(rows.map((r) => r.model))]
    const byKey = new Map(rows.map((r) => [`${r.date}|${r.model}`, r.tokens]))
    return {
      labels: dates,
      datasets: models.map((m) => ({
        label: m,
        data: dates.map((d) => byKey.get(`${d}|${m}`) ?? 0),
      })),
    }
  }, [timeline.data])

  const agentTasks = useMemo(() => {
    const agents = tasks.data?.agents ?? {}
    const labels = Object.keys(agents).sort((a, b) => agents[b].count - agents[a].count)
    return { labels, values: labels.map((a) => agents[a].count) }
  }, [tasks.data])

  const modelCalls = useMemo(() => {
    const models = usage.data?.models ?? {}
    const labels = Object.keys(models).sort((a, b) => models[b].calls - models[a].calls)
    return { labels, values: labels.map((m) => models[m].calls) }
  }, [usage.data])

  const skillsByCategory = useMemo(() => {
    const cats = skills.data?.categories ?? {}
    const labels = Object.keys(cats).sort()
    return { labels, values: labels.map((c) => cats[c].length) }
  }, [skills.data])

  const activity = useMemo(
    () => ({
      labels: ['Sessions', 'Memories', 'Skills', 'Cron'],
      values: [pickCount(sessions), pickCount(memories), pickCount(skills), pickCount(cron)],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions.data, memories.data, skills.data, cron.data],
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={MessageSquare}
        label="Sessions"
        value={pickCount(sessions)}
        loading={sessions.loading}
        error={sessions.error}
        accent="bg-indigo-500/15 text-indigo-400"
        gradient="from-indigo-950/60 via-gray-900 to-gray-900"
      />
      <StatCard
        icon={Code2}
        label="Skills"
        value={pickCount(skills)}
        loading={skills.loading}
        error={skills.error}
        accent="bg-emerald-500/15 text-emerald-400"
        gradient="from-emerald-950/60 via-gray-900 to-gray-900"
      />
      <StatCard
        icon={Brain}
        label="Memory"
        value={pickCount(memories)}
        loading={memories.loading}
        error={memories.error}
        accent="bg-fuchsia-500/15 text-fuchsia-400"
        gradient="from-fuchsia-950/60 via-gray-900 to-gray-900"
      />
      <StatCard
        icon={Timer}
        label="Cron"
        value={pickCount(cron)}
        loading={cron.loading}
        error={cron.error}
        accent="bg-amber-500/15 text-amber-400"
        gradient="from-amber-950/60 via-gray-900 to-gray-900"
      />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-300">
            Skills by Category
          </h2>
          {skills.loading ? (
            <div className="h-64 rounded-lg bg-gray-800/60 animate-pulse" />
          ) : (
            <DonutChart labels={skillsByCategory.labels} values={skillsByCategory.values} />
          )}
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-300">
            Tool Activity
          </h2>
          {sessions.loading || memories.loading || skills.loading || cron.loading ? (
            <div className="h-64 rounded-lg bg-gray-800/60 animate-pulse" />
          ) : (
            <BarChart labels={activity.labels} values={activity.values} />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* AI Model Usage — Full Width */}
        <Card className="col-span-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">📈 AI Model Usage</h2>
            <div className="flex gap-2 items-center">
              <input type="date" value={range.start} onChange={e => setRange(s => ({...s, start: e.target.value}))}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 w-32" />
              <input type="date" value={range.end} onChange={e => setRange(s => ({...s, end: e.target.value}))}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 w-32" />
              {([["7d",7],["30d",30],["All",0]] as [string,number][]).map(([l,d]) => (
                <button key={l} onClick={() => setRange(d ? {...defaultRange, start: new Date(Date.now()-d*86400000).toISOString().split("T")[0]} : defaultRange)}
                  className={`px-2 py-1 text-xs rounded ${range.start===defaultRange.start&&d===0 ? "bg-blue-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-300"}`}>{l}</button>
              ))}
            </div>
          </div>
          {timeline.loading ? (
            <div className="h-64 rounded-lg bg-gray-800/60 animate-pulse" />
          ) : (
            <div className="h-72">
              <LineChart labels={usageTimeline.labels} datasets={usageTimeline.datasets} />
            </div>
          )}
        </Card>

        {/* AI Agent Tasks */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">📊 AI Agent Tasks</h2>
            <span className="text-xs text-gray-500">{tasks.data?.total ?? 0} tasks</span>
          </div>
          {tasks.loading ? (
            <div className="h-64 rounded-lg bg-gray-800/60 animate-pulse" />
          ) : (
            <AgentBarChart labels={agentTasks.labels} values={agentTasks.values} />
          )}
        </Card>

        {/* Model Calls */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-300">Model Calls</h2>
          {usage.loading ? (
            <div className="h-64 rounded-lg bg-gray-800/60 animate-pulse" />
          ) : (
            <DonutChart labels={modelCalls.labels} values={modelCalls.values} />
          )}
        </Card>
      </div>
    </div>
  )
}

/* ---------- Config ---------- */

function flatten(obj: unknown, prefix = ''): [string, string][] {
  if (obj === null || typeof obj !== 'object') return [[prefix || 'value', String(obj)]]
  const out: [string, string][] = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatten(v, key))
    } else {
      out.push([key, Array.isArray(v) ? v.join(', ') : String(v)])
    }
  }
  return out
}

// Keys derived by the backend, not present verbatim in config.yaml
const READ_ONLY_KEYS = new Set(['providers'])

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function Config() {
  const { data, loading, error, reload } = useApi<Record<string, unknown>>('/config')
  // agent.personalities is managed in the Personalities tab
  const rows = useMemo(
    () => (data ? flatten(data).filter(([k]) => !k.startsWith('agent.personalities')) : []),
    [data],
  )
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      await apiSend('PUT', `/config/${editing.key}`, { value: parseValue(editing.value) })
      toast(`Saved ${editing.key}`)
      setEditing(null)
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await apiSend('DELETE', `/config/${deleting}`)
      toast(`Deleted ${deleting}`)
      setDeleting(null)
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <StateWrap loading={loading} error={error}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map(([k, v]) => (
          <Card key={k} className="p-4 group">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-wide text-gray-400">{k}</div>
                <div className="mt-1 font-mono text-sm text-gray-100 truncate" title={v}>
                  {v}
                </div>
              </div>
              {!READ_ONLY_KEYS.has(k) && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditing({ key: k, value: v })}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-indigo-400"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleting(k)}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-200">
          Raw JSON
        </summary>
        <pre className="mt-3 overflow-auto rounded-xl border border-gray-800 bg-gray-900 p-4 text-xs text-emerald-300">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>

      {editing && (
        <Modal title={`Edit ${editing.key}`} onClose={() => setEditing(null)}>
          <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">Value</label>
          <input
            value={editing.value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            autoFocus
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500 transition-colors"
          />
          <p className="mt-2 text-xs text-gray-500">
            Numbers, booleans, and JSON are parsed automatically; anything else is saved as a
            string.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setEditing(null)}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete config key"
          message={`Delete "${deleting}" from config.yaml? A backup is created before every change.`}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}
    </StateWrap>
  )
}

/* ---------- Personalities ---------- */

type PersonalityValue = string | { system_prompt?: string; tools?: string[] }

const FALLBACK_TOOLS = ['bash', 'browser', 'files', 'web_search', 'memory', 'cron', 'image_gen']

function personaPrompt(v: PersonalityValue): string {
  return typeof v === 'string' ? v : (v?.system_prompt ?? '')
}

function personaTools(v: PersonalityValue): string[] {
  return typeof v === 'object' && v !== null && Array.isArray(v.tools) ? v.tools : []
}

interface PersonaDraft {
  originalName: string | null
  name: string
  prompt: string
  tools: string[]
}

function Personalities() {
  const { data, loading, error, reload } = useApi<Record<string, unknown>>('/config')
  const [draft, setDraft] = useState<PersonaDraft | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)

  const agent = (data?.agent ?? {}) as Record<string, unknown>
  const personalities = (agent.personalities ?? {}) as Record<string, PersonalityValue>
  const toolOptions = useMemo(() => {
    const ts = data?.toolsets
    const fromConfig = Array.isArray(ts) ? ts.filter((t): t is string => typeof t === 'string') : []
    return fromConfig.length > 0 ? fromConfig : FALLBACK_TOOLS
  }, [data])

  const openEditor = (name: string | null) => {
    setPreview(false)
    if (name === null) {
      setDraft({ originalName: null, name: '', prompt: '', tools: [] })
    } else {
      const v = personalities[name]
      setDraft({ originalName: name, name, prompt: personaPrompt(v), tools: personaTools(v) })
    }
  }

  const save = async () => {
    if (!draft || !draft.name.trim()) {
      toast('Name is required', 'error')
      return
    }
    const name = draft.name.trim()
    const value: PersonalityValue =
      draft.tools.length > 0 ? { system_prompt: draft.prompt, tools: draft.tools } : draft.prompt
    setBusy(true)
    try {
      await apiSend('PUT', `/config/agent.personalities.${name}`, { value })
      if (draft.originalName && draft.originalName !== name) {
        await apiSend('DELETE', `/config/agent.personalities.${draft.originalName}`)
      }
      toast(`Saved personality "${name}"`)
      setDraft(null)
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await apiSend('DELETE', `/config/agent.personalities.${deleting}`)
      toast(`Deleted personality "${deleting}"`)
      setDeleting(null)
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const names = Object.keys(personalities)

  return (
    <StateWrap loading={loading} error={error}>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {names.length} personalit{names.length === 1 ? 'y' : 'ies'} from{' '}
          <code className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-xs">
            agent.personalities
          </code>
        </p>
        <button
          onClick={() => openEditor(null)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          <Plus size={16} />
          New
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {names.map((name) => {
          const v = personalities[name]
          const tools = personaTools(v)
          return (
            <Card key={name} className="cursor-pointer group">
              <div onClick={() => openEditor(name)}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-100 capitalize">{name}</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleting(name)
                    }}
                    className="rounded-lg p-1.5 text-gray-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-800 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-2 max-h-24 overflow-hidden text-ellipsis [mask-image:linear-gradient(to_bottom,black_60%,transparent)]">
                  <Markdown text={personaPrompt(v)} />
                </div>
                {tools.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tools.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )
        })}
        {names.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-gray-800 py-12 text-center text-gray-500">
            No personalities defined
          </div>
        )}
      </div>

      {draft && (
        <Modal
          title={draft.originalName ? `Edit ${draft.originalName}` : 'New personality'}
          onClose={() => setDraft(null)}
          wide
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">
                Name
              </label>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. helpful"
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs uppercase tracking-wide text-gray-500">
                  System prompt
                </label>
                <button
                  onClick={() => setPreview((p) => !p)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors ${
                    preview
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`}
                >
                  <Eye size={13} />
                  {preview ? 'Editing off' : 'Preview'}
                </button>
              </div>
              {preview ? (
                <div className="min-h-[10rem] rounded-lg border border-gray-800 bg-gray-950 p-3">
                  <Markdown text={draft.prompt || '*Empty prompt*'} />
                </div>
              ) : (
                <textarea
                  value={draft.prompt}
                  onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                  rows={8}
                  placeholder="You are a helpful assistant…"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500 transition-colors resize-y"
                />
              )}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">
                Tools
              </label>
              <div className="flex flex-wrap gap-2">
                {toolOptions.map((t) => {
                  const on = draft.tools.includes(t)
                  return (
                    <label
                      key={t}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        on
                          ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setDraft({
                            ...draft,
                            tools: on
                              ? draft.tools.filter((x) => x !== t)
                              : [...draft.tools, t],
                          })
                        }
                        className="hidden"
                      />
                      {on && <Check size={13} />}
                      {t}
                    </label>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Leave all unchecked to store the personality as a plain prompt string (Hermes
                default format).
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setDraft(null)}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete personality"
          message={`Delete personality "${deleting}"? A config backup is created before the change.`}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}
    </StateWrap>
  )
}

/* ---------- Skills ---------- */

interface SkillInfo {
  name: string
  description: string
  category: string
  path: string
  modified?: string
}

interface SkillsPayload {
  count: number
  categories: Record<string, SkillInfo[]>
}

function Skills() {
  const { data, loading, error } = useApi<SkillsPayload>('/skills')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const searching = q.trim().length > 0
  const filtered = useMemo(() => {
    const cats = data?.categories ?? {}
    const needle = q.trim().toLowerCase()
    const out: [string, SkillInfo[]][] = []
    for (const cat of Object.keys(cats).sort()) {
      const skills = needle
        ? cats[cat].filter(
            (s) =>
              s.name.toLowerCase().includes(needle) ||
              (s.description ?? '').toLowerCase().includes(needle),
          )
        : cats[cat]
      if (skills.length > 0) out.push([cat, skills])
    }
    return out
  }, [data, q])

  const toggle = (cat: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })

  return (
    <StateWrap loading={loading} error={error}>
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search skills…"
          className="w-full rounded-lg border border-gray-800 bg-gray-900 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      <div className="space-y-3">
        {filtered.map(([cat, skills]) => {
          const expanded = searching || open.has(cat)
          return (
            <div
              key={cat}
              className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden transition-all duration-200 hover:border-gray-600"
            >
              <button
                onClick={() => toggle(cat)}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-gray-800/40"
              >
                <span className="flex items-center gap-3">
                  <FolderOpen size={16} className="text-indigo-400" />
                  <span className="font-medium text-gray-100">{cat}</span>
                  <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-300">
                    {skills.length}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className={`text-gray-500 transition-transform duration-200 ${
                    expanded ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {expanded && (
                <div className="divide-y divide-gray-800 border-t border-gray-800">
                  {skills.map((s) => (
                    <div key={s.path} className="px-5 py-3 transition-colors hover:bg-gray-800/40">
                      <div className="font-medium text-sm text-gray-100">{s.name}</div>
                      {s.description && (
                        <p className="mt-1 text-xs text-gray-400 line-clamp-2">{s.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-800 py-12 text-center text-gray-500">
            No skills found
          </div>
        )}
      </div>
    </StateWrap>
  )
}

/* ---------- Cron ---------- */

interface CronJob {
  name?: string
  schedule?: string
  prompt?: string
  skills?: string[]
  repeat?: boolean
  deliver?: boolean
  last_run?: string
  lastRun?: string
  status?: string
  [k: string]: unknown
}

interface CronDraft {
  originalName: string | null
  name: string
  schedule: string
  prompt: string
  skills: string[]
  repeat: boolean
  deliver: boolean
}

function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const key of ['items', 'skills', 'cron', 'jobs', 'data']) {
      if (Array.isArray(obj[key])) return obj[key] as T[]
    }
  }
  return []
}

function statusClasses(status: string): string {
  const s = status.toLowerCase()
  if (['ok', 'success', 'active', 'enabled', 'running'].includes(s))
    return 'bg-emerald-500/15 text-emerald-400'
  if (['error', 'failed', 'fail'].includes(s)) return 'bg-red-500/15 text-red-400'
  if (['paused', 'pending', 'warning'].includes(s)) return 'bg-amber-500/15 text-amber-400'
  if (['disabled', 'idle', 'inactive'].includes(s)) return 'bg-gray-600/20 text-gray-400'
  return 'bg-amber-500/15 text-amber-400'
}

function Cron() {
  const { data, loading, error, reload } = useApi<unknown>('/cron')
  const jobs = useMemo(() => asArray<CronJob>(data), [data])
  const [draft, setDraft] = useState<CronDraft | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [skillInput, setSkillInput] = useState('')

  const openEditor = (job: CronJob | null) => {
    setSkillInput('')
    if (!job) {
      setDraft({
        originalName: null,
        name: '',
        schedule: '',
        prompt: '',
        skills: [],
        repeat: true,
        deliver: false,
      })
    } else {
      setDraft({
        originalName: job.name ?? null,
        name: job.name ?? '',
        schedule: job.schedule ?? '',
        prompt: job.prompt ?? '',
        skills: Array.isArray(job.skills) ? job.skills : [],
        repeat: job.repeat ?? true,
        deliver: job.deliver ?? false,
      })
    }
  }

  const addSkill = () => {
    const s = skillInput.trim().replace(/,+$/, '')
    if (!draft || !s) return
    if (!draft.skills.includes(s)) setDraft({ ...draft, skills: [...draft.skills, s] })
    setSkillInput('')
  }

  const save = async () => {
    if (!draft) return
    const name = draft.name.trim()
    if (!name || !draft.schedule.trim() || !draft.prompt.trim()) {
      toast('Name, schedule, and prompt are required', 'error')
      return
    }
    const body = {
      name,
      schedule: draft.schedule.trim(),
      prompt: draft.prompt,
      skills: draft.skills,
      repeat: draft.repeat,
      deliver: draft.deliver,
    }
    setBusy(true)
    try {
      if (draft.originalName) {
        await apiSend('PUT', `/cron/${encodeURIComponent(draft.originalName)}`, body)
      } else {
        await apiSend('POST', '/cron', body)
      }
      toast(`Saved cron "${name}"`)
      setDraft(null)
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await apiSend('DELETE', `/cron/${encodeURIComponent(deleting)}`)
      toast(`Deleted cron "${deleting}"`)
      setDeleting(null)
      reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <StateWrap loading={loading} error={error}>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {jobs.length} cron job{jobs.length === 1 ? '' : 's'}
        </p>
        <button
          onClick={() => openEditor(null)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          <Plus size={16} />
          New Cron
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {jobs.map((j, i) => {
          const status = j.status ?? 'unknown'
          return (
            <Card key={j.name ?? i} className="group">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-100">{j.name ?? '—'}</h3>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditor(j)}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-indigo-400"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => j.name && setDeleting(j.name)}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <code className="rounded bg-gray-800 px-2 py-0.5 font-mono text-emerald-300">
                  {j.schedule ?? '—'}
                </code>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-medium ${statusClasses(status)}`}
                >
                  {status}
                </span>
                {j.repeat === false && (
                  <span className="rounded-full bg-gray-600/20 px-2.5 py-0.5 text-gray-400">
                    one-shot
                  </span>
                )}
              </div>
              {j.prompt && (
                <p className="mt-3 text-xs text-gray-400 line-clamp-2">{j.prompt}</p>
              )}
              {Array.isArray(j.skills) && j.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {j.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 text-xs text-gray-500">
                Last run: {j.last_run ?? j.lastRun ?? 'never'}
              </div>
            </Card>
          )
        })}
        {jobs.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-gray-800 py-12 text-center text-gray-500">
            No cron jobs
          </div>
        )}
      </div>

      {draft && (
        <Modal
          title={draft.originalName ? `Edit ${draft.originalName}` : 'New cron job'}
          onClose={() => setDraft(null)}
          wide
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">
                  Name
                </label>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  disabled={draft.originalName !== null}
                  placeholder="e.g. daily-digest"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">
                  Schedule (cron expression)
                </label>
                <input
                  value={draft.schedule}
                  onChange={(e) => setDraft({ ...draft, schedule: e.target.value })}
                  placeholder="0 9 * * *"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">
                Prompt
              </label>
              <textarea
                value={draft.prompt}
                onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                rows={6}
                placeholder="What should the agent do on each run?"
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500 transition-colors resize-y"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-2">
                Skills
              </label>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-700 bg-gray-950 px-2 py-1.5">
                {draft.skills.map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-300"
                  >
                    {s}
                    <button
                      onClick={() =>
                        setDraft({ ...draft, skills: draft.skills.filter((x) => x !== s) })
                      }
                      className="text-indigo-400 hover:text-red-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addSkill()
                    }
                  }}
                  onBlur={addSkill}
                  placeholder={draft.skills.length === 0 ? 'Type a skill, press Enter…' : ''}
                  className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
                />
              </div>
            </div>

            <div className="flex gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={draft.repeat}
                  onChange={(e) => setDraft({ ...draft, repeat: e.target.checked })}
                  className="accent-indigo-500"
                />
                Repeat
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={draft.deliver}
                  onChange={(e) => setDraft({ ...draft, deliver: e.target.checked })}
                  className="accent-indigo-500"
                />
                Deliver result
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setDraft(null)}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal
          title="Delete cron job"
          message={`Delete cron job "${deleting}"? Its JSON file in ~/.hermes/cron will be removed.`}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}
    </StateWrap>
  )
}

/* ---------- System ---------- */

function System() {
  const { data, loading, error } = useApi<Record<string, unknown>>('/system')
  const rows = useMemo(() => (data ? flatten(data) : []), [data])
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
    } catch {
      toast('Copy failed', 'error')
    }
  }

  return (
    <StateWrap loading={loading} error={error}>
      <Card className="p-0 overflow-hidden divide-y divide-gray-800">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex items-start justify-between gap-4 px-5 py-3 group transition-colors hover:bg-gray-800/40"
          >
            <span className="text-sm text-gray-400">{k}</span>
            <span className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-sm text-gray-100 text-right break-all">{v}</span>
              <button
                onClick={() => copy(k, v)}
                className="rounded-lg p-1.5 text-gray-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-800 hover:text-gray-200 shrink-0"
                title="Copy"
              >
                {copied === k ? (
                  <Check size={14} className="text-emerald-400" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </span>
          </div>
        ))}
      </Card>
    </StateWrap>
  )
}

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface SessionCorrelationOptions {
  providers: string[]
  header?: string
  storagePath?: string
  createUUID?: () => string
}

interface SessionStore {
  version: 1
  sessions: Record<string, string>
}

function isSessionStore(value: unknown): value is SessionStore {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { version?: unknown; sessions?: unknown }
  if (candidate.version !== 1) return false
  if (!candidate.sessions || typeof candidate.sessions !== 'object') return false
  return Object.values(candidate.sessions).every((entry) => typeof entry === 'string')
}

async function loadStore(path: string): Promise<SessionStore> {
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw)
    if (isSessionStore(parsed)) return parsed
  } catch (_) {
    // Missing, unreadable, or malformed file. Fall through to empty store.
  }
  return { version: 1, sessions: {} }
}

async function saveStore(path: string, store: SessionStore): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tempPath = `${path}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tempPath, JSON.stringify(store, null, 2))
  await rename(tempPath, path)
}

function defaultStoragePath(): string {
  const dataHome = process.env.XDG_DATA_HOME ?? `${process.env.HOME}/.local/share`
  return `${dataHome}/opencode/session-correlation.json`
}

async function getSessionUUID(
  path: string,
  sessionID: string,
  createUUID: () => string,
): Promise<string> {
  const store = await loadStore(path)
  const existing = store.sessions[sessionID]
  if (existing) return existing

  const uuid = createUUID()
  store.sessions[sessionID] = uuid
  await saveStore(path, store)
  return uuid
}

interface ChatHeadersInput {
  sessionID: string
  provider: { id: string }
}

interface ChatHeadersOutput {
  headers: Record<string, string>
}

export interface SessionCorrelationHooks {
  'chat.headers'?: (input: ChatHeadersInput, output: ChatHeadersOutput) => Promise<void>
}

const DEFAULT_HEADER = 'x-claude-code-session-id'

function validateOptions(options: unknown): SessionCorrelationOptions {
  if (!options || typeof options !== 'object') {
    throw new Error('opencode-session-correlation: plugin options are required')
  }
  const candidate = options as Partial<SessionCorrelationOptions>
  const providers = candidate.providers
  if (!Array.isArray(providers) || providers.length === 0 || !providers.every((id) => typeof id === 'string')) {
    throw new Error('opencode-session-correlation: options.providers must be a non-empty array of provider ID strings')
  }
  return { ...candidate, providers } as SessionCorrelationOptions
}

export async function createSessionCorrelationPlugin(
  options: SessionCorrelationOptions,
): Promise<SessionCorrelationHooks> {
  const providers = new Set(options.providers)
  const header = options.header ?? DEFAULT_HEADER
  const storagePath = options.storagePath ?? defaultStoragePath()
  const createUUID = options.createUUID ?? randomUUID

  return {
    'chat.headers': async (input, output) => {
      if (!input.sessionID) return
      if (!providers.has(input.provider.id)) return

      output.headers[header] = await getSessionUUID(storagePath, input.sessionID, createUUID)
    },
  }
}

export default async function sessionCorrelationPlugin(
  _input: unknown,
  options?: unknown,
): Promise<SessionCorrelationHooks> {
  const validated = validateOptions(options)
  return createSessionCorrelationPlugin(validated)
}

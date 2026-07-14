import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface SessionInfo {
  parentID?: string
}

export interface SessionCorrelationOptions {
  providers: string[]
  storagePath?: string
  createUUID?: () => string
  collapseToRootSession?: boolean
  getSession?: (sessionID: string) => Promise<SessionInfo | undefined>
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

const MAX_PARENT_CHAIN_DEPTH = 50

function createRootSessionResolver(getSession: (sessionID: string) => Promise<SessionInfo | undefined>) {
  const cache = new Map<string, string>()

  return async function resolveRootSessionID(sessionID: string): Promise<string> {
    const cached = cache.get(sessionID)
    if (cached) return cached

    const chain: string[] = []
    let current = sessionID

    for (let depth = 0; depth < MAX_PARENT_CHAIN_DEPTH; depth += 1) {
      const cachedCurrent = cache.get(current)
      if (cachedCurrent) {
        for (const id of chain) cache.set(id, cachedCurrent)
        cache.set(sessionID, cachedCurrent)
        return cachedCurrent
      }

      chain.push(current)

      let info: SessionInfo | undefined
      try {
        info = await getSession(current)
      } catch (_) {
        // Cannot resolve the parent chain. Fall back to the original session ID as its own root.
        for (const id of chain) cache.set(id, sessionID)
        return sessionID
      }

      if (!info?.parentID) {
        for (const id of chain) cache.set(id, current)
        return current
      }

      current = info.parentID
    }

    // Defensive: chain too deep or cyclic. Treat the original session as its own root.
    for (const id of chain) cache.set(id, sessionID)
    return sessionID
  }
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

// Fixed to match the real Claude Code CLI's session header name. This is what
// makes gateways that special-case Claude Code (e.g. session grouping in a
// LiteLLM deployment) recognize OpenCode sessions the same way. It is not
// configurable: any other name defeats the mimicry this plugin exists for.
const CLAUDE_CODE_SESSION_HEADER = 'x-claude-code-session-id'

function validateOptions(options: unknown): SessionCorrelationOptions {
  if (!options || typeof options !== 'object') {
    throw new Error('opencode-session-correlation: plugin options are required')
  }
  const candidate = options as Partial<SessionCorrelationOptions>
  const providers = candidate.providers
  if (!Array.isArray(providers) || providers.length === 0 || !providers.every((id) => typeof id === 'string')) {
    throw new Error('opencode-session-correlation: options.providers must be a non-empty array of provider ID strings')
  }
  if (candidate.collapseToRootSession !== undefined && typeof candidate.collapseToRootSession !== 'boolean') {
    throw new Error('opencode-session-correlation: options.collapseToRootSession must be a boolean')
  }
  return { ...candidate, providers } as SessionCorrelationOptions
}

export async function createSessionCorrelationPlugin(
  options: SessionCorrelationOptions,
): Promise<SessionCorrelationHooks> {
  const providers = new Set(options.providers)
  const storagePath = options.storagePath ?? defaultStoragePath()
  const createUUID = options.createUUID ?? randomUUID
  const resolveRootSessionID = options.collapseToRootSession
    ? createRootSessionResolver(options.getSession ?? (async () => undefined))
    : undefined

  return {
    'chat.headers': async (input, output) => {
      if (!input.sessionID) return
      if (!providers.has(input.provider.id)) return

      const mappingKey = resolveRootSessionID
        ? await resolveRootSessionID(input.sessionID)
        : input.sessionID

      output.headers[CLAUDE_CODE_SESSION_HEADER] = await getSessionUUID(storagePath, mappingKey, createUUID)
    },
  }
}

interface OpenCodeClientLike {
  session?: {
    get?: (parameters: { path: { id: string } }) => Promise<
      { data?: SessionInfo; error?: unknown } | undefined
    >
  }
}

export default async function sessionCorrelationPlugin(
  input: unknown,
  options?: unknown,
): Promise<SessionCorrelationHooks> {
  const validated = validateOptions(options)

  if (validated.collapseToRootSession && !validated.getSession) {
    const client = (input as { client?: OpenCodeClientLike } | undefined)?.client
    validated.getSession = async (sessionID) => {
      if (!client?.session?.get) return undefined
      const result = await client.session.get({ path: { id: sessionID } })
      if (!result || result.error) return undefined
      return result.data
    }
  }

  return createSessionCorrelationPlugin(validated)
}

import { randomUUID } from 'node:crypto'

export interface SessionCorrelationOptions {
  providers: string[]
  header?: string
  storagePath?: string
  createUUID?: () => string
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

export async function createSessionCorrelationPlugin(
  options: SessionCorrelationOptions,
): Promise<SessionCorrelationHooks> {
  const providers = new Set(options.providers)
  const header = options.header ?? DEFAULT_HEADER
  const createUUID = options.createUUID ?? randomUUID

  return {
    'chat.headers': async (input, output) => {
      if (!input.sessionID) return
      if (!providers.has(input.provider.id)) return

      output.headers[header] = createUUID()
    },
  }
}

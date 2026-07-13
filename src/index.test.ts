import { describe, expect, test } from 'bun:test'
import { createSessionCorrelationPlugin } from './index.js'
import plugin from './index.js'

test('adds a stable session UUID for configured provider', async () => {
  const plugin = await createSessionCorrelationPlugin({
    providers: ['ryanair-gateway'],
    storagePath: '/tmp/session-correlation-test.json',
    createUUID: () => '11111111-1111-4111-8111-111111111111',
  })
  const output = { headers: {} as Record<string, string> }

  await plugin['chat.headers']!(
    { sessionID: 'ses_native', provider: { id: 'ryanair-gateway' } } as any,
    output,
  )

  expect(output.headers['x-claude-code-session-id']).toBe('11111111-1111-4111-8111-111111111111')
})

test('does not change headers for an unconfigured provider', async () => {
  const plugin = await createSessionCorrelationPlugin({
    providers: ['ryanair-gateway'],
    storagePath: '/tmp/session-correlation-test.json',
  })
  const output = { headers: { existing: 'value' } }

  await plugin['chat.headers']!(
    { sessionID: 'ses_native', provider: { id: 'other-provider' } } as any,
    output,
  )

  expect(output.headers).toEqual({ existing: 'value' })
})

test('reuses persisted UUID for same native session across plugin instances', async () => {
  const path = '/tmp/session-correlation-persistence-test.json'
  await Bun.write(path, JSON.stringify({ version: 1, sessions: { ses_native: '22222222-2222-4222-8222-222222222222' } }))
  const plugin = await createSessionCorrelationPlugin({ providers: ['ryanair-gateway'], storagePath: path })
  const output = { headers: {} as Record<string, string> }

  await plugin['chat.headers']!(
    { sessionID: 'ses_native', provider: { id: 'ryanair-gateway' } } as any,
    output,
  )

  expect(output.headers['x-claude-code-session-id']).toBe('22222222-2222-4222-8222-222222222222')
})

test('default plugin factory creates configured hook', async () => {
  const hooks = await plugin({} as any, {
    providers: ['ryanair-gateway'],
    storagePath: '/tmp/session-correlation-export-test.json',
  } as any)
  expect(hooks['chat.headers']).toBeDefined()
})

test('collapseToRootSession off (default) keys mapping by the calling session, not its root', async () => {
  const path = '/tmp/session-correlation-collapse-off-test.json'
  await Bun.write(path, JSON.stringify({ version: 1, sessions: {} }))
  const getSession = async (id: string) => (id === 'ses_child' ? { parentID: 'ses_root' } : undefined)
  const plugin = await createSessionCorrelationPlugin({
    providers: ['ryanair-gateway'],
    storagePath: path,
    createUUID: () => '33333333-3333-4333-8333-333333333333',
    getSession,
  })
  const output = { headers: {} as Record<string, string> }

  await plugin['chat.headers']!(
    { sessionID: 'ses_child', provider: { id: 'ryanair-gateway' } } as any,
    output,
  )

  expect(output.headers['x-claude-code-session-id']).toBe('33333333-3333-4333-8333-333333333333')
  const stored = await Bun.file(path).json()
  expect(stored.sessions['ses_child']).toBe('33333333-3333-4333-8333-333333333333')
  expect(stored.sessions['ses_root']).toBeUndefined()
})

test('collapseToRootSession true maps a child session to its root session UUID', async () => {
  const path = '/tmp/session-correlation-collapse-on-test.json'
  await Bun.write(path, JSON.stringify({ version: 1, sessions: {} }))
  const getSession = async (id: string) => (id === 'ses_child' ? { parentID: 'ses_root' } : undefined)
  const plugin = await createSessionCorrelationPlugin({
    providers: ['ryanair-gateway'],
    storagePath: path,
    collapseToRootSession: true,
    createUUID: () => '44444444-4444-4444-8444-444444444444',
    getSession,
  })
  const childOutput = { headers: {} as Record<string, string> }
  const rootOutput = { headers: {} as Record<string, string> }

  await plugin['chat.headers']!(
    { sessionID: 'ses_child', provider: { id: 'ryanair-gateway' } } as any,
    childOutput,
  )
  await plugin['chat.headers']!(
    { sessionID: 'ses_root', provider: { id: 'ryanair-gateway' } } as any,
    rootOutput,
  )

  expect(childOutput.headers['x-claude-code-session-id']).toBe('44444444-4444-4444-8444-444444444444')
  expect(rootOutput.headers['x-claude-code-session-id']).toBe('44444444-4444-4444-8444-444444444444')
  const stored = await Bun.file(path).json()
  expect(stored.sessions['ses_root']).toBe('44444444-4444-4444-8444-444444444444')
  expect(stored.sessions['ses_child']).toBeUndefined()
})

test('collapseToRootSession true only resolves each session parent chain once', async () => {
  const path = '/tmp/session-correlation-collapse-cache-test.json'
  let calls = 0
  const getSession = async (id: string) => {
    calls += 1
    return id === 'ses_child' ? { parentID: 'ses_root' } : undefined
  }
  const plugin = await createSessionCorrelationPlugin({
    providers: ['ryanair-gateway'],
    storagePath: path,
    collapseToRootSession: true,
    getSession,
  })

  await plugin['chat.headers']!(
    { sessionID: 'ses_child', provider: { id: 'ryanair-gateway' } } as any,
    { headers: {} },
  )
  await plugin['chat.headers']!(
    { sessionID: 'ses_child', provider: { id: 'ryanair-gateway' } } as any,
    { headers: {} },
  )

  expect(calls).toBe(2)
})

test('collapseToRootSession true falls back to the calling session ID when getSession throws', async () => {
  const path = '/tmp/session-correlation-collapse-error-test.json'
  const getSession = async () => {
    throw new Error('boom')
  }
  const plugin = await createSessionCorrelationPlugin({
    providers: ['ryanair-gateway'],
    storagePath: path,
    collapseToRootSession: true,
    createUUID: () => '55555555-5555-4555-8555-555555555555',
    getSession,
  })
  const output = { headers: {} as Record<string, string> }

  await plugin['chat.headers']!(
    { sessionID: 'ses_child', provider: { id: 'ryanair-gateway' } } as any,
    output,
  )

  expect(output.headers['x-claude-code-session-id']).toBe('55555555-5555-4555-8555-555555555555')
})

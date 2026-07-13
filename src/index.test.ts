import { describe, expect, test } from 'bun:test'
import { createSessionCorrelationPlugin } from './index.js'

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

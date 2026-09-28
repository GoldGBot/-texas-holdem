import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serve } from '@hono/node-server'
import { createApi } from '../api/routes'
import { RoomManager } from '../rooms/room-manager'
import { WsHandler } from '../ws/ws-handler'
import { signToken } from '../auth/jwt'
import WebSocket from 'ws'

const PORT = 3199
let server: ReturnType<typeof serve>
let roomManager: RoomManager
let wsHandler: WsHandler

// In-memory fake user repo (no DB available in test env)
const balances = new Map<string, number>()
const repoCalls = { addChips: [] as { id: string; delta: number }[] }
const fakeRepo = {
  async findById(id: string) {
    return {
      id,
      username: id,
      nickname: id,
      avatar: '',
      chips_balance: balances.get(id) ?? 0,
      games_played: 0,
      games_won: 0,
      created_at: '',
    }
  },
  async addChips(id: string, delta: number) {
    repoCalls.addChips.push({ id, delta })
    balances.set(id, (balances.get(id) ?? 0) + delta)
  },
  async updateChips(id: string, chips: number) {
    balances.set(id, chips)
  },
  async incrementGames() {},
  async incrementWins() {},
  async updateAvatar() {},
} as any

function connectWs(userId: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws?token=${signToken({ userId, username: userId })}`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function waitForEvent(ws: WebSocket, eventName: string, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for "${eventName}"`)), timeoutMs)
    const handler = (raw: any) => {
      const msg = JSON.parse(raw.toString())
      if (msg.event === eventName) {
        clearTimeout(timeout)
        ws.off('message', handler)
        resolve(msg.data)
      }
    }
    ws.on('message', handler)
  })
}

function send(ws: WebSocket, event: string, data: any) {
  ws.send(JSON.stringify({ event, data }))
}

describe('Buy-in flow', () => {
  beforeAll(() => {
    balances.set('host', 50000)
    balances.set('guest', 50000)
    roomManager = new RoomManager()
    wsHandler = new WsHandler(roomManager, fakeRepo)
    const api = createApi(roomManager, fakeRepo)
    server = serve({ fetch: api.fetch, port: PORT })
    server.on('upgrade', (req: any, socket: any, head: any) => {
      if (req.url?.startsWith('/ws')) {
        wsHandler.getWss().handleUpgrade(req, socket, head, (ws: any) => {
          wsHandler.getWss().emit('connection', ws, req)
        })
      } else {
        socket.destroy()
      }
    })
  })

  afterAll(() => {
    server.close()
  })

  it('seats players with the chosen buy-in and settles the delta on leave', async () => {
    // Host creates a room with buyIn 1000 via API
    const res = await fetch(`http://localhost:${PORT}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken({ userId: 'host', username: 'host' })}` },
      body: JSON.stringify({
        config: { blinds: { small: 10, big: 20 }, buyIn: 1000, maxPlayers: 6, turnTime: 30 },
      }),
    })
    expect(res.status).toBe(200)
    const { code } = await res.json()

    const hostWs = await connectWs('host')
    const guestWs = await connectWs('guest')

    const hostState = waitForEvent(hostWs, 'room-state')
    send(hostWs, 'join-room', { code, nickname: 'Host', avatar: '🦊:#e74c3c' })
    const { room: hostRoom } = await hostState
    expect(hostRoom.players.find((p: any) => p.id === 'host').chips).toBe(1000)

    const guestState = waitForEvent(guestWs, 'room-state')
    send(guestWs, 'join-room', { code, nickname: 'Guest', avatar: '🐺:#3498db' })
    const { room: guestRoom } = await guestState
    expect(guestRoom.players.find((p: any) => p.id === 'guest').chips).toBe(1000)

    // Wait for host to see the guest, then both ready → game auto-starts
    const hostGameStart = waitForEvent(hostWs, 'game-start')
    const guestGameStart = waitForEvent(guestWs, 'game-start')
    const guestCards = waitForEvent(guestWs, 'deal-cards')
    send(hostWs, 'player-ready', {})
    await new Promise((r) => setTimeout(r, 100)) // let host ready propagate
    send(guestWs, 'player-ready', {})
    await hostGameStart
    await guestGameStart
    const { cards } = await guestCards
    expect(cards).toHaveLength(2)

    // Guest leaves mid-game with 990 chips (lost 10 SB) → delta -10 settled
    send(guestWs, 'leave-room', {})
    await new Promise((r) => setTimeout(r, 200))
    const settleCall = repoCalls.addChips.find((c) => c.id === 'guest')
    expect(settleCall).toBeDefined()
    expect(settleCall!.delta).toBe(990 - 1000)
    expect(balances.get('guest')).toBe(50000 - 10)

    hostWs.close()
    guestWs.close()
  }, 15000)
})

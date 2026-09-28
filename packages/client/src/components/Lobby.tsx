import { useState, useEffect } from 'react'
import { useGameStore } from '../stores/game-store'

const BUY_IN_OPTIONS = [1000, 5000, 10000, 50000]

export function Lobby() {
  const [roomCode, setRoomCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [buyIn, setBuyIn] = useState(10000)
  const user = useGameStore((s) => s.user)
  const createRoom = useGameStore((s) => s.createRoom)
  const joinRoom = useGameStore((s) => s.joinRoom)
  const logout = useGameStore((s) => s.logout)

  useEffect(() => {
    const code = sessionStorage.getItem('joinCode')
    if (code) {
      setRoomCode(code)
      sessionStorage.removeItem('joinCode')
    }
  }, [])

  const handleCreate = async () => {
    if (creating) return
    setCreating(true)
    const result = await createRoom({
      blinds: { small: 10, big: 20 },
      buyIn,
      maxPlayers: 6,
      turnTime: 30,
    })
    if (result.error) {
      setCreating(false)
    }
  }

  const handleJoin = () => {
    if (!roomCode.trim()) return
    joinRoom(roomCode.toUpperCase())
  }

  if (!user) return null

  const [emoji, color] = (user.avatar || '🦊:#e74c3c').split(':')

  return (
    <div className="h-dvh bg-[#0a0a0a] text-white flex items-center justify-center px-4 overflow-auto">
      <div className="w-full max-w-sm landscape:max-w-2xl flex flex-col landscape:flex-row landscape:gap-10 landscape:items-center gap-5 py-6">

        {/* Left: user info + create */}
        <div className="flex flex-col gap-4 landscape:flex-1 landscape:min-w-0">
          {/* User card */}
          <div className="flex items-center gap-3 bg-[#111] border border-[#1a1a1a] rounded-xl p-3">
            <div
              className="w-10 h-10 rounded-full text-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: color ?? '#555' }}
            >
              {emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.nickname}</p>
              <p className="text-[10px] text-[#8a7a5a] font-mono">
                💰 {user.chips_balance.toLocaleString()} · 🏆 {user.games_won}/{user.games_played}
              </p>
            </div>
            <button
              onClick={logout}
              className="text-[10px] text-[#555] hover:text-[#888] transition-colors px-2"
            >
              退出
            </button>
          </div>

          {/* Buy-in selector */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-[#8a7a5a] mb-2">
              买入筹码（当前余额 {user.chips_balance.toLocaleString()}）
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {BUY_IN_OPTIONS.map((v) => (
                <button
                  key={v}
                  onClick={() => setBuyIn(v)}
                  className={`py-2 rounded-lg text-xs font-bold font-mono transition-all active:scale-95 ${
                    buyIn === v
                      ? 'bg-gradient-to-r from-[#b8860b] to-[#d4a843] text-black shadow-[0_2px_8px_rgba(212,168,67,0.35)]'
                      : 'bg-[#1a1a1a] text-[#8a7a5a] border border-[#2a2a2a] hover:border-[#4a4a3a]'
                  }`}
                >
                  {v >= 10000 ? `${v / 10000}万` : v.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Create room */}
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full py-3 rounded-xl font-bold text-black bg-gradient-to-r from-[#b8860b] to-[#d4a843] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-sm"
            style={{ textShadow: '0 1px 0 rgba(255,255,255,0.2)' }}
          >
            {creating ? '创建中...' : '创建房间'}
          </button>
        </div>

        {/* Right: join */}
        <div className="flex flex-col gap-4 landscape:flex-1 landscape:min-w-0">
          {/* Divider (portrait only) */}
          <div className="flex items-center gap-3 landscape:hidden">
            <div className="flex-1 h-px bg-[#1a1a1a]" />
            <span className="text-[#444] text-xs">或</span>
            <div className="flex-1 h-px bg-[#1a1a1a]" />
          </div>

          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="输入房间码"
            maxLength={6}
            className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-[#d4a843] placeholder-[#444] text-center font-mono tracking-[0.3em] uppercase outline-none focus:border-[#b8860b] transition-colors text-sm"
          />

          <button
            onClick={handleJoin}
            disabled={!roomCode.trim()}
            className="w-full py-3 rounded-xl font-bold text-[#b8a060] bg-[#111] border border-[#2a2a2a] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#4a4a3a] transition-colors text-sm"
          >
            加入房间
          </button>
        </div>
      </div>
    </div>
  )
}

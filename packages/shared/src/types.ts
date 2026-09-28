export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const
export type Suit = (typeof SUITS)[number]

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
export type Rank = (typeof RANKS)[number]

export interface Card { suit: Suit; rank: Rank }

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank })
  return deck
}

/** Uniform random int in [0, maxExclusive) using a CSPRNG when available (true randomness) */
function secureRandomInt(maxExclusive: number): number {
  // Structural type — shared is compiled without DOM/Node lib globals
  const cryptoObj = (globalThis as { crypto?: { getRandomValues(buf: Uint32Array): Uint32Array } }).crypto
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const buf = new Uint32Array(1)
    // Rejection sampling to avoid modulo bias
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive
    let value: number
    do {
      cryptoObj.getRandomValues(buf)
      value = buf[0]!
    } while (value >= limit)
    return value % maxExclusive
  }
  return Math.floor(Math.random() * maxExclusive)
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export type PlayerStatus = 'active' | 'folded' | 'allIn' | 'sitting'
export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'settle'
export type RoomStatus = 'waiting' | 'playing'
export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allIn'

export interface Blinds { small: number; big: number }
export interface RoomConfig { blinds: Blinds; buyIn: number; maxPlayers: number; turnTime: number }

export interface PlayerInfo {
  id: string; nickname: string; avatar: string; seatIndex: number;
  chips: number; status: PlayerStatus; isReady: boolean; isConnected: boolean;
  isAI?: boolean;
}

export interface RoomState {
  id: string; code: string; hostId: string; status: RoomStatus;
  config: RoomConfig; players: PlayerInfo[]; game: GameState | null;
}

export interface GameState {
  id: string; phase: GamePhase; dealerSeat: number; pot: number;
  communityCards: Card[]; currentTurn: number; turnDeadline: number; sidePots: SidePot[];
}

export interface SidePot { amount: number; eligible: number[] }

export interface PlayerHandState {
  seatIndex: number; bet: number; totalBet: number; hasActed: boolean;
  cards?: [Card, Card];
}

export const HAND_RANKS = [
  'high-card', 'one-pair', 'two-pair', 'three-of-a-kind', 'straight',
  'flush', 'full-house', 'four-of-a-kind', 'straight-flush', 'royal-flush',
] as const
export type HandRank = (typeof HAND_RANKS)[number]

export interface HandResult { rank: HandRank; rankValue: number; bestCards: Card[]; kickers: number[] }

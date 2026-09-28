import { describe, it, expect } from 'vitest'
import { GameEngine } from '../engine/game-engine'
import { makeDecision, type GameContext } from '../ai/ai-decision'
import { getPersonality } from '../ai/personalities'
import type { Card } from '@texas-holdem/shared'

function buildContext(engine: GameEngine, seatIndex: number, holeCards: [Card, Card]): GameContext {
  const state = engine.getState()
  const handStates = engine.getPlayerHandStates()
  const me = handStates.find((h) => h.seatIndex === seatIndex)!
  const player = engine.getPlayerState(seatIndex)!
  const numOpponents = handStates.filter(
    (h) => h.seatIndex !== seatIndex && h.status !== 'folded'
  ).length
  const effectivePot = state.pot + handStates.reduce((s, h) => s + h.bet, 0)

  return {
    holeCards,
    communityCards: state.communityCards,
    pot: effectivePot,
    currentBet: engine.getCurrentBet(),
    myBet: me.bet,
    myChips: player.chips,
    minRaise: engine.getMinRaise(),
    numOpponents: Math.max(1, numOpponents),
    phase: state.phase,
    position: 'late',
    actionHistory: [],
  }
}

describe('AI fallback decisions', () => {
  it('two maniacs cannot raise-war forever and chips are conserved', async () => {
    const engine = new GameEngine(10, 20)
    engine.addPlayer(0, 'p0', 10000)
    engine.addPlayer(1, 'p1', 10000)
    engine.startHand(0)

    const maniac = getPersonality('maniac')!
    const holeCards: [Card, Card][] = [engine.getPlayerCards(0)!, engine.getPlayerCards(1)!]

    let actions = 0
    // Play the whole hand until no one needs to act (showdown/settle -> currentTurn === -1)
    while (engine.getState().currentTurn >= 0 && actions < 100) {
      const seat = engine.getState().currentTurn
      const ctx = buildContext(engine, seat, holeCards[seat])
      const action = await makeDecision(maniac, ctx)
      const ok = engine.handleAction(seat, action.type, action.amount)
      expect(ok).toBe(true)
      actions++
    }

    // Old buggy behavior: ~60 min-raises in a single betting round.
    // Fixed behavior: raises escalate quickly and end in an all-in or call.
    expect(actions).toBeLessThanOrEqual(40)

    // Chips conservation: chips + bets on table + collected pot must equal the starting total
    const inPlay = [0, 1]
      .map((s) => {
        const p = engine.getPlayerState(s)!
        return p.chips + p.bet
      })
      .reduce((a, b) => a + b, 0)
    expect(inPlay + engine.getState().pot).toBe(20000)
  })

  it('AI never bets more chips than it has', async () => {
    const engine = new GameEngine(10, 20)
    engine.addPlayer(0, 'p0', 10000)
    engine.addPlayer(1, 'p1', 10000)
    engine.startHand(0)

    const maniac = getPersonality('maniac')!
    const holeCards: [Card, Card][] = [engine.getPlayerCards(0)!, engine.getPlayerCards(1)!]

    let actions = 0
    while (engine.getState().currentTurn >= 0 && actions < 100) {
      const seat = engine.getState().currentTurn
      const before = engine.getPlayerState(seat)!.chips
      const ctx = buildContext(engine, seat, holeCards[seat])
      const action = await makeDecision(maniac, ctx)
      engine.handleAction(seat, action.type, action.amount)
      const after = engine.getPlayerState(seat)!.chips
      expect(after).toBeGreaterThanOrEqual(0)
      expect(after).toBeLessThanOrEqual(before)
      actions++
    }
  })
})

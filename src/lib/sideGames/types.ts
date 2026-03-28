// Shared types for all side game engines

export interface SettlementEntry {
  fromPlayerId: string
  toPlayerId: string
  amount: number // positive = fromPlayerId owes toPlayerId
  description: string
}

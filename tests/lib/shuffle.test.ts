import { describe, it, expect } from 'vitest'
import { shuffle } from '@/lib/utils/shuffle'

describe('shuffle', () => {
  it('preserves all elements (same multiset) for numbers', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffle(input)
    expect([...result].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b))
  })

  it('does not mutate the input array', () => {
    const input = [1, 2, 3]
    const copy = [...input]
    shuffle(input)
    expect(input).toEqual(copy)
  })

  it('returns an array of the same length for objects', () => {
    const input = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const result = shuffle(input)
    expect(result).toHaveLength(3)
    expect(result.map((r) => r.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('eventually produces a different order across repeated calls', () => {
    const input = Array.from({ length: 10 }, (_, i) => i)
    const orders = new Set<string>()
    for (let i = 0; i < 20; i++) {
      orders.add(shuffle(input).join(','))
    }
    expect(orders.size).toBeGreaterThan(1)
  })
})

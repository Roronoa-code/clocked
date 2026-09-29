import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveSession, Agreement } from '../types'
import { useClockedTimer } from './useClockedTimer'

const agreement: Agreement = {
  id: 'agreement-1',
  sisterName: 'Sister',
  originalDebtGBP: 60,
  hourlyRateUSD: 6,
  exchangeRateUSDToGBP: 0.8,
  exchangeRateSource: 'Test',
  exchangeRateDate: '2026-09-29',
  createdAt: '2026-09-29T00:00:00.000Z',
}

type TimerProps = Parameters<typeof useClockedTimer>[0]
let timer: ReturnType<typeof useClockedTimer>
let root: Root
let container: HTMLDivElement

function TimerProbe({ props }: { props: TimerProps }) {
  timer = useClockedTimer(props)
  return null
}

async function mount(props: TimerProps) {
  await act(async () => {
    root.render(createElement(TimerProbe, { props }))
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-29T09:00:00.000Z'))
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('useClockedTimer', () => {
  it('retries the same frozen record, keeps the real start time, and cancels stale save notices', async () => {
    const start = new Date('2026-09-29T09:15:00.000Z')
    vi.setSystemTime(start)
    const onSaveSession = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const persist = vi.fn(async (_session: ActiveSession | null, _expected: ActiveSession | null) => true)
    await mount({ agreement, onSaveSession, initialActiveSession: null, onPersistActiveSession: persist })

    await act(async () => { await timer.clockIn('Kitchen') })
    await act(async () => { vi.advanceTimersByTime(5_000) })
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => { expect(await timer.save()).toBe(false) })
    expect(timer.activeSession?.status).toBe('paused')
    expect(timer.elapsedSeconds).toBe(5)

    await act(async () => { vi.advanceTimersByTime(12_000) })
    expect(timer.elapsedSeconds).toBe(5)
    const writesBeforeRetry = persist.mock.calls.length
    await act(async () => { expect(await timer.retrySave()).toBe(true) })
    expect(persist).toHaveBeenCalledTimes(writesBeforeRetry)
    logError.mockRestore()

    const [first, second] = onSaveSession.mock.calls.map(([record]) => record)
    expect(first).toBe(second)
    expect(Object.isFrozen(first)).toBe(true)
    expect(first.activeDurationSec).toBe(5)
    expect(first.hourlyRateUSD).toBe(agreement.hourlyRateUSD)
    const localStart = new Date(start)
    expect(first.date).toBe([
      localStart.getFullYear(),
      String(localStart.getMonth() + 1).padStart(2, '0'),
      String(localStart.getDate()).padStart(2, '0'),
    ].join('-'))
    expect(first.startTime).toBe(localStart.toTimeString().split(' ')[0])

    await act(async () => { await timer.clockIn('Laundry') })
    await act(async () => { vi.advanceTimersByTime(4_000) })
    expect(timer.timerStatus).toBe('running')
    expect(timer.lastSavedInfo).toBeNull()
  })

  it('keeps an idle task draft and writes task plus corrected duration together', async () => {
    const persist = vi.fn(async (_session: ActiveSession | null) => true)
    await mount({
      agreement,
      onSaveSession: vi.fn(async () => true),
      initialActiveSession: null,
      onPersistActiveSession: persist,
    })

    await act(async () => { expect(await timer.updateTaskNote('Wash dishes')).toBe(true) })
    expect(timer.taskNoteDraft).toBe('Wash dishes')
    await act(async () => { expect(await timer.clockIn()).toBe(true) })
    expect(persist.mock.calls.at(-1)?.[0]?.taskNote).toBe('Wash dishes')
    await act(async () => { vi.advanceTimersByTime(6_000) })
    await act(async () => { expect(await timer.pause()).toBe(true) })

    const writesBeforeEdit = persist.mock.calls.length
    await act(async () => { expect(await timer.correctTime(123, 'Clean room')).toBe(true) })
    expect(persist).toHaveBeenCalledTimes(writesBeforeEdit + 1)
    expect(persist.mock.calls.at(-1)?.[0]).toMatchObject({
      activeDurationMs: 123_000,
      taskNote: 'Clean room',
      status: 'paused',
    })
  })

  it('does not enter a timer state when active-session persistence returns false', async () => {
    const persist = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    await mount({
      agreement,
      onSaveSession: vi.fn(async () => true),
      initialActiveSession: null,
      onPersistActiveSession: persist,
    })

    await act(async () => { expect(await timer.clockIn('Draft')).toBe(false) })
    expect(timer.activeSession).toBeNull()
    expect(timer.timerStatus).toBe('idle')
    expect(timer.saveErrorMessage).toBeTruthy()

    await act(async () => { expect(await timer.clockIn('Draft')).toBe(true) })
    const runningSession = timer.activeSession
    await act(async () => { expect(await timer.pause()).toBe(false) })
    expect(timer.activeSession).toEqual(runningSession)
    expect(timer.activeSession?.status).toBe('running')
  })

  it('keeps a saved session pending when local storage cannot clear it, then clears without saving twice', async () => {
    const onSaveSession = vi.fn(async () => true)
    await mount({ agreement, onSaveSession })
    await act(async () => { await timer.clockIn('Laundry') })
    await act(async () => { vi.advanceTimersByTime(1_000) })

    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => { expect(await timer.save()).toBe(false) })
    expect(timer.activeSession?.status).toBe('paused')
    expect(timer.timerStatus).toBe('save_failed')
    expect(onSaveSession).toHaveBeenCalledTimes(1)

    removeItem.mockRestore()
    await act(async () => { expect(await timer.retrySave()).toBe(true) })
    expect(onSaveSession).toHaveBeenCalledTimes(1)
    expect(timer.activeSession).toBeNull()
    logError.mockRestore()
  })

  it('keeps the frozen snapshot while server rehydration arrives during a save', async () => {
    let finishFreeze!: (success: boolean) => void
    const freezeWrite = new Promise<boolean>((resolve) => { finishFreeze = resolve })
    const startedAt = Date.now()
    const activeSession: ActiveSession = {
      id: 'session-1',
      agreementId: agreement.id,
      startedAt,
      activeDurationMs: 0,
      currentRunStartedAt: startedAt,
      status: 'running',
      taskNote: 'Laundry',
    }
    const persist = vi.fn((next: ActiveSession | null) =>
      next?.status === 'paused' ? freezeWrite : Promise.resolve(true)
    )
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await mount({
      agreement,
      onSaveSession: vi.fn(async () => false),
      initialActiveSession: activeSession,
      onPersistActiveSession: persist,
    })
    await act(async () => { vi.advanceTimersByTime(5_000) })

    let saveResult!: Promise<boolean>
    await act(async () => { saveResult = timer.save() })
    await mount({
      agreement,
      onSaveSession: vi.fn(async () => false),
      initialActiveSession: null,
      onPersistActiveSession: persist,
    })
    expect(timer.activeSession?.status).toBe('paused')
    expect(timer.elapsedSeconds).toBe(5)

    finishFreeze(true)
    await act(async () => { expect(await saveResult).toBe(false) })
    expect(timer.activeSession).toBeNull()
    logError.mockRestore()
  })
})

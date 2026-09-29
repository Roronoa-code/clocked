import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DotMatrixNumeral } from './DotMatrixNumeral'
import { ModalSheet } from './ModalSheet'
import { SessionHistory } from './SessionHistory'
import { SupportingTotals } from './SupportingTotals'
import { DebtHero } from './DebtHero'
import { PinGate } from './PinGate'
import { calculateProjectedSummary, recalculateSessions } from '../utils/calculations'

let root: Root
let appRoot: HTMLDivElement

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  vi.useFakeTimers()
  appRoot = document.createElement('div')
  appRoot.id = 'root'
  document.body.appendChild(appRoot)
  root = createRoot(appRoot)
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

describe('shared UI surfaces', () => {
  it('validates an empty PIN inline without submitting a login request', () => {
    const onSignIn = vi.fn()
    act(() => root.render(<PinGate onSignIn={onSignIn} />))
    const form = appRoot.querySelector('form')!
    expect(form.noValidate).toBe(true)
    act(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(onSignIn).not.toHaveBeenCalled()
    expect(appRoot.querySelector('[role="alert"]')?.textContent).toContain('4–12 digits')
    expect(document.activeElement?.id).toBe('clocked-pin')
    expect(document.activeElement?.getAttribute('aria-describedby')).toBe('pin-error')
  })

  it('distinguishes projected progress from saved completion, including fractional debt', () => {
    const agreement = { id: 'a', sisterName: 'Daremo', originalDebtGBP: 60.25,
      hourlyRateUSD: 6, exchangeRateUSDToGBP: 1, exchangeRateSource: 'Agreed',
      exchangeRateDate: '2026-09-29', createdAt: '2026-09-29T10:00:00Z' }
    const saved = recalculateSessions([], agreement).summary
    act(() => root.render(<DebtHero summary={saved} agreement={agreement} isSessionActive={false} />))
    expect(appRoot.textContent).toContain('£0.00 cleared of £60.25')
    expect(appRoot.querySelector('.progress-stamp')?.textContent).toBe('0%')

    const nearly = calculateProjectedSummary(saved, 36149, agreement)
    act(() => root.render(<DebtHero summary={nearly} agreement={agreement} isSessionActive />))
    expect(appRoot.querySelector('.progress-stamp')?.getAttribute('aria-label')).toBe('99% after this session')
    expect(appRoot.textContent).toContain('Less than £0.01')
    const finished = calculateProjectedSummary(saved, 36150, agreement)
    act(() => root.render(<DebtHero summary={finished} agreement={agreement} isSessionActive />))
    expect(appRoot.querySelector('.progress-stamp')?.getAttribute('aria-label')).toBe('100% after this session')
    expect(appRoot.textContent).not.toContain('Debt cleared')
  })

  it('keeps dot cells and reserved bounds when digits change', () => {
    act(() =>
      root.render(
        <DotMatrixNumeral amountString="9.99" reservedCharacterCount={6} />,
      ),
    )
    const originalSvg = appRoot.querySelector('svg')!
    const originalCell = originalSvg.querySelector('g circle')!
    const originalViewBox = originalSvg.getAttribute('viewBox')

    act(() =>
      root.render(
        <DotMatrixNumeral amountString="8.99" reservedCharacterCount={6} />,
      ),
    )

    const updatedSvg = appRoot.querySelector('svg')!
    expect(updatedSvg.getAttribute('viewBox')).toBe(originalViewBox)
    expect(updatedSvg.querySelector('g circle')).toBe(originalCell)
    expect(updatedSvg.querySelectorAll('g')).toHaveLength(6)
    expect(originalCell.classList.contains('dot-matrix-dot')).toBe(true)
  })

  it('shows short work in seconds and tiny positive credits as sub-penny values', () => {
    const date = new Date()
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    act(() =>
      root.render(
        <>
          <SupportingTotals
            totalSavedSeconds={30}
            estimatedSecondsRemaining={30}
            isSessionActive={false}
          />
          <SessionHistory
            sessions={[
              {
                id: 'short-session',
                agreementId: 'agreement',
                date: dateString,
                activeDurationSec: 30,
                usdEarned: 0.01,
                exchangeRate: 0.8,
                gbpCredit: 0.008,
                appliedGbp: 0.008,
                excessGbp: 0,
                createdAt: new Date().toISOString(),
              },
            ]}
            onOpenAddTime={() => {}}
            onSelectSession={() => {}}
          />
        </>,
      ),
    )

    expect(appRoot.textContent).toContain('30s')
    expect(appRoot.textContent).toContain('£<0.01')
    expect(appRoot.textContent).not.toContain('0m')
  })

  it('keeps a closing sheet mounted, reverses its exit, and traps/restores focus', async () => {
    const onClose = vi.fn()
    const renderSheet = (isOpen: boolean) =>
      act(() =>
        root.render(
          <>
            <button type="button">Open sheet</button>
            <ModalSheet
              isOpen={isOpen}
              onClose={onClose}
              title="Task details"
              footer={<button type="button">Footer action</button>}
            >
              <input aria-label="Task" />
            </ModalSheet>
          </>,
        ),
      )

    const flushFrame = () => act(async () => {
      await vi.advanceTimersByTimeAsync(20)
    })

    const triggerBeforeOpen = () => appRoot.querySelector('button') as HTMLButtonElement
    renderSheet(false)
    const initialTrigger = triggerBeforeOpen()
    initialTrigger.focus()
    renderSheet(true)
    await flushFrame()

    const dialog = document.querySelector('[role="dialog"]')!
    const input = dialog.querySelector('input')!
    const footerAction = Array.from(dialog.querySelectorAll('button')).find(
      (button) => button.textContent === 'Footer action',
    )!

    expect(dialog).toBeTruthy()
    expect(document.activeElement).toBe(input)
    expect(appRoot.inert).toBe(true)
    expect(footerAction).toBeTruthy()

    footerAction.focus()
    footerAction.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close dialog')

    renderSheet(false)
    expect(document.querySelector('[role="dialog"]')).toBeTruthy()
    expect(appRoot.inert).toBe(true)

    renderSheet(true)
    await flushFrame()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
    })
    expect(document.querySelector('[role="dialog"]')).toBeTruthy()
    expect(appRoot.inert).toBe(true)

    renderSheet(false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(220)
    })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(appRoot.inert).toBe(false)
    expect(document.activeElement).toBe(triggerBeforeOpen())
  })

  it('keeps the background inert while one sheet exits and another opens', async () => {
    const renderPair = (firstOpen: boolean, secondOpen: boolean) =>
      act(() =>
        root.render(
          <>
            <button type="button">Open sheet</button>
            <ModalSheet isOpen={firstOpen} onClose={() => {}} title="First sheet">
              First body
            </ModalSheet>
            <ModalSheet isOpen={secondOpen} onClose={() => {}} title="Second sheet">
              Second body
            </ModalSheet>
          </>,
        ),
      )

    renderPair(true, false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20)
    })
    renderPair(false, true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20)
      await vi.advanceTimersByTimeAsync(220)
    })

    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Second sheet')
    expect(appRoot.inert).toBe(true)

    renderPair(false, false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(220)
    })
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0)
    expect(appRoot.inert).toBe(false)
  })
})

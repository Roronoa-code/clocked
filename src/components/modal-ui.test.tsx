import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DotMatrixNumeral } from './DotMatrixNumeral'
import { ModalSheet } from './ModalSheet'
import { SessionHistory } from './SessionHistory'
import { SupportingTotals } from './SupportingTotals'

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

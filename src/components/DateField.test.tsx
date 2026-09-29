import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { DateField } from './DateField'
import { Header } from './Header'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it('chooses dates in the in-app calendar and hides Settings without an owner action', () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  function Example() {
    const [date, setDate] = useState('2026-09-29')
    return <><Header party="daremo" /><label htmlFor="work-date">Date</label><DateField id="work-date" value={date} onChange={setDate} /></>
  }

  act(() => root.render(<Example />))
  expect(container.querySelector('[aria-label="Open settings and agreement options"]')).toBeNull()
  expect(container.querySelector('input[type="date"]')).toBeNull()
  const field = container.querySelector<HTMLButtonElement>('#work-date')!
  expect(field.textContent).toContain('29/09/2026')

  act(() => field.click())
  expect(field.getAttribute('aria-expanded')).toBe('true')
  expect(container.textContent).toContain('September 2026')
  act(() => container.querySelector<HTMLButtonElement>('[aria-label="Next month"]')!.click())
  expect(container.textContent).toContain('October 2026')
  act(() => container.querySelector<HTMLButtonElement>('[aria-label="4 October 2026"]')!.click())
  expect(field.textContent).toContain('04/10/2026')
  expect(field.getAttribute('aria-expanded')).toBe('false')
  expect(container.querySelector('[data-open="false"]')).not.toBeNull()

  act(() => root.unmount())
  container.remove()
})

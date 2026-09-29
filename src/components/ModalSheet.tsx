import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalSheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  hasUnsavedChanges?: boolean
  canClose?: boolean
}

const CLOSE_DURATION_MS = 220
const OPEN_DURATION = 'duration-[280ms]'
const CLOSE_DURATION = 'duration-[220ms]'
const FOCUSABLE_SELECTOR =
  '[data-modal-initial-focus], [autofocus], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

const activeModals = new Set<symbol>()
let backgroundSnapshot: {
  root: HTMLElement | null
  rootWasInert: boolean
  rootAriaHidden: string | null
  bodyOverflow: string
} | null = null
let focusToRestore: HTMLElement | null = null

function activateModal(token: symbol, returnFocus: HTMLElement | null) {
  if (activeModals.has(token)) return

  if (activeModals.size === 0) {
    const root = document.getElementById('root')
    backgroundSnapshot = {
      root,
      rootWasInert: root?.inert ?? false,
      rootAriaHidden: root?.getAttribute('aria-hidden') ?? null,
      bodyOverflow: document.body.style.overflow,
    }
    focusToRestore = returnFocus
    if (root) {
      root.inert = true
      root.setAttribute('aria-hidden', 'true')
    }
    document.body.style.overflow = 'hidden'
  }

  activeModals.add(token)
}

function deactivateModal(token: symbol) {
  if (!activeModals.delete(token) || activeModals.size > 0 || !backgroundSnapshot) return

  const { root, rootWasInert, rootAriaHidden, bodyOverflow } = backgroundSnapshot
  if (root) {
    root.inert = rootWasInert
    if (rootAriaHidden === null) root.removeAttribute('aria-hidden')
    else root.setAttribute('aria-hidden', rootAriaHidden)
  }
  document.body.style.overflow = bodyOverflow
  backgroundSnapshot = null

  const target = focusToRestore
  focusToRestore = null
  if (target?.isConnected) target.focus({ preventScroll: true })
}

export const ModalSheet: React.FC<ModalSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  hasUnsavedChanges = false,
  canClose = true,
}) => {
  const [retainedAfterExit, setRetainedAfterExit] = useState(false)
  const [hasEntered, setHasEntered] = useState(false)
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const keepEditingRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const tokenRef = useRef(Symbol('modal-sheet'))
  const titleId = useId()
  const isPresent = isOpen || retainedAfterExit
  const isVisible = isOpen && hasEntered

  // Retain the same surface through entry, exit, and any reversal before exit finishes.
  useEffect(() => {
    let frame = 0
    let timer = 0

    if (isOpen) {
      if (!hasEntered) {
        frame = window.requestAnimationFrame(() => {
          setRetainedAfterExit(true)
          setHasEntered(true)
        })
      }
    } else if (retainedAfterExit) {
      timer = window.setTimeout(() => {
        setRetainedAfterExit(false)
        setHasEntered(false)
        setShowDiscardPrompt(false)
        returnFocusRef.current = null
      }, CLOSE_DURATION_MS)
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      if (timer) window.clearTimeout(timer)
    }
  }, [isOpen, retainedAfterExit, hasEntered])

  useLayoutEffect(() => {
    if (!isOpen || !isPresent) return

    if (!returnFocusRef.current) {
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement) returnFocusRef.current = activeElement
    }

    const initialTarget = showDiscardPrompt
      ? keepEditingRef.current
      : bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? closeButtonRef.current
    initialTarget?.focus({ preventScroll: true })
  }, [isOpen, isPresent, showDiscardPrompt])

  // Keep the page inert and scroll-locked until the last overlapping sheet exits.
  useEffect(() => {
    if (!isPresent) return
    const token = tokenRef.current
    activateModal(token, returnFocusRef.current)
    return () => deactivateModal(token)
  }, [isPresent])

  const handleAttemptClose = useCallback(() => {
    if (!canClose) return
    if (hasUnsavedChanges) setShowDiscardPrompt(true)
    else onClose()
  }, [canClose, hasUnsavedChanges, onClose])

  const handleConfirmDiscard = () => {
    setShowDiscardPrompt(false)
    onClose()
  }

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isOpen) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      handleAttemptClose()
      return
    }
    if (event.key !== 'Tab') return

    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    if (focusable.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const activeElement = document.activeElement
    if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!isPresent || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-end p-0 md:items-center md:justify-center md:p-4 ${isOpen ? '' : 'pointer-events-none'}`}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <div
        className={`fixed inset-0 bg-black/75 backdrop-blur-[2px] transition-opacity ease-out ${isVisible ? `opacity-100 ${OPEN_DURATION}` : `opacity-0 ${CLOSE_DURATION}`}`}
        onClick={handleAttemptClose}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal={isOpen ? true : undefined}
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        className={`relative z-10 w-full md:max-w-[480px] bg-[#19191F] border-t md:border border-[#2D2B35] rounded-t-[24px] md:rounded-[20px] shadow-2xl max-h-[88dvh] md:max-h-[90dvh] flex flex-col overflow-hidden transition-[opacity,transform] ease-out ${isVisible ? `translate-y-0 opacity-100 md:scale-100 ${OPEN_DURATION}` : `translate-y-full opacity-0 md:translate-y-3 md:scale-[.99] ${CLOSE_DURATION}`}`}
      >
        <div className="h-[60px] px-6 border-b border-[#2D2B35] flex items-center justify-between shrink-0">
          <h3
            id={titleId}
            className="text-[18px] md:text-[20px] font-semibold text-[#F5F2F8] tracking-tight"
          >
            {title}
          </h3>

          {canClose && (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleAttemptClose}
              className="w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-[#ABA6B5] hover:text-[#F5F2F8] hover:bg-[#24242d] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6A0E9]"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5 stroke-[1.8]" />
            </button>
          )}
        </div>

        {showDiscardPrompt ? (
          <div className="p-6 text-center">
            <h4 className="text-[17px] font-semibold text-[#F5F2F8] mb-2">
              Discard unsaved changes?
            </h4>
            <p className="text-[14px] text-[#ABA6B5] mb-6">
              You have modified this session. Discarding will lose these changes.
            </p>
            <div className="flex gap-3">
              <button
                ref={keepEditingRef}
                type="button"
                onClick={() => setShowDiscardPrompt(false)}
                className="flex-1 h-[52px] rounded-[14px] bg-[#24242d] border border-[#2D2B35] text-[#F5F2F8] font-semibold hover:bg-[#2d2d38] transition-colors"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="flex-1 h-[52px] rounded-[14px] bg-[#F5F2F8] text-[#151019] font-semibold hover:bg-white transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={bodyRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 space-y-5"
          >
            {children}
          </div>
        )}

        {footer && !showDiscardPrompt && (
          <div className="shrink-0 border-t border-[#2D2B35] bg-[#19191F] px-6 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

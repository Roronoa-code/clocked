import React, { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface ModalSheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  hasUnsavedChanges?: boolean
}

export const ModalSheet: React.FC<ModalSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  hasUnsavedChanges = false,
}) => {
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Handle escape key
  useEffect(() => {
    if (!isOpen) {
      setShowDiscardPrompt(false)
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleAttemptClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, hasUnsavedChanges])

  // Prevent body scrolling when open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleAttemptClose = () => {
    if (hasUnsavedChanges) {
      setShowDiscardPrompt(true)
    } else {
      onClose()
    }
  }

  const handleConfirmDiscard = () => {
    setShowDiscardPrompt(false)
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-modal-title"
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-[2px] transition-opacity duration-220 ease-out"
        onClick={handleAttemptClose}
        aria-hidden="true"
      />

      {/* Surface: Bottom Sheet on Mobile / Centered Dialog on Desktop */}
      <div
        ref={contentRef}
        className="relative z-10 w-full md:max-w-[480px] bg-[#19191F] border-t md:border border-[#2D2B35] rounded-t-[24px] md:rounded-[20px] shadow-2xl max-h-[88vh] md:max-h-[90vh] flex flex-col overflow-hidden transition-all duration-280 ease-out"
      >
        {/* Header */}
        <div className="h-[60px] px-6 border-b border-[#2D2B35] flex items-center justify-between shrink-0">
          <h3
            id="sheet-modal-title"
            className="text-[18px] md:text-[20px] font-semibold text-[#F5F2F8] tracking-tight"
          >
            {title}
          </h3>

          <button
            type="button"
            onClick={handleAttemptClose}
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-[#ABA6B5] hover:text-[#F5F2F8] hover:bg-[#24242d] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6A0E9]"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 stroke-[1.8]" />
          </button>
        </div>

        {/* In-sheet Discard Confirmation Prompt */}
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
          /* Content Body */
          <div className="overflow-y-auto overscroll-contain p-6 space-y-5">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

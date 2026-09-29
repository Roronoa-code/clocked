import React, { useState, useEffect, useCallback, useId, useRef } from 'react'
import { ModalSheet } from './ModalSheet'
import type { Agreement } from '../types'
import { Loader2, RefreshCw } from 'lucide-react'

interface SetupSheetProps {
  isOpen: boolean
  onClose?: () => void
  onSaveAgreement: (agreement: Agreement) => boolean | Promise<boolean>
  initialAgreement?: Agreement | null
  isFirstSetup?: boolean
  embedded?: boolean
  formId?: string
  onDirtyChange?: (dirty: boolean) => void
}

export const SetupSheet: React.FC<SetupSheetProps> = ({
  isOpen,
  onClose = () => {},
  onSaveAgreement,
  initialAgreement,
  isFirstSetup = false,
  embedded = false,
  formId,
  onDirtyChange,
}) => {
  const generatedFormId = useId()
  const actualFormId = formId || generatedFormId
  const [sisterName, setSisterName] = useState(initialAgreement?.sisterName || '')
  const [originalDebt, setOriginalDebt] = useState<string>(
    initialAgreement ? String(initialAgreement.originalDebtGBP) : '60'
  )
  const [hourlyRate, setHourlyRate] = useState<string>(
    initialAgreement ? String(initialAgreement.hourlyRateUSD) : '6'
  )
  const [rateInput, setRateInput] = useState<string>(
    initialAgreement ? String(initialAgreement.exchangeRateUSDToGBP) : ''
  )
  const [rateSource, setRateSource] = useState<string>(
    initialAgreement?.exchangeRateSource || ''
  )
  const [rateDate, setRateDate] = useState<string>(
    initialAgreement?.exchangeRateDate || ''
  )
  const [isFetchingRate, setIsFetchingRate] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const rateRequestVersion = useRef(0)

  const fetchLiveExchangeRate = useCallback(async () => {
    const requestVersion = ++rateRequestVersion.current
    setIsFetchingRate(true)
    setFetchError(null)
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data && data.rates && typeof data.rates.GBP === 'number') {
        if (rateRequestVersion.current !== requestVersion) return
        const liveGbp = data.rates.GBP
        const roundedGbp = Number(liveGbp.toFixed(4))
        setRateInput(String(roundedGbp))
        setRateSource('open.er-api.com')
        const dateStr = new Date(data.time_last_update_utc || Date.now()).toISOString().slice(0, 10)
        setRateDate(dateStr)
      } else {
        throw new Error('GBP rate not found in response')
      }
    } catch (err) {
      console.warn('Could not fetch live rate:', err)
      if (rateRequestVersion.current !== requestVersion) return
      setFetchError('Live rate unavailable. Enter or confirm the agreed rate manually.')
    } finally {
      if (rateRequestVersion.current === requestVersion) setIsFetchingRate(false)
    }
  }, [])

  // Fetch live market rate on first open if needed
  useEffect(() => {
    if (isOpen && isFirstSetup && !initialAgreement) {
      fetchLiveExchangeRate()
    }
  }, [isOpen, isFirstSetup, initialAgreement, fetchLiveExchangeRate])

  const numericRate = parseFloat(rateInput)
  const numericDebt = parseFloat(originalDebt)
  const numericHourly = parseFloat(hourlyRate)

  // Previews
  const previewValid = Number.isFinite(numericRate) && numericRate > 0 && Number.isFinite(numericHourly) && numericHourly > 0
  const oneHourUsd = numericHourly
  const oneHourGbp = oneHourUsd * numericRate
  const fiveMinUsd = (numericHourly * 300) / 3600
  const fiveMinGbp = fiveMinUsd * numericRate
  const formatPreviewAmount = (amount: number) => (previewValid ? amount.toFixed(2) : '—')
  const dirty = sisterName !== (initialAgreement?.sisterName || '')
    || originalDebt !== (initialAgreement ? String(initialAgreement.originalDebtGBP) : '60')
    || hourlyRate !== (initialAgreement ? String(initialAgreement.hourlyRateUSD) : '6')
    || rateInput !== (initialAgreement ? String(initialAgreement.exchangeRateUSDToGBP) : '')
    || rateSource !== (initialAgreement?.exchangeRateSource || '')
    || rateDate !== (initialAgreement?.exchangeRateDate || '')

  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    setSaveError(null)

    if (isNaN(numericDebt) || numericDebt <= 0) {
      setValidationError('Please enter a valid debt amount in pounds.')
      return
    }
    if (isNaN(numericHourly) || numericHourly <= 0) {
      setValidationError('Please enter a valid hourly rate in US dollars.')
      return
    }
    if (isNaN(numericRate) || numericRate <= 0) {
      setValidationError('Please enter a valid exchange rate.')
      return
    }

    const effectiveRateSource = rateSource || 'Manual entry'
    const effectiveRateDate = rateDate || new Date().toISOString().slice(0, 10)

    const agreement: Agreement = {
      id: initialAgreement?.id || 'agreement-' + Date.now(),
      sisterName: sisterName.trim(),
      originalDebtGBP: numericDebt,
      hourlyRateUSD: numericHourly,
      exchangeRateUSDToGBP: numericRate,
      exchangeRateSource: effectiveRateSource,
      exchangeRateDate: effectiveRateDate,
      createdAt: initialAgreement?.createdAt || new Date().toISOString(),
    }

    setIsSaving(true)
    try {
      if (!(await onSaveAgreement(agreement))) {
        setSaveError('Could not save the agreement. Please try again.')
      }
    } catch {
      setSaveError('Could not save the agreement. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const form = (
      <form id={actualFormId} onSubmit={handleSubmit} className="space-y-5">
        {/* Sister's Name (Optional) */}
        <div>
          <label htmlFor="agreement-sister-name" className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
            Sister's name <span className="text-[#938D9F] font-normal">(optional)</span>
          </label>
          <input
            id="agreement-sister-name"
            type="text"
            value={sisterName}
            onChange={(e) => setSisterName(e.target.value)}
            placeholder="e.g. Maya"
            className="input-base"
          />
        </div>

        {/* Debt Amount and Hourly USD row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="agreement-debt-target" className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
              Debt target (£)
            </label>
            <input
              id="agreement-debt-target"
              type="number"
              step="any"
              min="0.01"
              value={originalDebt}
              onChange={(e) => setOriginalDebt(e.target.value)}
              className="input-base"
              required
            />
          </div>

          <div>
            <label htmlFor="agreement-hourly-rate" className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
              Rate (US$/hr)
            </label>
            <input
              id="agreement-hourly-rate"
              type="number"
              step="any"
              min="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="input-base"
              required
            />
          </div>
        </div>

        {/* Exchange Rate Section */}
        <div className="bg-[#111114] border border-[#2D2B35] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#F5F2F8]">
              Agreed exchange rate
            </span>
            <button
              type="button"
              onClick={fetchLiveExchangeRate}
              disabled={isFetchingRate}
              className="inline-flex items-center gap-1 text-[12px] text-[#B6A0E9] hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isFetchingRate ? 'animate-spin' : ''}`} />
              <span>Fetch live</span>
            </button>
          </div>

          {/* Rate input expressed as US$1 = £____ */}
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-semibold text-[#F5F2F8] shrink-0">
              US$1 = £
            </span>
            <input
              id="agreement-exchange-rate"
              type="number"
              step="any"
              min="0.0001"
              value={rateInput}
              onChange={(e) => {
                rateRequestVersion.current += 1
                setIsFetchingRate(false)
                setRateInput(e.target.value)
                setRateSource('Manual entry')
                setRateDate(new Date().toISOString().slice(0, 10))
                setFetchError(null)
              }}
              className="input-base font-semibold"
              placeholder="0.80"
              required
            />
          </div>

          {/* Source and Date Attribution */}
          <div className="text-[12px] text-[#ABA6B5] leading-relaxed">
            {isFetchingRate ? (
              <span className="flex items-center gap-1.5 text-[#B6A0E9]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Retrieving live market rate...
              </span>
            ) : fetchError ? (
              <span className="block">
                {rateSource ? (
                  <>
                    Source: <strong className="text-[#F5F2F8]">{rateSource}</strong>
                    {rateDate ? ` (${rateDate})` : ''}.
                  </>
                ) : (
                  <span>No rate source selected yet.</span>
                )}
                <span className="block text-[#F5F2F8] mt-1">{fetchError}</span>
              </span>
            ) : (
              <span>
                {rateSource ? (
                  <>
                    Source: <strong className="text-[#F5F2F8]">{rateSource}</strong>
                    {rateDate ? ` (${rateDate})` : ''}.
                  </>
                ) : (
                  'No rate source selected. Fetch a live rate or enter an agreed rate manually.'
                )}
              </span>
            )}
          </div>
        </div>

        {/* Repayment Preview Confirmation */}
        <div className="bg-[#111114] border border-[#2D2B35] rounded-xl p-4">
          <span className="block text-[12px] font-medium text-[#ABA6B5] uppercase tracking-wider mb-2">
            Repayment arrangement preview
          </span>
          <div className="grid grid-cols-2 gap-4 text-left">
            <div>
              <span className="block text-[12px] text-[#938D9F]">5 minutes work</span>
              <span className="text-[15px] font-semibold text-[#F5F2F8]">
                US${formatPreviewAmount(fiveMinUsd)} · £{formatPreviewAmount(fiveMinGbp)}
              </span>
            </div>
            <div>
              <span className="block text-[12px] text-[#938D9F]">1 hour work</span>
              <span className="text-[15px] font-semibold text-[#F5F2F8]">
                US${formatPreviewAmount(oneHourUsd)} · £{formatPreviewAmount(oneHourGbp)}
              </span>
            </div>
          </div>
        </div>

        {(validationError || saveError) && (
          <p role="alert" className="text-[13px] text-red-300 font-medium">
            {validationError || saveError}
          </p>
        )}

      </form>
  )
  if (embedded) return form
  return <ModalSheet isOpen={isOpen} onClose={onClose} title={isFirstSetup ? 'Set the agreement' : 'Agreement settings'}
    canClose={!isFirstSetup} hasUnsavedChanges={dirty}
    footer={<button type="submit" form={actualFormId} disabled={isSaving} className="btn-base btn-violet w-full">
      {isSaving ? 'Saving…' : isFirstSetup ? 'Start agreement' : 'Save agreement'}
    </button>}>
    {form}
  </ModalSheet>
}

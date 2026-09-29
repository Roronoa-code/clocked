import React, { useState, useEffect, useCallback } from 'react'
import { ModalSheet } from './ModalSheet'
import type { Agreement } from '../types'
import { Loader2, RefreshCw } from 'lucide-react'

interface SetupSheetProps {
  isOpen: boolean
  onClose?: () => void
  onSaveAgreement: (agreement: Agreement) => void
  initialAgreement?: Agreement | null
  isFirstSetup?: boolean
}

export const SetupSheet: React.FC<SetupSheetProps> = ({
  isOpen,
  onClose = () => {},
  onSaveAgreement,
  initialAgreement,
  isFirstSetup = false,
}) => {
  const [sisterName, setSisterName] = useState(initialAgreement?.sisterName || '')
  const [originalDebt, setOriginalDebt] = useState<string>(
    initialAgreement ? String(initialAgreement.originalDebtGBP) : '60'
  )
  const [hourlyRate, setHourlyRate] = useState<string>(
    initialAgreement ? String(initialAgreement.hourlyRateUSD) : '6'
  )
  const [rateInput, setRateInput] = useState<string>(
    initialAgreement ? String(initialAgreement.exchangeRateUSDToGBP) : '0.80'
  )
  const [rateSource, setRateSource] = useState<string>(
    initialAgreement?.exchangeRateSource || 'Controlled test rate'
  )
  const [rateDate, setRateDate] = useState<string>(
    initialAgreement?.exchangeRateDate || '2026-09-29'
  )
  const [isFetchingRate, setIsFetchingRate] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const fetchLiveExchangeRate = useCallback(async () => {
    setIsFetchingRate(true)
    setFetchError(null)
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data && data.rates && typeof data.rates.GBP === 'number') {
        const liveGbp = data.rates.GBP
        const roundedGbp = Number(liveGbp.toFixed(4))
        setRateInput(String(roundedGbp))
        setRateSource('open.er-api.com (European Central Bank data)')
        const dateStr = data.time_last_update_utc
          ? new Date(data.time_last_update_utc).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : new Date().toLocaleDateString('en-GB')
        setRateDate(dateStr)
      } else {
        throw new Error('GBP rate not found in response')
      }
    } catch (err: any) {
      console.warn('Could not fetch live rate:', err)
      setFetchError('Could not fetch live rate. Please enter an agreed rate below.')
      setRateInput('0.80')
      setRateSource('Agreed test rate')
      setRateDate(new Date().toLocaleDateString('en-GB'))
    } finally {
      setIsFetchingRate(false)
    }
  }, [])

  // Fetch live market rate on first open if needed
  useEffect(() => {
    if (isOpen && isFirstSetup && !initialAgreement) {
      fetchLiveExchangeRate()
    }
  }, [isOpen, isFirstSetup, initialAgreement, fetchLiveExchangeRate])
  const handleUseTestRate = () => {
    setRateInput('0.80')
    setRateSource('Controlled test rate (US$1 = £0.80)')
    setRateDate('2026-09-29')
    setFetchError(null)
  }

  const numericRate = parseFloat(rateInput)
  const numericDebt = parseFloat(originalDebt)
  const numericHourly = parseFloat(hourlyRate)

  // Previews
  const previewValid = !isNaN(numericRate) && numericRate > 0 && !isNaN(numericHourly) && numericHourly > 0
  const oneHourUsd = numericHourly
  const oneHourGbp = previewValid ? (oneHourUsd * numericRate).toFixed(2) : '0.00'
  const fiveMinUsd = (numericHourly * 300) / 3600
  const fiveMinGbp = previewValid ? (fiveMinUsd * numericRate).toFixed(2) : '0.00'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

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

    const agreement: Agreement = {
      id: initialAgreement?.id || 'agreement-' + Date.now(),
      sisterName: sisterName.trim(),
      originalDebtGBP: numericDebt,
      hourlyRateUSD: numericHourly,
      exchangeRateUSDToGBP: numericRate,
      exchangeRateSource: rateSource,
      exchangeRateDate: rateDate,
      createdAt: initialAgreement?.createdAt || new Date().toISOString(),
    }

    onSaveAgreement(agreement)
  }

  return (
    <ModalSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isFirstSetup ? 'Set the agreement' : 'Agreement settings'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Sister's Name (Optional) */}
        <div>
          <label className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
            Sister's name <span className="text-[#938D9F] font-normal">(optional)</span>
          </label>
          <input
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
            <label className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
              Debt target (£)
            </label>
            <input
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
            <label className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
              Rate (US$/hr)
            </label>
            <input
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
            <label className="text-[13px] font-semibold text-[#F5F2F8]">
              Agreed exchange rate
            </label>
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
              type="number"
              step="any"
              min="0.0001"
              value={rateInput}
              onChange={(e) => {
                setRateInput(e.target.value)
                setRateSource('Custom entered rate')
                setRateDate(new Date().toLocaleDateString('en-GB'))
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
              <span className="text-[#F5F2F8]">{fetchError}</span>
            ) : (
              <span>
                Source: <strong className="text-[#F5F2F8]">{rateSource}</strong> ({rateDate}).
              </span>
            )}
          </div>

          {/* Quick preset for test rate */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleUseTestRate}
              className="text-[12px] text-[#B6A0E9] hover:underline"
            >
              Use specification test rate (US$1 = £0.80)
            </button>
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
                US$0.50 · £{fiveMinGbp}
              </span>
            </div>
            <div>
              <span className="block text-[12px] text-[#938D9F]">1 hour work</span>
              <span className="text-[15px] font-semibold text-[#F5F2F8]">
                US$6.00 · £{oneHourGbp}
              </span>
            </div>
          </div>
        </div>

        {validationError && (
          <p className="text-[13px] text-[#F5F2F8] font-medium bg-red-950/40 border border-red-800/60 p-3 rounded-lg">
            {validationError}
          </p>
        )}

        <div className="pt-2">
          <button
            type="submit"
            className="w-full h-[52px] rounded-[14px] bg-[#B6A0E9] text-[#151019] text-[16px] font-semibold hover:bg-[#c4b1ed] active:scale-[0.985] transition-all flex items-center justify-center"
          >
            {isFirstSetup ? 'Start agreement' : 'Save agreement'}
          </button>
        </div>
      </form>
    </ModalSheet>
  )
}

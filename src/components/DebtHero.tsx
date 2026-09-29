import React from 'react'
import { DotMatrixNumeral } from './DotMatrixNumeral'
import { RepaymentMarks } from './RepaymentMarks'
import type { CalculationSummary, Agreement } from '../types'
import { formatGBP } from '../utils/calculations'

interface DebtHeroProps {
  summary: CalculationSummary
  agreement: Agreement
  isSessionActive: boolean
}

export const DebtHero: React.FC<DebtHeroProps> = ({
  summary,
  agreement,
  isSessionActive,
}) => {
  const isCompleted = summary.isAllSquare && !isSessionActive

  // Label text
  let labelText = 'Left to clear'
  if (isCompleted) {
    labelText = 'All square'
  } else if (isSessionActive) {
    labelText = 'After this session'
  }

  // Active debt value to display
  const displayDebt = isSessionActive ? summary.projectedRemaining : summary.remainingDebt
  const isSubPenny = isSessionActive ? summary.isLessThanOnePenny : summary.isLessThanOnePenny

  // Amount formatted string for dot-matrix
  const amountStr = displayDebt.toFixed(2)

  // Contextual line
  let contextLine = ''
  if (isCompleted) {
    contextLine = `£${agreement.originalDebtGBP.toFixed(2)} debt fully cleared`
  } else if (isSessionActive) {
    contextLine = `£${summary.totalCreditApplied.toFixed(2)} cleared before this session`
  } else {
    contextLine = `£${summary.totalCreditApplied.toFixed(2)} cleared of £${agreement.originalDebtGBP.toFixed(0)}`
  }

  return (
    <section className="w-full flex flex-col items-center text-center select-none pt-2 pb-6">
      {/* 1. Secondary label (constant height) */}
      <div className="h-6 flex items-center justify-center mb-3">
        <span
          className={`text-[13px] font-medium tracking-wide uppercase ${
            isCompleted
              ? 'text-[#B6A0E9] font-semibold'
              : isSessionActive
              ? 'text-[#ABA6B5]'
              : 'text-[#938D9F]'
          }`}
        >
          {labelText}
        </span>
      </div>

      {/* 2. Dotted GBP amount or Sub-penny treatment */}
      <div className="min-h-[84px] md:min-h-[104px] flex items-center justify-center my-1">
        {isSubPenny ? (
          <div className="flex flex-col items-center justify-center">
            <span className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#F5F2F8] tracking-tight">
              Less than £0.01
            </span>
            <span className="text-[13px] text-[#ABA6B5] mt-1">
              (£{displayDebt.toFixed(4)} remaining)
            </span>
          </div>
        ) : (
          <DotMatrixNumeral
            amountString={amountStr}
            accessibleLabel={`${formatGBP(displayDebt)} ${labelText}`}
          />
        )}
      </div>

      {/* 3. Repayment marks field (3 rows of 20) */}
      <div className="w-full max-w-[350px] my-5 px-1">
        <RepaymentMarks
          marksCleared={summary.marksCleared}
          marksTotal={summary.marksTotal}
        />
      </div>

      {/* 4. Short contextual line */}
      <div className="h-5 flex items-center justify-center">
        <p className="text-[13px] text-[#ABA6B5] tracking-normal">
          {contextLine}
        </p>
      </div>
    </section>
  )
}

import React, { useEffect, useRef, useState } from 'react'

interface RepaymentMarksProps {
  marksCleared: number // fractional number between 0 and 60
  marksTotal?: number // default 60
  accessibleLabel?: string
}

export const RepaymentMarks: React.FC<RepaymentMarksProps> = ({
  marksCleared,
  marksTotal = 60,
  accessibleLabel,
}) => {
  const prevCompletedCountRef = useRef(Math.floor(marksCleared))
  const [punchedMarkIndex, setPunchedMarkIndex] = useState<number | null>(null)

  useEffect(() => {
    const currentCompleted = Math.floor(marksCleared)
    if (currentCompleted > prevCompletedCountRef.current && currentCompleted <= marksTotal) {
      // Mark at currentCompleted - 1 just got completed
      const justCompletedIndex = currentCompleted - 1
      setPunchedMarkIndex(justCompletedIndex)
      const timer = setTimeout(() => {
        setPunchedMarkIndex(null)
      }, 200)
      prevCompletedCountRef.current = currentCompleted
      return () => clearTimeout(timer)
    } else {
      prevCompletedCountRef.current = currentCompleted
    }
  }, [marksCleared, marksTotal])

  // Geometry: 20 columns, 3 rows = 60 marks
  const cols = 20
  const rows = 3
  const dotDiameter = 6
  const dotRadius = dotDiameter / 2
  const rowGap = 8
  const viewBoxWidth = 350
  const viewBoxHeight = rows * dotDiameter + (rows - 1) * rowGap // 18 + 16 = 34

  // Column centers
  // Distribute 20 columns evenly across viewBoxWidth
  const stepX = (viewBoxWidth - dotDiameter) / (cols - 1)
  const stepY = dotDiameter + rowGap

  const floorCleared = Math.floor(marksCleared)
  const fraction = Math.max(0, Math.min(1, marksCleared - floorCleared))

  const marks = Array.from({ length: marksTotal }, (_, idx) => {
    const row = Math.floor(idx / cols)
    const col = idx % cols
    const cx = dotRadius + col * stepX
    const cy = dotRadius + row * stepY

    const isFullyCleared = idx < floorCleared
    const isFractional = idx === floorCleared && fraction > 0
    const isPunched = idx === punchedMarkIndex

    return {
      idx,
      cx,
      cy,
      isFullyCleared,
      isFractional,
      isPunched,
    }
  })

  const description =
    accessibleLabel ||
    `Repayment progress: ${marksCleared.toFixed(1)} of ${marksTotal} marks cleared`

  return (
    <div
      className="w-full select-none"
      role="progressbar"
      aria-valuenow={Math.round(marksCleared)}
      aria-valuemin={0}
      aria-valuemax={marksTotal}
      aria-label={description}
    >
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-auto overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {fraction > 0 && (
            <linearGradient id="fraction-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset={`${fraction * 100}%`} stopColor="#B6A0E9" />
              <stop offset={`${fraction * 100}%`} stopColor="#2D2B35" />
            </linearGradient>
          )}
        </defs>

        {marks.map((m) => {
          let fill = '#2D2B35'
          if (m.isFullyCleared) {
            fill = '#B6A0E9'
          } else if (m.isFractional) {
            fill = 'url(#fraction-gradient)'
          }

          return (
            <circle
              key={`mark-${m.idx}`}
              cx={m.cx}
              cy={m.cy}
              r={dotRadius}
              fill={fill}
              className={`transition-all duration-140 ${
                m.isPunched ? 'scale-150 origin-center transition-transform duration-180' : ''
              }`}
              style={{
                transformOrigin: `${m.cx}px ${m.cy}px`,
              }}
            />
          )
        })}
      </svg>
    </div>
  )
}

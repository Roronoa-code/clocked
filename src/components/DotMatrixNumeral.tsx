import React, { useLayoutEffect, useRef, useState } from 'react'

// 5x7 dot-matrix bitmaps for digits 0-9
const GLYPHS: Record<string, number[][]> = {
  '0': [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  '1': [
    [0, 0, 1, 0, 0],
    [0, 1, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
  ],
  '2': [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 1, 1, 0],
    [0, 1, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
  ],
  '3': [
    [1, 1, 1, 1, 0],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
  ],
  '4': [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
  ],
  '5': [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  '6': [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  '7': [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0],
  ],
  '8': [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  '9': [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  '.': [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0],
  ],
  ',': [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0],
  ],
  ' ': [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
}

interface DotMatrixNumeralProps {
  amountString: string // e.g. "60.00" or "0.00"
  accessibleLabel?: string
  reservedCharacterCount?: number
}

export const DotMatrixNumeral: React.FC<DotMatrixNumeralProps> = ({
  amountString,
  accessibleLabel,
  reservedCharacterCount = amountString.length,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const readingRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  // Keep the balance box steady and shrink the entire reading only when it cannot fit.
  useLayoutEffect(() => {
    const container = containerRef.current
    const reading = readingRef.current
    if (!container || !reading) return

    const fitReading = () => {
      const readingWidth = reading.offsetWidth
      const availableWidth = container.clientWidth
      if (readingWidth > 0 && availableWidth > 0) {
        setScale(Math.min(1, availableWidth / readingWidth))
      }
    }

    fitReading()
    const observer = new ResizeObserver(fitReading)
    observer.observe(container)
    observer.observe(reading)
    return () => observer.disconnect()
  }, [reservedCharacterCount])

  const dotRadius = 3.5
  const pitchX = 7.4
  const pitchY = 10.2
  const charGap = 2.4
  const charWidth = 4 * pitchX + 2 * dotRadius
  const totalCharacters = Math.max(1, amountString.length, reservedCharacterCount)
  const displayCharacters = amountString.padEnd(totalCharacters, ' ').split('')
  const totalWidth = totalCharacters * charWidth + (totalCharacters - 1) * charGap
  const totalHeight = 6 * pitchY + 2 * dotRadius

  const charLayouts = displayCharacters.map((char, charIdx) => ({
    char,
    x: charIdx * (charWidth + charGap),
    matrix: GLYPHS[char] || GLYPHS['0'],
  }))

  return (
    <div
      ref={containerRef}
      className="w-full min-w-0 flex items-center justify-start select-none"
      role="text"
      aria-label={accessibleLabel || `£${amountString}`}
    >
      <div
        ref={readingRef}
        className="inline-flex shrink-0 items-center gap-1.5 origin-left"
        style={{ transform: `scale(${scale})` }}
      >
        <span
          aria-hidden="true"
          className="shrink-0 text-[28px] sm:text-[32px] md:text-[38px] font-semibold text-[#ABA6B5] leading-none"
        >
          £
        </span>

        <svg
          aria-hidden="true"
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="h-[72px] sm:h-[80px] md:h-[94px] w-auto overflow-visible"
        >
          {charLayouts.map(({ char, x, matrix }, charIdx) => (
            <g key={`char-${charIdx}`} transform={`translate(${x}, 0)`}>
              {matrix.map((row, rowIdx) =>
                row.map((isActive, colIdx) => (
                  <circle
                    key={`dot-${rowIdx}-${colIdx}`}
                    cx={dotRadius + colIdx * pitchX}
                    cy={dotRadius + rowIdx * pitchY}
                    r={char === '.' || char === ',' ? dotRadius * 0.55 : dotRadius}
                    fill={isActive ? '#F5F2F8' : '#1C1C23'}
                    opacity={isActive ? 1 : 0.4}
                    className="dot-matrix-dot"
                  />
                )),
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

import React from 'react'

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
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [1, 1],
    [1, 1],
  ],
  ',': [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 1],
    [1, 0],
  ],
}

interface DotMatrixNumeralProps {
  amountString: string // e.g. "60.00" or "0.00"
  accessibleLabel?: string
}

export const DotMatrixNumeral: React.FC<DotMatrixNumeralProps> = ({
  amountString,
  accessibleLabel,
}) => {
  // Dot matrix geometry
  const dotRadius = 4.2
  const pitchX = 11.5
  const pitchY = 11.5
  const charGap = 9

  // Calculate width for each character
  let currentX = 0
  const charLayouts: { char: string; x: number; width: number; matrix: number[][] }[] = []

  for (const ch of amountString) {
    const matrix = GLYPHS[ch] || GLYPHS['0']
    const cols = matrix[0].length
    const charWidth = (cols - 1) * pitchX + 2 * dotRadius
    charLayouts.push({
      char: ch,
      x: currentX,
      width: charWidth,
      matrix,
    })
    currentX += charWidth + charGap
  }

  const totalWidth = Math.max(0, currentX - charGap)
  const totalHeight = 6 * pitchY + 2 * dotRadius // 7 rows: 0 to 6

  return (
    <div
      className="inline-flex items-baseline select-none"
      role="text"
      aria-label={accessibleLabel || `£${amountString}`}
    >
      {/* Conventional pound symbol aligned optically */}
      <span
        aria-hidden="true"
        className="text-[#ABA6B5] font-semibold text-3xl sm:text-4xl md:text-5xl mr-2 sm:mr-3 self-center"
      >
        £
      </span>

      {/* 5x7 Dot-matrix display */}
      <div
        aria-hidden="true"
        className="h-[76px] sm:h-[84px] md:h-[104px] inline-flex items-center"
        style={{ aspectRatio: `${totalWidth} / ${totalHeight}` }}
      >
        <svg
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="h-full w-auto overflow-visible"
        >
          {charLayouts.map((layout, charIdx) => {
            return (
              <g key={`char-${charIdx}-${layout.char}`} transform={`translate(${layout.x}, 0)`}>
                {layout.matrix.map((row, rIdx) => {
                  return row.map((val, cIdx) => {
                    const cx = dotRadius + cIdx * pitchX
                    const cy = dotRadius + rIdx * pitchY
                    const isActive = val === 1

                    return (
                      <circle
                        key={`dot-${rIdx}-${cIdx}`}
                        cx={cx}
                        cy={cy}
                        r={dotRadius}
                        fill={isActive ? '#F5F2F8' : '#1C1C23'}
                        className={
                          isActive
                            ? 'transition-fill duration-140'
                            : 'transition-fill duration-140 opacity-40'
                        }
                      />
                    )
                  })
                })}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

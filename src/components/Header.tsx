import React from 'react'
import { Settings } from 'lucide-react'

interface HeaderProps {
  onOpenSettings: () => void
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  return (
    <header className="h-[56px] w-full flex items-center justify-between pt-safe px-5 select-none">
      <div className="flex items-center">
        <span className="font-bold tracking-tight text-[24px] md:text-[26px] text-[#F5F2F8] uppercase">
          CLOCKED
        </span>
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        className="w-11 h-11 flex items-center justify-center rounded-lg text-[#ABA6B5] hover:text-[#F5F2F8] hover:bg-[#19191F] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6A0E9]"
        aria-label="Open settings and agreement options"
      >
        <Settings className="w-5 h-5 stroke-[1.8]" />
      </button>
    </header>
  )
}

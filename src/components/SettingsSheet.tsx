import React, { useState } from 'react'
import { ModalSheet } from './ModalSheet'
import type { Agreement, WorkSession, AppSettings } from '../types'
import {
  downloadBackupFile,
  parseAndValidateBackup,
  restoreBackup,
} from '../utils/storage'
import { Download, Upload, Archive, AlertTriangle, ShieldCheck } from 'lucide-react'

interface SettingsSheetProps {
  isOpen: boolean
  onClose: () => void
  agreement: Agreement
  sessions: WorkSession[]
  settings: AppSettings
  onUpdateSettings: (settings: AppSettings) => void
  onEditAgreement: () => void
  onArchiveAndNewAgreement: () => void
  onRestoreComplete: () => void
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  isOpen,
  onClose,
  agreement,
  sessions,
  settings,
  onUpdateSettings,
  onEditAgreement,
  onArchiveAndNewAgreement,
  onRestoreComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'agreement' | 'records' | 'accessibility'>('agreement')
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoreSuccess, setRestoreSuccess] = useState<boolean>(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState<boolean>(false)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRestoreError(null)
    setRestoreSuccess(false)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const { valid, data, error } = parseAndValidateBackup(content)
      if (!valid || !data) {
        setRestoreError(error || 'Invalid backup file.')
        return
      }
      const success = restoreBackup(data)
      if (success) {
        setRestoreSuccess(true)
        onRestoreComplete()
        setTimeout(() => setRestoreSuccess(false), 3000)
      } else {
        setRestoreError('Failed to restore backup into browser storage.')
      }
    }
    reader.onerror = () => {
      setRestoreError('Failed to read backup file.')
    }
    reader.readAsText(file)
  }

  const convertedHourly = (agreement.hourlyRateUSD * agreement.exchangeRateUSDToGBP).toFixed(2)

  return (
    <ModalSheet isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="space-y-5">
        {/* Navigation tabs */}
        <div className="flex border-b border-[#2D2B35] pb-1 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('agreement')}
            className={`pb-2 text-[14px] font-semibold transition-colors border-b-2 -mb-[5px] ${
              activeTab === 'agreement'
                ? 'border-[#B6A0E9] text-[#F5F2F8]'
                : 'border-transparent text-[#ABA6B5] hover:text-[#F5F2F8]'
            }`}
          >
            Agreement
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`pb-2 text-[14px] font-semibold transition-colors border-b-2 -mb-[5px] ${
              activeTab === 'records'
                ? 'border-[#B6A0E9] text-[#F5F2F8]'
                : 'border-transparent text-[#ABA6B5] hover:text-[#F5F2F8]'
            }`}
          >
            Records & Backup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('accessibility')}
            className={`pb-2 text-[14px] font-semibold transition-colors border-b-2 -mb-[5px] ${
              activeTab === 'accessibility'
                ? 'border-[#B6A0E9] text-[#F5F2F8]'
                : 'border-transparent text-[#ABA6B5] hover:text-[#F5F2F8]'
            }`}
          >
            Display & Access
          </button>
        </div>

        {/* TAB 1: AGREEMENT */}
        {activeTab === 'agreement' && (
          <div className="space-y-4">
            <div className="bg-[#111114] border border-[#2D2B35] rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-[#ABA6B5]">Sister's name</span>
                <span className="text-[#F5F2F8] font-medium">
                  {agreement.sisterName || 'Not specified'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-[#ABA6B5]">Original debt</span>
                <span className="text-[#F5F2F8] font-medium">
                  £{agreement.originalDebtGBP.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-[14px]">
                <span className="text-[#ABA6B5]">Hourly credit</span>
                <span className="text-[#F5F2F8] font-medium">
                  US${agreement.hourlyRateUSD}/hr (approx £{convertedHourly}/hr)
                </span>
              </div>
              <div className="border-t border-[#2D2B35] pt-2 flex justify-between items-baseline text-[14px]">
                <span className="text-[#ABA6B5]">Locked exchange rate</span>
                <div className="text-right">
                  <span className="text-[#F5F2F8] font-semibold">
                    US$1 = £{agreement.exchangeRateUSDToGBP}
                  </span>
                  <span className="block text-[11px] text-[#938D9F] mt-0.5">
                    {agreement.exchangeRateSource} ({agreement.exchangeRateDate})
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[12px] text-[#ABA6B5] leading-relaxed">
              Historical work is locked to the rate at which it was earned. Modifying agreement settings applies to future work and does not reprice past sessions.
            </p>

            <button
              type="button"
              onClick={() => {
                onClose()
                onEditAgreement()
              }}
              className="w-full h-[48px] rounded-[12px] bg-[#24242d] border border-[#2D2B35] text-[#F5F2F8] font-semibold text-[15px] hover:bg-[#2d2d38] transition-colors"
            >
              Modify agreement settings
            </button>
          </div>
        )}

        {/* TAB 2: RECORDS & BACKUP */}
        {activeTab === 'records' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[13px] text-[#ABA6B5] bg-[#111114] border border-[#2D2B35] rounded-xl p-3.5">
              <ShieldCheck className="w-4 h-4 text-[#B6A0E9] shrink-0" />
              <span>Storage scope: <strong>Saved in this browser (local storage)</strong>.</span>
            </div>

            {/* Export */}
            <div className="bg-[#111114] border border-[#2D2B35] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[15px] font-semibold text-[#F5F2F8]">Export backup</h4>
                  <p className="text-[13px] text-[#ABA6B5]">
                    Save all sessions, agreement, and archives as a JSON file.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadBackupFile}
                  className="h-10 px-3.5 rounded-lg bg-[#24242d] border border-[#2D2B35] text-[#F5F2F8] hover:bg-[#2d2d38] text-[13px] font-semibold inline-flex items-center gap-2 shrink-0 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Restore */}
            <div className="bg-[#111114] border border-[#2D2B35] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[15px] font-semibold text-[#F5F2F8]">Restore from file</h4>
                  <p className="text-[13px] text-[#ABA6B5]">
                    Restore records from a previously exported JSON backup.
                  </p>
                </div>
                <label className="h-10 px-3.5 rounded-lg bg-[#24242d] border border-[#2D2B35] text-[#F5F2F8] hover:bg-[#2d2d38] text-[13px] font-semibold inline-flex items-center gap-2 shrink-0 transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Upload</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {restoreSuccess && (
                <div className="p-2.5 rounded-lg bg-green-950/40 border border-green-800/60 text-green-300 text-[13px]">
                  Backup successfully restored!
                </div>
              )}
              {restoreError && (
                <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-[13px]">
                  {restoreError}
                </div>
              )}
            </div>

            {/* Archive and Start New Agreement */}
            <div className="pt-2 border-t border-[#2D2B35]">
              {!showArchiveConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(true)}
                  className="w-full h-[48px] rounded-[12px] bg-[#111114] border border-[#2D2B35] text-[#ABA6B5] hover:text-[#F5F2F8] hover:bg-[#19191F] text-[14px] font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Archive className="w-4 h-4" />
                  <span>Archive agreement & start new</span>
                </button>
              ) : (
                <div className="p-4 bg-[#111114] border border-red-900/60 rounded-xl space-y-3 text-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto" />
                  <p className="text-[13px] text-[#F5F2F8]">
                    Archive current agreement ({sessions.length} sessions) and set up a fresh agreement?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowArchiveConfirm(false)}
                      className="flex-1 h-10 rounded-lg bg-[#24242d] text-[#F5F2F8] text-[13px] font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowArchiveConfirm(false)
                        onArchiveAndNewAgreement()
                      }}
                      className="flex-1 h-10 rounded-lg bg-red-600 text-white text-[13px] font-semibold"
                    >
                      Archive & Start
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DISPLAY & ACCESSIBILITY */}
        {activeTab === 'accessibility' && (
          <div className="space-y-4">
            <div className="bg-[#111114] border border-[#2D2B35] rounded-xl p-4 space-y-3">
              <label className="block text-[14px] font-semibold text-[#F5F2F8]">
                Reduced motion
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['system', true, false] as const).map((opt) => {
                  const label = opt === 'system' ? 'System' : opt ? 'On' : 'Off'
                  const isSelected = settings.reducedMotion === opt
                  return (
                    <button
                      key={String(opt)}
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, reducedMotion: opt })}
                      className={`h-10 rounded-lg text-[13px] font-semibold border transition-all ${
                        isSelected
                          ? 'bg-[#B6A0E9] text-[#151019] border-[#B6A0E9]'
                          : 'bg-[#24242d] text-[#ABA6B5] border-[#2D2B35] hover:text-[#F5F2F8]'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[12px] text-[#938D9F]">
                When enabled, reduces transitions and keeps geometric updates immediate.
              </p>
            </div>

            <div className="bg-[#111114] border border-[#2D2B35] rounded-xl p-4 space-y-2">
              <span className="block text-[13px] font-semibold text-[#F5F2F8]">
                Keyboard shortcuts
              </span>
              <ul className="text-[12px] text-[#ABA6B5] space-y-1.5 list-disc pl-4">
                <li><kbd className="bg-[#24242d] px-1 py-0.5 rounded text-[#F5F2F8]">Space</kbd> or <kbd className="bg-[#24242d] px-1 py-0.5 rounded text-[#F5F2F8]">k</kbd>: Clock in / Pause / Resume</li>
                <li><kbd className="bg-[#24242d] px-1 py-0.5 rounded text-[#F5F2F8]">s</kbd>: Save active session</li>
                <li><kbd className="bg-[#24242d] px-1 py-0.5 rounded text-[#F5F2F8]">Esc</kbd>: Close modal sheet</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </ModalSheet>
  )
}

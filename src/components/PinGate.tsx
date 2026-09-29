import { useState } from 'react'
import type { Party } from '../utils/remoteState'

interface Props {
  onSignIn: (party: Party, pin: string) => Promise<void>
}

export function PinGate({ onSignIn }: Props) {
  const [party, setParty] = useState<Party>('abdul')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onSignIn(party, pin)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in.')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-black text-[#F5F2F8] flex items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-6 rounded-[20px] border border-[#2D2B35] bg-[#111114] p-6">
        <div>
          <p className="text-[#B6A0E9] text-xs font-semibold uppercase tracking-[0.2em]">Clocked</p>
          <h1 className="mt-3 text-3xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm text-[#ABA6B5]">Select your name and enter your PIN.</p>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Account</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['abdul', 'daremo'] as const).map(name => (
              <label key={name} className={`flex h-12 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold ${party === name ? 'border-[#B6A0E9] bg-[#24202d] text-white' : 'border-[#2D2B35] text-[#ABA6B5]'}`}>
                <input className="sr-only" type="radio" name="party" value={name} checked={party === name} onChange={() => setParty(name)} />
                {name === 'abdul' ? 'Abdul' : 'Daremo'}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="clocked-pin" className="mb-2 block text-sm font-medium">PIN</label>
          <input id="clocked-pin" type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4,12}" minLength={4} maxLength={12} required value={pin} onChange={event => setPin(event.target.value)} className="input-base w-full" />
        </div>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={busy} className="btn-base btn-violet w-full h-12 disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  )
}

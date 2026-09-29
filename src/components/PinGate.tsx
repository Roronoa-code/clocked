import { useState } from 'react'
import { Check } from 'lucide-react'
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
    if (!/^[0-9]{4,12}$/.test(pin)) {
      setError('Enter a PIN with 4–12 digits.')
      document.getElementById('clocked-pin')?.focus()
      return
    }
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
      <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-6 rounded-[24px] border border-[#2D2B35] bg-[#111114] p-6">
        <div>
          <p className="text-[#ABA6B5] text-xs font-semibold uppercase tracking-[0.16em]">Clocked</p>
          <h1 className="mt-3 text-3xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm text-[#ABA6B5]">Select your name and enter your PIN.</p>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Account</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['abdul', 'daremo'] as const).map(name => (
              <label key={name} className="account-card" data-selected={party === name}>
                <input className="sr-only" type="radio" name="party" value={name} checked={party === name} onChange={() => { setParty(name); setPin(''); setError('') }} disabled={busy} />
                <span className="account-avatar" aria-hidden="true">{name === 'abdul' ? 'A' : 'D'}</span>
                {name === 'abdul' ? 'Abdul' : 'Daremo'}
                <Check className="account-check" size={14} aria-hidden="true" />
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="clocked-pin" className="mb-2 block text-sm font-medium">PIN</label>
          <input id="clocked-pin" type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4,12}" minLength={4} maxLength={12} required disabled={busy} aria-invalid={!!error} aria-describedby={error ? 'pin-error' : undefined} value={pin} onChange={event => setPin(event.target.value)} className="input-base w-full" />
          {error && <p id="pin-error" role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
        </div>
        <button type="submit" disabled={busy} className="btn-base btn-violet w-full h-12 disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  )
}

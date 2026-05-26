// Renders sign-in UI / not-allowed message / setup help. Only mounts the real
// app once we have a signed-in user whose email is on the allowlist.

import { useState, type ReactNode } from 'react';
import type { AuthState } from '../hooks/useAuth';

export function AuthGate({ auth, children }: { auth: AuthState; children: ReactNode }) {
  if (!auth.configured) {
    return (
      <SetupHelp
        title="Supabase לא מוגדר"
        body={
          <>
            יש להגדיר משתני סביבה בקובץ <code>.env</code>:
            <pre className="bg-bg-muted border border-line rounded p-3 mt-2 text-[12px] leading-5 text-ink-900" dir="ltr">
              VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co{'\n'}
              VITE_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY
            </pre>
            ולאחר מכן להריץ <code>npm run dev</code> מחדש. ב-Lovable יש לעדכן את משתני הסביבה בלוח הניהול.
          </>
        }
      />
    );
  }

  if (auth.loading) return <CenterScreen>טוען…</CenterScreen>;

  if (!auth.session) {
    return (
      <CenterScreen>
        <MagicLinkForm auth={auth}/>
      </CenterScreen>
    );
  }

  if (auth.isAllowed === null) {
    return <CenterScreen>בודק הרשאות…</CenterScreen>;
  }

  if (!auth.isAllowed) {
    return (
      <CenterScreen>
        <div className="card max-w-md w-full p-8 text-center">
          <h1 className="text-xl font-bold mb-3">אין הרשאה</h1>
          <p className="text-ink-700 mb-2 text-[13px]">
            המייל <b dir="ltr">{auth.email}</b> אינו ברשימת המורשים.
          </p>
          {auth.allowError && (
            <p className="text-danger mb-2 text-[12px]">{auth.allowError}</p>
          )}
          <p className="text-ink-500 text-[12px] leading-5 mb-6">
            פני/ה למנהל/ת המערכת כדי להוסיף את המייל לטבלת{' '}
            <code>allowed_emails</code> ב-Supabase.
          </p>
          <button className="btn w-full justify-center" onClick={() => { void auth.signOut(); }}>
            התחבר/י עם חשבון אחר
          </button>
        </div>
      </CenterScreen>
    );
  }

  return <>{children}</>;
}

function MagicLinkForm({ auth }: { auth: AuthState }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setErrMsg(null);
    try {
      await auth.sendMagicLink(email);
      setStatus('sent');
    } catch (err: unknown) {
      setStatus('error');
      setErrMsg((err as Error).message);
    }
  };

  if (status === 'sent') {
    return (
      <div className="card max-w-md w-full p-8 text-center">
        <div className="text-4xl mb-3">📬</div>
        <h1 className="text-xl font-bold mb-2">בדוק את המייל</h1>
        <p className="text-ink-500 text-[13px] leading-6 mb-4">
          שלחנו קישור התחברות ל-<b dir="ltr">{email}</b>.
          <br/>פתח את המייל ולחץ על "Sign in" — מיד תועבר ללוח.
        </p>
        <p className="text-ink-400 text-[11px] leading-5">
          הקישור תקף 60 דקות. אם לא הגיע בתוך דקה, בדוק תיקיית ספאם.
        </p>
        <button
          className="btn btn-ghost mt-4 text-[12px]"
          onClick={() => { setStatus('idle'); setEmail(''); }}>
          ← שלח לכתובת אחרת
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card max-w-md w-full p-8 text-center">
      <h1 className="text-2xl font-bold mb-2">ניהול הפקות · Methodica</h1>
      <p className="text-ink-500 mb-6 text-[13px] leading-6">
        הזן את כתובת המייל שלך, ושלח לך קישור התחברות.
        <br/>רק משתמשים שהוגדרו מראש ברשימת המורשים יוכלו לערוך.
      </p>
      <input
        type="email"
        required
        autoFocus
        placeholder="you@methodic.co.il"
        className="w-full px-3 py-2.5 border border-line rounded text-[14px] bg-bg-card text-ink-900 mb-3 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/30"
        dir="ltr"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === 'sending'}
      />
      <button
        type="submit"
        className="btn btn-primary w-full justify-center py-2.5 text-base"
        disabled={status === 'sending' || !email.trim()}
      >
        {status === 'sending' ? 'שולח קישור…' : '📩 שלח לי קישור התחברות'}
      </button>
      {status === 'error' && errMsg && (
        <div className="mt-3 text-[12px] text-danger bg-red-50 border border-red-200 rounded p-2 text-start">
          {errMsg}
        </div>
      )}
    </form>
  );
}

function CenterScreen({ children }: { children: ReactNode }) {
  return <div className="flex h-full w-full items-center justify-center p-4">{children}</div>;
}

function SetupHelp({ title, body }: { title: string; body: ReactNode }) {
  return (
    <CenterScreen>
      <div className="card max-w-xl w-full p-8">
        <h1 className="text-lg font-bold mb-3">⚙️ {title}</h1>
        <div className="text-[13px] leading-6 text-ink-700">{body}</div>
      </div>
    </CenterScreen>
  );
}

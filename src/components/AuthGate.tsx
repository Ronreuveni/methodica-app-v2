// Renders sign-in UI / not-allowed message / setup help. Only mounts the real
// app once we have a signed-in user whose email is on the allowlist.

import type { ReactNode } from 'react';
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
        <div className="card max-w-md w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">ניהול הפקות · Methodica</h1>
          <p className="text-ink-500 mb-6 text-[13px] leading-6">
            התחבר/י עם חשבון Google כדי להתחיל.
            <br/>רק משתמשים שאושרו מראש יכולים לצפות ולערוך את הלוח.
          </p>
          <button className="btn btn-primary w-full justify-center py-2 text-base"
            onClick={() => { void auth.signInWithGoogle(); }}>
            🔐 התחבר עם Google
          </button>
        </div>
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

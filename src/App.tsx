// Root component. In local mode (SQLite backend) the app mounts directly —
// no sign-in. In Supabase mode the AuthGate enforces the email allowlist.
// View navigation is held in local state and persisted to localStorage so a
// refresh keeps you where you were.

import { useEffect, useState } from 'react';
import { AuthGate } from './components/AuthGate';
import { Sidebar, type ViewName } from './components/Sidebar';
import { Toaster } from './components/Toaster';
import { BoardView } from './views/BoardView';
import { MatrixView } from './views/MatrixView';
import { ProducerView } from './views/ProducerView';
import { useAuth } from './hooks/useAuth';
import { useStudio } from './hooks/useStudioData';
import { IS_LOCAL } from './lib/backend';

export default function App() {
  const auth = useAuth();
  const allowed = IS_LOCAL || !!auth.isAllowed;
  const data = useStudio({ enabled: allowed });

  const [view, setView]             = useState<ViewName>(() => (localStorage.getItem('v2-view') as ViewName) || 'board');
  const [producerId, setProducerId] = useState<string | null>(() => localStorage.getItem('v2-producerId'));

  useEffect(() => { localStorage.setItem('v2-view', view); }, [view]);
  useEffect(() => {
    if (producerId) localStorage.setItem('v2-producerId', producerId);
    else localStorage.removeItem('v2-producerId');
  }, [producerId]);

  const navigate = (nextView: ViewName, nextProducerId?: string) => {
    setView(nextView);
    if (nextProducerId !== undefined) setProducerId(nextProducerId);
  };

  const shell = (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-warm">
      <Sidebar view={view} producerId={producerId} onNavigate={navigate} data={data} auth={auth}/>
      <main className="flex-1 min-w-0 flex flex-col">
        {data.error && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-[12px] text-red-800">
            שגיאת טעינה: {data.error}
          </div>
        )}
        {data.loading ? (
          <div className="flex-1 flex items-center justify-center text-ink-500">טוען נתונים…</div>
        ) : view === 'board' ? (
          <BoardView data={data}/>
        ) : view === 'matrix' ? (
          <MatrixView data={data} onOpenProducer={(id) => navigate('producer', id)}/>
        ) : producerId ? (
          <ProducerView data={data} producerId={producerId} onBack={() => navigate('matrix')}/>
        ) : (
          <div className="flex-1 flex items-center justify-center text-ink-500">בחר/י מפיק.ה מהסיידבר</div>
        )}
      </main>
      <Toaster/>
    </div>
  );

  return IS_LOCAL ? shell : <AuthGate auth={auth}>{shell}</AuthGate>;
}

import { Outlet } from 'react-router';
import { Toaster } from 'sonner';
import Sidebar from './Sidebar';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-neutral-50 flex print:bg-white">
      <Sidebar />
      <main className="flex-1 ml-[72px] print:ml-0 min-h-screen overflow-auto">
        <Outlet />
      </main>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}

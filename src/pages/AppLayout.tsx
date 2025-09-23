import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';

export default function AppLayout() {
    return (
        <div className="w-full min-h-screen bg-[#121214]">
            {/* Mobile nav (small screens) */}
            <div className="md:hidden">
                <MobileNav />
            </div>

            {/* Shell */}
            <div className="flex h-[calc(100vh)] overflow-hidden">
                {/* Sidebar fixed height (md and up) */}
                <div className="hidden md:block flex-shrink-0 my-4 ml-4">
                    <div className="h-[calc(100vh-32px)]">
                        <Sidebar />
                    </div>
                </div>

                {/* Content pane scrolls and matches vertical box */}
                <main className="flex-1 my-4 mr-4 h-[calc(100vh-32px)] overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}


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
            <div className="flex md:h-[calc(100vh)] min-h-screen md:overflow-hidden">
                {/* Sidebar fixed height (md and up) */}
                <div className="hidden md:block flex-shrink-0 my-4 ml-4">
                    <div className="h-[calc(100vh-32px)]">
                        <Sidebar />
                    </div>
                </div>

                {/* Content pane scrolls and matches vertical box */}
                <main className="flex-1 md:my-4 md:mr-4 md:h-[calc(100vh-32px)] md:overflow-y-auto overflow-x-hidden w-full">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}


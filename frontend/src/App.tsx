import { useLocation, Routes, Route } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

import Sidebar from "./layout/sidebar";
import Header from "./layout/header";
import Footer from "./layout/footer";

import ProcessorPage from "./routes/ProcessPage";
import SetupPage from "./routes/SetupPage";

import RequestHandler from "./lib/utilities/request_handler";
import { APP_NAME } from "./lib/constant";
import { Dashboard } from "./routes/Dashboard";

const ROUTE_NAMES: Record<string, string> = {
	"/": "Dashboard",
	"/process": "Process",
	"/setup": "Setup",
};

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export default function App() {
	RequestHandler.init();
	const location = useLocation();

	useEffect(() => {
		const routeName = ROUTE_NAMES[location.pathname] ?? "Page";
		document.title = `${APP_NAME} | ${routeName}`;
	}, [location.pathname]);

	return (
		<div className="flex min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
			<Sidebar />
			<div className="ml-[220px] flex flex-col flex-1 min-h-screen min-w-0">
				<Header />
				<AnimatePresence mode="wait">
					<motion.main
						key={location.pathname}
						className="flex-1 p-7 pb-0 overflow-y-auto overflow-x-hidden"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
					>
						<Routes location={location}>
							<Route path="/" element={<Dashboard />} />
							<Route path="/process" element={<ProcessorPage />} />
							<Route path="/setup" element={<SetupPage />} />
						</Routes>
					</motion.main>
				</AnimatePresence>
				<Footer />
			</div>
		</div>
	);
}
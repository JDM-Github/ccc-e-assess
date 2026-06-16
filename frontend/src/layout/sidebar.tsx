import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { APP_NAME } from "../lib/constant";

type NavItem = {
	label: string;
	path: string;
	icon: React.ReactNode;
	badge?: string;
};

type NavSection = {
	section: string;
	items: NavItem[];
};

const IconDashboard = () => (
	<svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
		<rect x="1" y="1" width="5.5" height="5.5" rx="1.2" />
		<rect x="8.5" y="1" width="5.5" height="5.5" rx="1.2" />
		<rect x="1" y="8.5" width="5.5" height="5.5" rx="1.2" />
		<rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" />
	</svg>
);

const IconProcess = () => (
	<svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
		<rect x="1" y="1" width="6" height="6" rx="1.2" />
		<rect x="8" y="1" width="6" height="6" rx="1.2" />
		<rect x="1" y="8" width="6" height="6" rx="1.2" />
		<circle cx="11" cy="11" r="3" />
		<path d="M11 9.5v1.5l1 1" strokeLinecap="round" />
	</svg>
);

const IconSetup = () => (
	<svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
		<path d="M2.5 4h10M2.5 7.5h7M2.5 11h8.5" strokeLinecap="round" />
	</svg>
);

// ── Nav config ─────────────────────────────────────────────────────────────────

const NAV: NavSection[] = [
	{
		section: "Main",
		items: [
			{ label: "Dashboard", path: "/", icon: <IconDashboard /> },
			{ label: "Process", path: "/process", icon: <IconProcess /> },
			{ label: "Setup", path: "/setup", icon: <IconSetup /> },
		],
	},
];

const SPRING = { type: "spring", stiffness: 420, damping: 38, mass: 0.7 } as const;

// ── Component ──────────────────────────────────────────────────────────────────

export default function Sidebar() {
	const location = useLocation();

	return (
		<motion.aside
			className="fixed top-0 left-0 w-[220px] h-screen flex flex-col bg-[var(--color-surface)] border-r border-[var(--color-border)] z-50"
			initial={{ x: -16, opacity: 0 }}
			animate={{ x: 0, opacity: 1 }}
			transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
		>
			<div className="h-[52px] shrink-0 flex items-center gap-3 px-4 border-b border-[var(--color-border)]">
				<img
					src={"/icon.png"}
					alt="Logo"
					style={{
						width: 55,
						height: 55,
						objectFit: "cover",
						transition: "width 0.22s ease, height 0.22s ease",
					}}
				/>
				<div className="flex flex-col gap-[1px] min-w-0">
					<span className="text-[13px] font-bold text-[var(--color-text)] tracking-[-0.2px] whitespace-nowrap">
						{APP_NAME}
					</span>
					<span className="text-[8px] font-mono text-[var(--color-text-faint)] tracking-[0.08em] uppercase">
						AUTOMATIC OMR
					</span>
				</div>
			</div>

			<nav className="flex-1 px-2.5 py-3 flex flex-col gap-0 overflow-y-auto overflow-x-hidden">
				{NAV.map(({ section, items }, gi) => (
					<motion.div
						key={section}
						className="mb-1"
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 + gi * 0.06, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
					>
						{/* Section label */}
						<div className="text-[9px] font-mono font-bold text-[var(--color-text-faint)] tracking-[0.14em] uppercase px-2 pt-3 pb-1.5">
							{section}
						</div>

						{/* Items */}
						{items.map((item) => {
							const isActive =
								item.path === "/"
									? location.pathname === "/"
									: location.pathname.startsWith(item.path);

							return (
								<NavLink key={item.path} to={item.path}>
									<motion.div
										className={[
											"relative flex items-center gap-[9px] px-2.5 py-[7px] rounded-[7px] mb-[2px]",
											"text-[12px] font-medium transition-colors duration-150 cursor-pointer overflow-hidden",
											isActive
												? "bg-[var(--color-accent-dim)] text-[var(--color-accent)] border border-[var(--color-accent-border)]"
												: "text-[var(--color-text-muted)] border border-transparent hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]",
										].join(" ")}
										whileHover={!isActive ? { x: 2 } : {}}
										transition={SPRING}
									>
										{/* Icon */}
										<span className={["flex items-center justify-center shrink-0 transition-opacity", isActive ? "opacity-100" : "opacity-55"].join(" ")}>
											{item.icon}
										</span>

										{/* Label */}
										<span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
											{item.label}
										</span>

										{/* Badge */}
										{item.badge && (
											<span className="text-[9px] font-mono font-bold bg-[var(--color-accent)] text-white px-1.5 py-[2px] rounded-[4px] tracking-[0.04em]">
												{item.badge}
											</span>
										)}

										{/* Active indicator bar */}
										{isActive && (
											<motion.span
												className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-[55%] bg-[var(--color-accent)] rounded-l-[2px]"
												layoutId="active-bar"
												transition={{ duration: 0.18, ease: "easeOut" }}
											/>
										)}
									</motion.div>
								</NavLink>
							);
						})}
					</motion.div>
				))}
			</nav>
		</motion.aside>
	);
}
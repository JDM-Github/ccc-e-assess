import { motion } from "framer-motion";


export default function Footer() {
    return (
        <motion.footer
            className="h-[32px] shrink-0 flex items-center justify-between px-7 border-t border-[var(--color-border)] bg-[var(--color-surface)]"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.2 }}
        >
            <span className="text-[9px] font-mono text-[var(--color-text-faint)] tracking-[0.06em]">
                E-ASSESS Developed By John Dave Pega
            </span>
        </motion.footer>
    );
}
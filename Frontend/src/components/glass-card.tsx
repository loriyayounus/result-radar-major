import { motion } from "framer-motion";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
  delay = 0,
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      whileHover={hover ? { y: -3 } : undefined}
      className={cn("glass rounded-2xl p-6", className)}
    >
      {children}
    </motion.div>
  );
}

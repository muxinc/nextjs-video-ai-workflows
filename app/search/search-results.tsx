"use client";

import { motion, useReducedMotion } from "motion/react";
import { Children, isValidElement } from "react";
import type { ReactNode } from "react";

interface SearchResultsProps {
  query: string;
  children: ReactNode;
}

export function SearchResults({ query, children }: SearchResultsProps) {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: {},
    show: {
      transition: shouldReduceMotion ?
          undefined :
          {
            delayChildren: 0.03,
            staggerChildren: 0.05,
          },
    },
  } as const;

  const itemVariants = {
    hidden: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
    show: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 },
  } as const;

  const childArray = Children.toArray(children);

  return (
    <motion.div
      // Remount on query change so the entrance animation replays for new results.
      key={query || "no-query"}
      className="flex flex-col gap-4"
      initial={shouldReduceMotion ? false : "hidden"}
      animate="show"
      variants={containerVariants}
    >
      {childArray.map((child, index) => {
        const key = isValidElement(child) ? child.key ?? index : index;

        return (
          <motion.div
            key={key}
            variants={itemVariants}
            transition={shouldReduceMotion ?
                undefined :
                { type: "spring", stiffness: 520, damping: 40, mass: 0.7 }}
          >
            {child}
          </motion.div>
        );
      })}
    </motion.div>
  );
}



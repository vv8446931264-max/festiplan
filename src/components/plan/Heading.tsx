"use client";

import { createContext, useContext, type HTMLAttributes, type ReactNode, type Ref } from "react";

/** The plan title's heading level: 1 on the share page, 2 where the plan unfolds in the landing page. */
export type PlanTitleLevel = 1 | 2;

const TitleLevel = createContext<PlanTitleLevel>(2);

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

/** Sets the level every {@link Heading} inside counts from (PlanView passes its title's level). */
export function PlanHeadingLevel({
  level,
  children,
}: {
  level: PlanTitleLevel;
  children: ReactNode;
}) {
  return <TitleLevel value={level}>{children}</TitleLevel>;
}

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  /** Levels below the plan title: 1 a chapter, 2 a chapter's sub-heading, 3 one level further. */
  depth: 1 | 2 | 3;
  ref?: Ref<HTMLHeadingElement>;
};

/**
 * A heading ranked relative to the plan title, so the outline never skips a level: chapters
 * are h2 under the share page's h1 title and h3 under the landing page's h2, and each
 * sub-heading sits one level below its chapter.
 */
export function Heading({ depth, ...props }: HeadingProps) {
  const titleLevel = useContext(TitleLevel);
  const Tag = HEADING_TAGS[titleLevel + depth - 1];
  return <Tag {...props} />;
}

"use client";

import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";
import styles from "./workspace-modules.module.css";

const InlineSection = createContext(false);
export function useInlineSection() {
  return useContext(InlineSection);
}

function flattenSections(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? flattenSections(child.props.children)
      : [child],
  );
}

/** Server-rendered sections stay mounted when switching tabs, preserving draft input. */
export function BookingWorkspace({ children }: { children: ReactNode }) {
  const sections = flattenSections(children).filter(
    (child) => isValidElement<{ title?: string }>(child) && child.props.title,
  );
  const titles = sections.map((section) =>
    isValidElement<{ title: string }>(section) ? section.props.title : "",
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const id = useId();
  const active = Math.max(0, selected ? titles.indexOf(selected) : 0);
  function select(title: string) {
    setVisited((current) => [...new Set([...current, titles[active], title])]);
    setSelected(title);
  }
  return (
    <div className={styles.workspace}>
      <div role="tablist" aria-label="Booking sections" className={styles.tabs}>
        {sections.map((section, index) => {
          const title = isValidElement<{ title: string }>(section)
            ? section.props.title
            : "";
          return (
            <button
              type="button"
              role="tab"
              key={title}
              id={`${id}-tab-${index}`}
              aria-controls={`${id}-panel-${index}`}
              aria-selected={active === index}
              tabIndex={active === index ? 0 : -1}
              className={styles.tab}
              onClick={() => select(title)}
              onKeyDown={(event) => {
                let next = index;
                if (event.key === "ArrowRight")
                  next = (index + 1) % sections.length;
                else if (event.key === "ArrowLeft")
                  next = (index - 1 + sections.length) % sections.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = sections.length - 1;
                else return;
                event.preventDefault();
                select(titles[next]);
                document.getElementById(`${id}-tab-${next}`)?.focus();
              }}
            >
              {title}
            </button>
          );
        })}
      </div>
      <InlineSection value={true}>
        {sections.map((section, index) => (
          <div
            key={titles[index]}
            role="tabpanel"
            id={`${id}-panel-${index}`}
            aria-labelledby={`${id}-tab-${index}`}
            hidden={active !== index}
            tabIndex={0}
          >
            {(active === index || visited.includes(titles[index])) && section}
          </div>
        ))}
      </InlineSection>
    </div>
  );
}

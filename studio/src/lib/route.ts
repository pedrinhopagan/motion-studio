import { useEffect, useRef, useState } from "react";

export type ProjectTab = "workspace" | "context" | "files" | "versions";
export type Route =
  | { page: "library" | "files" | "references" | "sounds" }
  | { page: "project"; id: string; tab: ProjectTab };

const pages: Record<string, Route> = {
  "/files": { page: "files" },
  "/references": { page: "references" },
  "/sounds": { page: "sounds" },
};

export function parseRoute(hash: string): Route {
  const path = hash.slice(1) || "/";
  const match =
    /^\/projects\/([a-z0-9-]+)\/(workspace|context|files|versions)$/.exec(path);
  if (match) {
    return { page: "project", id: match[1], tab: match[2] as ProjectTab };
  }
  return pages[path] ?? { page: "library" };
}

export function projectHref(id: string, tab: ProjectTab = "workspace") {
  return `#/projects/${id}/${tab}`;
}

export function useRoute(onChange?: () => void) {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  const changed = useRef(onChange);
  changed.current = onChange;
  useEffect(() => {
    const handle = () => {
      setRoute(parseRoute(location.hash));
      changed.current?.();
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", handle);
    return () => removeEventListener("hashchange", handle);
  }, []);
  return route;
}

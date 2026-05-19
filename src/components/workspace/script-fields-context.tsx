"use client";

import * as React from "react";
import type { SalesScript, CaptureField } from "@/lib/constants";

export interface AvailableField {
  id: string;
  label: string;
  type: CaptureField["type"];
}

const Ctx = React.createContext<AvailableField[]>([]);

/**
 * Provides the list of capture-field ids defined anywhere in the script so
 * nested editors (e.g. the discovery prompt editor) can offer a binding
 * dropdown without having to walk the script themselves.
 */
export function ScriptFieldsProvider({
  script, children,
}: {
  script: SalesScript;
  children: React.ReactNode;
}) {
  const fields = React.useMemo<AvailableField[]>(() => {
    const out: AvailableField[] = [];
    for (const sec of script.sections) {
      for (const blk of sec.blocks) {
        if (blk.kind === "capture" && blk.fields) {
          for (const f of blk.fields) {
            out.push({ id: f.id, label: f.label, type: f.type });
          }
        }
      }
    }
    return out;
  }, [script]);

  return <Ctx.Provider value={fields}>{children}</Ctx.Provider>;
}

export function useAvailableFields() {
  return React.useContext(Ctx);
}

"use client";

import { useEffect, useRef } from "react";

export function AutoDownload({ raceDayId, enabled }: { raceDayId: string; enabled: boolean }) {
  const started = useRef(false);
  useEffect(() => {
    if (enabled && !started.current) {
      started.current = true;
      const link = document.createElement("a");
      link.href = `/api/admin/race-days/${encodeURIComponent(raceDayId)}/report`;
      document.body.append(link);
      link.click();
      link.remove();
    }
  }, [enabled, raceDayId]);

  return null;
}

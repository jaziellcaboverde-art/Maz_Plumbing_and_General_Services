"use client";

import { useState } from "react";

/** Missing or removed storage objects must not leave broken images in service cards. */
export function ServiceImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return null;
  return (
    <span className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" onError={() => setFailed(src)} />
    </span>
  );
}

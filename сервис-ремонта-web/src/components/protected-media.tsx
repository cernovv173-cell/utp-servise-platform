import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { useAuth } from "@/features/auth/auth-context";

import { fetchProtectedMedia } from "@/lib/api";

export const ProtectedMedia = ({
  objectId,
  alt,
  className = "",
}: {
  objectId: string | null | undefined;
  alt: string;
  className?: string;
}) => {
  const { token } = useAuth();
  const media = useQuery({
    queryKey: ["protected-media", objectId, token],
    queryFn: ({ signal }) => fetchProtectedMedia(token!, objectId!, signal),
    enabled: Boolean(token && objectId),
    staleTime: 5 * 60_000,
  });
  const source = useMemo(
    () => (media.data ? URL.createObjectURL(media.data) : undefined),
    [media.data],
  );
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );

  if (!source) {
    return (
      <div
        role="img"
        aria-label={media.isLoading ? `Загружается: ${alt}` : alt}
        className={`bg-slate-100 dark:bg-slate-800 ${className}`}
      />
    );
  }
  if (media.data?.type.startsWith("video/")) {
    return (
      <video
        src={source}
        controls
        playsInline
        preload="metadata"
        aria-label={alt}
        className={className}
      />
    );
  }
  return <img src={source} alt={alt} loading="lazy" className={className} />;
};

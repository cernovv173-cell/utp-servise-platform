import { useQuery } from "@tanstack/react-query";
import { type ImgHTMLAttributes, useEffect, useMemo } from "react";

import { useAuth } from "@/features/auth/auth-context";

import { fetchProtectedMedia } from "@/lib/api";

export const ProtectedImage = ({
  objectId,
  ...props
}: { objectId: string | null | undefined } & Omit<ImgHTMLAttributes<HTMLImageElement>, "src">) => {
  const { token } = useAuth();
  const media = useQuery({
    queryKey: ["protected-media", objectId, token],
    queryFn: ({ signal }) => fetchProtectedMedia(token!, objectId!, signal),
    enabled: Boolean(token && objectId),
    staleTime: 5 * 60_000,
  });
  const src = useMemo(
    () => (media.data ? URL.createObjectURL(media.data) : undefined),
    [media.data],
  );
  useEffect(
    () => () => {
      if (src) URL.revokeObjectURL(src);
    },
    [src],
  );
  if (!src)
    return (
      <div
        aria-hidden="true"
        className={`bg-slate-100 dark:bg-slate-800 ${props.className ?? ""}`}
      />
    );
  return <img {...props} src={src} />;
};

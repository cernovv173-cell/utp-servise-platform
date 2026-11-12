import { ProtectedImage } from "@/components/protected-image";

type UserAvatarProps = {
  objectId?: string | null;
  alt: string;
  className: string;
};

export const UserAvatar = ({ objectId, alt, className }: UserAvatarProps) => {
  if (objectId) {
    return <ProtectedImage objectId={objectId} alt={alt} className={`${className} object-cover`} />;
  }

  return (
    <img
      src="/images/mascot-cyberpunk-avatar.webp"
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`${className} object-cover object-top`}
    />
  );
};

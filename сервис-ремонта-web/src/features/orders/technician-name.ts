export const shortTechnicianName = (displayName: string): string => {
  const parts = displayName.trim().split(/\s+/u).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";

  return [
    parts[0],
    ...parts.slice(1).map((part) => {
      const firstCharacter = Array.from(part.replace(/\.$/u, ""))[0];
      return firstCharacter ? `${firstCharacter.toLocaleUpperCase("ru-RU")}.` : "";
    }),
  ]
    .filter(Boolean)
    .join(" ");
};

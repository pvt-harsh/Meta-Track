import { useState } from "react";

export function getInitials(name, email) {
  const source = (name && name.trim()) || (email ? email.split("@")[0] : "");
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ url, name, email, size = 32 }) {
  const [failed, setFailed] = useState(null);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (url && failed !== url) {
    return <img className="avatar" style={style} src={url} alt="" onError={() => setFailed(url)} />;
  }
  return <span className="avatar avatar-fallback" style={style} aria-hidden="true">{getInitials(name, email)}</span>;
}

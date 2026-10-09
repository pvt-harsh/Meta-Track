export const LOGO_SIZES = { sm: 24, md: 32, lg: 32 };

export default function Logo({ size = "md", showWordmark = true, stacked = false, tagline = false }) {
  const px = LOGO_SIZES[size] ?? 32;
  return (
    <span className={`logo logo-${size} ${stacked ? "logo-stacked" : ""}`}>
      <img className="logo-mark" src="/favicon.png" width={px} height={px} alt={showWordmark ? "" : "MetaTrack"} decoding="async" />
      {showWordmark && (
        <span className="logo-text">
          <b>MetaTrack</b>
          {tagline && <small>Crypto market tracker</small>}
        </span>
      )}
    </span>
  );
}

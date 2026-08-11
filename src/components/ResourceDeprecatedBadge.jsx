export default function ResourceDeprecatedBadge({ show = false }) {
  if (!show) return null;

  return (
    <span
      className="gcDeprecatedBadge"
      title="Marked deprecated by the provider — avoid new use and plan migration."
    >
      Deprecated
    </span>
  );
}

import { useStore } from '../store';
import { formatDateKo } from '../data/timeline';
import { scenarioForDate } from '../data/scenarios';

export function DateBanner() {
  const snapshot = useStore((s) => s.snapshot);
  const sc = scenarioForDate(snapshot);
  return (
    <div className="date-banner" key={snapshot} aria-live="polite">
      {sc?.banner ?? `${formatDateKo(snapshot)} 전황`}
    </div>
  );
}

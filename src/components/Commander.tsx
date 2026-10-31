import { personById, portraitCredit, portraitUrl } from '../lib/people';
import { Flag } from './Flags';

function dedupe(s: string) {
  const t = s.trim();
  const half = t.length / 2;
  if (t.length % 2 === 0 && t.slice(0, half) === t.slice(half)) return t.slice(0, half);
  return t.replace(/^Unknown author.*/i, '작자 미상');
}

export function Portrait({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' | 'lg' }) {
  const url = portraitUrl(id);
  const p = personById(id);
  if (!url) {
    const initials = p ? p.ko.replace(/\s+/g, '').slice(0, 2) : '?';
    return <div className={`portrait-img ph ${size}`} aria-hidden="true">{initials}</div>;
  }
  return <img className={`portrait-img ${size}`} src={url} alt={p ? `${p.ko} 사진` : ''} loading="lazy" />;
}

export function CommanderCard({ id, rank, role }: { id: string; rank?: string; role?: string }) {
  const p = personById(id);
  if (!p) return null;
  const credit = portraitCredit(id);
  const wiki = p.wiki ? `https://en.wikipedia.org/wiki/${encodeURIComponent(p.wiki.replace(/ /g, '_'))}` : null;
  return (
    <section className="cmd-card" aria-label="지휘관">
      <Portrait id={id} size="lg" />
      <div className="cmd-body">
        {role && <div className="eyebrow">{role}</div>}
        <div className="cmd-name">
          <Flag nat={p.nat} w={20} />
          <span>{rank ? <span className="rank">{rank} </span> : null}{p.ko}</span>
        </div>
        <div className="cmd-en">
          {p.en}
          {p.born && <span className="years"> · {p.born}–{p.died ?? ''}</span>}
        </div>
        {p.bio && <p className="cmd-bio">{p.bio}</p>}
        <div className="cmd-links">
          {wiki && (
            <a href={wiki} target="_blank" rel="noreferrer">위키백과 ↗</a>
          )}
          {credit && (
            <a className="credit" href={credit.page} target="_blank" rel="noreferrer" title={credit.src}>
              사진: {credit.author ? dedupe(credit.author).slice(0, 48) : '작자 미상'} · {credit.license || '라이선스 확인'}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

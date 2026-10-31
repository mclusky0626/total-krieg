"""scripts/data/people.txt → src/data/people.json"""
from common import APP_DATA, ROOT, write_json

NATS = {"DEU", "ITA", "ROU", "HUN", "FIN", "SVK", "BGR", "HRV", "SOV", "GBR", "USA", "FRA", "FFL", "POL", "BEL",
        "NLD", "CAN", "GRC", "YUG", "NOR", "CSK", "AUS", "NZL", "SAF", "IND", "PLA",
        "ESP", "DNK", "SWE", "TUR", "CHE", "IRL", "PRT"}


def parse():
    out, seen = [], set()
    for ln in open(ROOT / "scripts" / "data" / "people.txt", encoding="utf-8"):
        ln = ln.strip()
        if not ln or ln.startswith("#"):
            continue
        parts = [p.strip() for p in ln.split("|")]
        if len(parts) != 8:
            raise SystemExit(f"bad line ({len(parts)} fields): {ln[:80]}")
        pid, ko, en, nat, born, died, wiki, bio = parts
        if pid in seen:
            raise SystemExit(f"duplicate id {pid}")
        if nat not in NATS:
            raise SystemExit(f"bad nat {nat} for {pid}")
        seen.add(pid)
        item = {"id": pid, "ko": ko, "en": en, "nat": nat}
        if born:
            item["born"] = born
        if died:
            item["died"] = died
        if bio:
            item["bio"] = bio
        item["wiki"] = wiki or en
        out.append(item)
    return out


if __name__ == "__main__":
    people = parse()
    write_json(APP_DATA / "people.json", people, compact=False)
    print(len(people), "people")

"""커트라인 구글시트(xlsx 내보내기) -> private/cutoffs.json 변환 (공개 저장소에는 암호화본만 올림).
사용: python3 scripts/build_data.py <cut.xlsx>
시트 '커트라인(원본)'의 인천 학교(숫자 연번) 행만 사용합니다."""
import json, re, sys, pathlib
import openpyxl

YEARS = [2025, 2024, 2023, 2022]  # 각 연도: 특별컷, 특별비고, 일반컷 (E열부터 3칸씩)
NUM = re.compile(r"\d+(?:\.\d+)?")

def clean(v):
    if v is None: return ""
    return re.sub(r"[ \t]+", " ", str(v)).replace("\r", "").strip()

SENSITIVE = re.compile(r"\(?[^()\n]*학폭[^()\n]*\)?")

def scrub(text):
    """개인 식별·민감 정보(학폭 기재 등) 문구 제거"""
    text = SENSITIVE.sub("", text)
    return "\n".join(l.strip() for l in text.splitlines() if l.strip())

def parse_cut(v):
    """반환: (숫자 or None, 미달여부, 원문)"""
    raw = clean(v)
    if isinstance(v, (int, float)):
        x = float(v)
        if x == 0: return None, False, ""
        if 0 < x < 1: x *= 100          # 0.8961 같은 서식 오류
        return round(x, 2), False, ""
    if not raw or not NUM.search(raw):
        return (100.0, True, "") if "미달" in raw else (None, False, "")
    x = float(NUM.search(raw).group())
    if x == 0: return None, False, raw
    return round(x, 2), False, raw.replace("\n", " ")

def main(path):
    ws = openpyxl.load_workbook(path, data_only=True)["커트라인(원본)"]
    rows = []
    for r in ws.iter_rows(min_row=4, max_col=16, values_only=True):
        rid, school, kind, dept = r[0], clean(r[1]), clean(r[2]), clean(r[3])
        if not isinstance(rid, (int, float)) or not school: continue
        item = {"id": int(rid), "school": school, "type": kind or "공학", "dept": dept, "years": {}}
        for i, y in enumerate(YEARS):
            sp, sp_mi, sp_raw = parse_cut(r[4 + i*3])
            ge, ge_mi, ge_raw = parse_cut(r[6 + i*3])
            note = clean(r[5 + i*3])
            item["years"][str(y)] = {
                "special": sp, "specialRaw": sp_raw, "specialUnder": sp_mi,
                "general": ge, "generalRaw": ge_raw, "generalUnder": ge_mi,
                "note": note,
            }
        rows.append(item)
    out = pathlib.Path(__file__).resolve().parent.parent / "private" / "cutoffs.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({"source": "특성화고·마이스터고 커트라인 공유 자료 (2026.9.11 기준)", "rows": rows}, ensure_ascii=False, indent=1))
    print(f"{len(rows)} rows -> {out}")

if __name__ == "__main__":
    main(sys.argv[1])

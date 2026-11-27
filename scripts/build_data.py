"""커트라인 구글시트(xlsx 내보내기) -> private/cutoffs.json 변환 (공개 저장소에는 암호화본만 올림).
사용: python3 scripts/build_data.py <cut.xlsx>

시트 '커트라인(원본)'에서
- 4행(제목 행)의 "YYYY 커트라인 (특별)" 칸을 찾아 학년도별 [특별컷, 특별 비고, 일반컷] 3칸을 읽고
- 5행부터 인천 특성화고·마이스터고 행만 읽습니다(특수지 일반고·타시도 행이 나오면 멈춤).
연번 칸은 엑셀이 날짜로 바꿔 버리는 경우가 있어 쓰지 않고, 학교명+학과로 식별합니다.
머리말의 작성자·수정자 이름 등은 읽지 않습니다."""
import json, re, sys, pathlib
import openpyxl

NUM = re.compile(r"\d+(?:\.\d+)?")
STOP = re.compile(r"^(특수지|타시도)|일반고$")
# 학교명 표기가 바뀐 경우 예전 이름으로 맞춤 (앱의 학교 연결용)
SCHOOL_ALIAS = {"계산공고(에너지고)": "계산공업고"}


def clean(v):
    if v is None: return ""
    return re.sub(r"[ \t]+", " ", str(v)).replace("\r", "").strip()


def parse_cut(v):
    """반환: (숫자 or None, 미달여부, 원문)
    글이 섞인 칸은 '불합격' 사례 숫자를 빼고, 합격(또는 표시 없는) 숫자 중 가장 큰 값을 커트라인으로 봅니다."""
    raw = clean(v)
    if isinstance(v, (int, float)):
        x = float(v)
        if x == 0: return None, False, ""
        if 0 < x < 1: x *= 100          # 0.8961 같은 서식 오류
        return round(x, 2), False, ""
    if not raw or not NUM.search(raw):
        return (100.0, True, "") if "미달" in raw else (None, False, "")
    if re.fullmatch(r"\d+(?:\.\d+)?", raw):
        return round(float(raw), 2), False, ""
    cands = []
    for seg in re.split(r"[\n/]", raw):
        if "불합" in seg: continue
        m = NUM.search(seg)
        if m and float(m.group()) > 0: cands.append(float(m.group()))
    x = max(cands) if cands else None
    return (round(x, 2) if x else None), False, raw.replace("\n", " ")


def main(path):
    ws = openpyxl.load_workbook(path, data_only=True)["커트라인(원본)"]
    header = [clean(c) for c in next(ws.iter_rows(min_row=4, max_row=4, values_only=True))]
    cols = []  # (학년도, 특별컷 칸 번호)
    for i, h in enumerate(header):
        m = re.match(r"^(\d{4}) 커트라인 \(특별\)$", h.replace("\n", " "))
        if m: cols.append((m.group(1), i))
    if not cols: sys.exit("제목 행에서 'YYYY 커트라인 (특별)' 칸을 찾지 못했습니다.")
    rows, seen = [], set()
    for r in ws.iter_rows(min_row=5, values_only=True):
        school, kind, dept = clean(r[1]), clean(r[2]), clean(r[3])
        rid = clean(r[0])
        if STOP.search(school) or rid.startswith(("특", "타")): break
        if not school or not dept: continue
        school = SCHOOL_ALIAS.get(school, school)
        key = f"{school}|{dept}"
        if key in seen: continue
        seen.add(key)
        item = {"id": re.sub(r"[^0-9A-Za-z가-힣]", "", school + dept), "school": school, "type": kind or "공학", "dept": dept, "years": {}}
        for y, c in cols:
            sp, sp_mi, sp_raw = parse_cut(r[c])
            ge, ge_mi, ge_raw = parse_cut(r[c + 2])
            item["years"][y] = {
                "special": sp, "specialRaw": sp_raw, "specialUnder": sp_mi,
                "general": ge, "generalRaw": ge_raw, "generalUnder": ge_mi,
                "note": clean(r[c + 1]),
            }
        rows.append(item)
    years = [y for y, _ in cols]
    out = pathlib.Path(__file__).resolve().parent.parent / "private" / "cutoffs.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({
        "source": "특성화고·마이스터고 커트라인 공유 자료 (2026.11.19 기준)",
        "years": years,            # 최신 학년도부터
        "current": years[0],       # 올해 진행 중인 입시(일부만 입력됨)
        "rows": rows,
    }, ensure_ascii=False, indent=1))
    print(f"{len(rows)} rows, 학년도 {years} -> {out}")


if __name__ == "__main__":
    main(sys.argv[1])

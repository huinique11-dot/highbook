"""2027 고입 파노라마 자료 -> private/panorama.json (공개 저장소에는 암호화본만 올림)
- private/panorama/pages_raw.json : PDF 페이지별 텍스트 (pdftotext)
- private/panorama/p07~p12.json  : 이미지로 된 특성화고·마이스터고 안내 페이지를 옮겨 적은 자료
- private/panorama/categories.json: 13쪽 계열별 분류
사용: python3 scripts/build_panorama.py"""
import json, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
P = ROOT / "private" / "panorama"

TOC = {1:"표지·목차",2:"2027 고입 기본계획 주요 사항",3:"평준화지역 일반고 학교군 편성표",4:"특수지 일반고 입학 안내",
5:"영재학교·특목고·자사고 입학 전형 ①",6:"영재학교·특목고·자사고 입학 전형 ②",7:"특성화고 학과 안내 (남녀공학 ①)",
8:"특성화고 학과 안내 (남녀공학 ②)",9:"특성화고 학과 안내 (여학생 ①)",10:"특성화고 학과 안내 (여학생 ②·남학생 ①)",
11:"특성화고 학과 안내 (남학생 ②·협약형 ①)",12:"협약형 특성화고 ②·마이스터고",13:"학과별 분류·특성화고 입학전형 일정",
14:"지역별 특성화고 현황·관련 사이트",15:"2028 대입 개편안의 이해",16:"2022 개정 교육과정과 고교학점제 ①",
17:"2022 개정 교육과정과 고교학점제 ②",18:"계열 및 전공학과 안내",19:"계열별 권장 선택 과목",20:"2027 전기·후기고 입학전형 일정"}

KIND = {"남·녀 학생 모두 지원할 수 있는 특성화고 (총 10개교)":("특성화고","공학"),
        "여학생만 지원할 수 있는 특성화고 (총 7개교)":("특성화고","여"),
        "남학생만 지원할 수 있는 특성화고 (총 5개교)":("특성화고","남"),
        "남·녀 학생 모두 지원할 수 있는 협약형 특성화고 (총 4개교)":("협약형 특성화고","공학"),
        "남녀 학생 모두 지원할 수 있는 마이스터고 (총 2개교)":("마이스터고","공학")}

def short(name):
    n = re.sub(r"\(현[^)]*\)", "", name).replace("국립", "").replace("고등학교", "고").replace(" ", "")
    return n

def school_text(s):
    lines = [f"{s['name']} ({s['kind']}, {s['gender']}) 위치: {s['loc']} 전화: {s['tel']}", f"선발방법: {s['selection']}"]
    for d in s["depts"]:
        q = f"학급 {d['cls']}, 모집 {d['total']}명(특별 {d['sp']}, 일반 {d['gen'] if d['gen'] is not None else '-'})" if d.get("total") else "통합 모집"
        lines.append(f"- {d['name']}: {q}. {d.get('note','')} 소개: {d['intro']} / 자격증: {d['cert']} / 취업: {d['job']} / 진학: {d['univ']}")
    return "\n".join(lines)

def main():
    pages = json.loads((P / "pages_raw.json").read_text())
    schools = []
    for f in sorted(P.glob("p[01][0-9].json")):
        d = json.loads(f.read_text())
        blocks = [(d["group"], d["schools"])]
        if d.get("extra"): blocks.append((d["extra"]["group"], d["extra"]["schools"]))
        for group, ss in blocks:
            kind, gender = KIND[group]
            for s in ss:
                s.update(page=d["page"], group=group, kind=kind, gender=gender, short=short(s["name"]))
                s["id"] = re.sub(r"[^0-9A-Za-z가-힣]", "", s["short"])
                schools.append(s)
    cats = json.loads((P / "categories.json").read_text())
    # 이미지 페이지(7~12쪽)는 옮겨 적은 내용을 검색용 텍스트로 사용
    for p in pages:
        p["title"] = TOC[p["page"]]
        p["img"] = p["page"]
        if 7 <= p["page"] <= 12:
            p["text"] = p["title"] + "\n" + "\n\n".join(school_text(s) for s in schools if s["page"] == p["page"])
        if p["page"] == 13:
            p["text"] += "\n" + "\n".join(f"{c['name']} 관련 학과: " + ", ".join(f"{a}({b})" for a, b in c["items"]) for c in cats["categories"])
    out = {"title": "2027 고입 파노라마 (인천광역시교육청 진로진학지원단 마중물)", "pages": pages, "schools": schools, "categories": cats["categories"]}
    (ROOT / "private" / "panorama.json").write_text(json.dumps(out, ensure_ascii=False))
    print(len(pages), "pages,", len(schools), "schools")

if __name__ == "__main__":
    main()

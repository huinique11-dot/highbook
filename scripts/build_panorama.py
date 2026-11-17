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

DV_TOC = {4:"Ⅰ장 표지",5:"Ⅰ. 직업계고 현황",12:"Ⅱ장 표지",13:"Ⅱ. 졸업생 진로 현황",17:"메모",18:"Ⅲ장 표지",19:"Ⅲ. 직업계고 정부 지원 정책",24:"Ⅳ장 표지",25:"Ⅳ. 직업계고 대학 진학",29:"메모",30:"Ⅴ장 표지",60:"Ⅵ장 표지",61:"Ⅵ. 전공 학과별 분류표",1:"표지",2:"목차 ①",3:"목차 ②",6:"직업계고 현황·개념",7:"2027학년도 학교별 상세 학과",8:"2027학년도 신입생 모집 현황 ①",9:"2027학년도 신입생 모집 현황 ②",10:"2027학년도 신입생 모집 현황 ③",
11:"직업계고 지역별 현황",14:"2025학년도 졸업생 진로·취업 현황",15:"2025학년도 진학 현황",16:"선취업 후진학 현황",20:"공무원 시험제도 ①",21:"공무원 시험제도 ②",22:"공무원 시험제도 ③",23:"고졸 청년 지원 정책",
26:"특성화고 졸업자 특별전형",27:"재직자 특별전형",28:"조기 취업형 계약학과",31:"학교별 세부 현황 (목차)",62:"학과별 분류표: 기계",63:"학과별 분류표: 건축·토목",64:"학과별 분류표: 전기·전자·통신 ①",65:"학과별 분류표: 전기·전자·통신 ②",
66:"학과별 분류표: 디자인·소프트웨어",67:"학과별 분류표: 화공",68:"학과별 분류표: 사무·회계",69:"학과별 분류표: 유통·비즈니스",70:"학과별 분류표: 영상·관광·보건",71:"학과별 분류표: 수산·해운",72:"학과별 분류표: 식품·조리",73:"학과별 분류표: 미용·패션",74:"신입생 입학전형 주요 일정 ①",75:"신입생 입학전형 주요 일정 ②"}

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
    # 학과 지망 방식 (학교별 요강·자료에서 확인된 것만)
    choice = json.loads((P / "choice.json").read_text())
    for s in schools:
        if s["id"] in choice: s["choice"] = choice[s["id"]]
    # Dream & Vision 2027 (교육청 진로진학직업교육과). 사진은 가리고, 담당자 실명 쪽(76쪽)은 제외
    dv_pages = json.loads((ROOT / "private" / "dv" / "pages_raw.json").read_text())
    for p in dv_pages:
        p["text"] = p["text"].replace("\x07", "")
        lines = [l.strip() for l in p["text"].splitlines() if l.strip() and not re.match(r"^(DREAM|Dream|[ⅠⅡⅢⅣⅤⅥ]\.? |\d+$)", l.strip())]
        p["title"] = DV_TOC.get(p["page"]) or (lines[0][:40] if lines else f"{p['page']}쪽")
        if 32 <= p["page"] <= 59:
            head = re.sub(r"\s", "", p["text"])
            for s in schools:
                base = re.sub(r"\s|\(.*|국립", "", s["name"])
                if base in head:
                    s["dv"] = p["page"]; p["title"] = s["name"].split(" (")[0]
                    m = re.search(r"특색있는 교육활동\n(.*?)(?:\n교육활동 모습|$)", p["text"], re.S)
                    if m: s["features"] = [l.strip() for l in m.group(1).splitlines() if l.strip()]
                    break
    out = {"title": "2027 고입 파노라마 (인천광역시교육청 진로진학지원단 마중물)", "pages": pages, "schools": schools, "categories": cats["categories"],
           "dv": {"title": "2027 Dream & Vision 인천 특성화고 & 마이스터고 안내 (인천광역시교육청 진로진학직업교육과)", "pages": dv_pages}}
    (ROOT / "private" / "panorama.json").write_text(json.dumps(out, ensure_ascii=False))
    print(len(pages), "pages,", len(schools), "schools")

if __name__ == "__main__":
    main()

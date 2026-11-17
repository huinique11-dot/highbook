"""자료 암호화/복호화.

공개 저장소에는 암호화된 파일(secure/)만 올리고, 원본(private/)은 올리지 않습니다.
앱은 관리자 키를 입력받아 브라우저 안에서 secure/ 파일을 풀어 보여 줍니다.

사용:
  HB_KEY='관리자키' python3 scripts/secure.py encrypt   # private/ -> secure/
  HB_KEY='관리자키' python3 scripts/secure.py decrypt   # secure/source.enc -> private/ (원본 복구)
HB_KEY가 없으면 키를 직접 물어봅니다. 키를 바꾸려면 decrypt 후 새 키로 encrypt 하세요.

형식: PBKDF2-HMAC-SHA256(키, salt, 반복 횟수) -> AES-256-GCM 키.
각 파일 = 12바이트 IV + 암호문(GCM 태그 포함).
"""
import getpass, io, json, os, pathlib, sys, tarfile, time
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

ROOT = pathlib.Path(__file__).resolve().parent.parent
PRIV, SEC = ROOT / "private", ROOT / "secure"
ITER = 600_000


def passphrase():
    k = os.environ.get("HB_KEY") or getpass.getpass("관리자 키: ")
    if len(k) < 8:
        sys.exit("키는 8자 이상이어야 합니다.")
    return k


def derive(k, salt, it):
    return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=it).derive(k.encode("utf-8"))


def seal(key, data):
    iv = os.urandom(12)
    return iv + AESGCM(key).encrypt(iv, data, None)


def unseal(key, blob):
    return AESGCM(key).decrypt(blob[:12], blob[12:], None)


def encrypt():
    k = passphrase()
    # 같은 키로 다시 암호화할 때는 salt를 그대로 써서 풀이 키가 바뀌지 않게 함
    # (salt가 바뀌면 브라우저·캐시에 남은 예전 파일과 새 파일이 섞일 때 풀리지 않음)
    salt, it = os.urandom(16), ITER
    old_meta = SEC / "meta.json"
    if old_meta.exists() and (SEC / "data.enc").exists():
        m = json.loads(old_meta.read_text())
        try:
            unseal(derive(k, bytes.fromhex(m["salt"]), m["iter"]), (SEC / "data.enc").read_bytes())
            salt, it = bytes.fromhex(m["salt"]), m["iter"]
        except Exception:
            print("키가 바뀌어 새 salt로 암호화합니다.")
    key = derive(k, salt, it)
    if SEC.exists():
        for f in SEC.rglob("*"):
            if f.is_file():
                f.unlink()
    (SEC / "img").mkdir(parents=True, exist_ok=True)
    build = time.strftime("%Y%m%d%H%M%S")
    (SEC / "meta.json").write_text(json.dumps({"v": 1, "kdf": "PBKDF2-SHA256", "iter": it, "salt": salt.hex(), "build": build}))
    bundle = {
        "cutoffs": json.loads((PRIV / "cutoffs.json").read_text()),
        "panorama": json.loads((PRIV / "panorama.json").read_text()),
    }
    (SEC / "data.enc").write_bytes(seal(key, json.dumps(bundle, ensure_ascii=False).encode()))
    for folder, out in (("img", "img"), ("dv/img", "dv")):
        (SEC / out).mkdir(parents=True, exist_ok=True)
        for img in sorted((PRIV / folder).glob("*.jpg")):
            (SEC / out / (img.stem + ".enc")).write_bytes(seal(key, img.read_bytes()))
    # 원본 백업: 이미지는 위의 암호화 파일로 복구하므로 제외해 용량을 줄임
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(PRIV, arcname="private", filter=lambda t: None if t.name.endswith(".jpg") else t)
    (SEC / "source.enc").write_bytes(seal(key, buf.getvalue()))
    print("암호화 완료 ->", SEC)


def decrypt():
    k = passphrase()
    meta = json.loads((SEC / "meta.json").read_text())
    key = derive(k, bytes.fromhex(meta["salt"]), meta["iter"])
    try:
        raw = unseal(key, (SEC / "source.enc").read_bytes())
    except Exception:
        sys.exit("키가 맞지 않습니다.")
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as tar:
        tar.extractall(ROOT, filter="data")
    for folder, src in (("img", "img"), ("dv/img", "dv")):
        (PRIV / folder).mkdir(parents=True, exist_ok=True)
        for f in sorted((SEC / src).glob("*.enc")):
            (PRIV / folder / (f.stem + ".jpg")).write_bytes(unseal(key, f.read_bytes()))
    print("원본 복구 완료 ->", PRIV)


if __name__ == "__main__":
    {"encrypt": encrypt, "decrypt": decrypt}.get(sys.argv[1] if len(sys.argv) > 1 else "", lambda: sys.exit(__doc__))()

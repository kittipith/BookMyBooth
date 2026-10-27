"""สร้าง build/lambda.zip สำหรับอัปโหลดใน Lambda Console

ทุก function ใช้ zip เดียวกัน ต่างกันแค่ Handler (PLAN หัวข้อ 3)
รวม src/ กับ dependency ใน src/requirements.txt ที่ลงแบบ wheel ของ Linux x86_64 / Python 3.13
ไม่รวม aws-lambda-powertools, pydantic, boto3 เพราะมากับ layer และ runtime แล้ว

    python scripts/build_zip.py
"""

import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
BUILD = ROOT / "build"
DEPS = BUILD / "deps"
ZIP_PATH = BUILD / "lambda.zip"


def install_deps() -> None:
    shutil.rmtree(DEPS, ignore_errors=True)
    subprocess.run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--quiet",
            "--requirement",
            str(SRC / "requirements.txt"),
            "--target",
            str(DEPS),
            # ได้ wheel ที่ตรงกับ Lambda แม้จะ build บน Windows/Mac
            "--platform",
            "manylinux2014_x86_64",
            "--python-version",
            "3.13",
            "--implementation",
            "cp",
            "--only-binary=:all:",
        ],
        check=True,
    )


def _files(base: Path):
    for path in sorted(base.rglob("*")):
        if path.is_file() and "__pycache__" not in path.parts:
            yield path, path.relative_to(base).as_posix()


def write_zip() -> None:
    ZIP_PATH.unlink(missing_ok=True)
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, name in _files(DEPS):
            zf.write(path, name)
        for path, name in _files(SRC):
            if name != "requirements.txt":
                zf.write(path, name)


def main() -> None:
    BUILD.mkdir(exist_ok=True)
    install_deps()
    write_zip()
    print(f"{ZIP_PATH.relative_to(ROOT)} ({ZIP_PATH.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()

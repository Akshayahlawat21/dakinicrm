import os
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT_DIR / "zips"
OUTPUT_DIR.mkdir(exist_ok=True)

# Ignored folder and file patterns
EXCLUDE_DIRS = {
    "node_modules",
    "dist",
    "build",
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".tempmediaStorage",
    ".user_uploaded",
    "zips"
}

EXCLUDE_EXTS = {".pyc", ".pyo", ".pyd"}
EXCLUDE_FILES = {".env"}  # Never include real passwords/secrets; keep .env.example

def should_exclude(rel_path: Path) -> bool:
    for part in rel_path.parts:
        if part in EXCLUDE_DIRS:
            return True
    if rel_path.suffix in EXCLUDE_EXTS:
        return True
    if rel_path.name in EXCLUDE_FILES:
        return True
    return False

def make_zip(zip_path: Path, items_to_include: list[tuple[Path, str]]):
    print(f"Creating {zip_path.name}...")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for src_path, arc_prefix in items_to_include:
            if not src_path.exists():
                print(f"  Warning: {src_path} does not exist, skipping.")
                continue

            if src_path.is_file():
                arcname = (Path(arc_prefix) / src_path.name).as_posix() if arc_prefix else src_path.name
                zip_file.write(src_path, arcname)
                # print(f"  + {arcname}")
            elif src_path.is_dir():
                for root, dirs, files in os.walk(src_path):
                    # Filter out excluded dirs in-place
                    dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
                    
                    for f in files:
                        file_path = Path(root) / f
                        rel_file = file_path.relative_to(src_path)
                        if should_exclude(rel_file):
                            continue
                        
                        arcname = (Path(arc_prefix) / rel_file).as_posix() if arc_prefix else rel_file.as_posix()
                        zip_file.write(file_path, arcname)
    
    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"  [OK] Created {zip_path.name} ({size_mb:.2f} MB)")

def create_frontend_zip():
    # Frontend needs src, public, index.html, vite.config.js, package.json, package-lock.json, .env.example
    zip_path = OUTPUT_DIR / "dakini_frontend.zip"
    items = [
        (ROOT_DIR / "src", "src"),
        (ROOT_DIR / "public", "public"),
        (ROOT_DIR / "index.html", ""),
        (ROOT_DIR / "vite.config.js", ""),
        (ROOT_DIR / "package.json", ""),
        (ROOT_DIR / "package-lock.json", ""),
        (ROOT_DIR / ".env.example", ""),
        (ROOT_DIR / ".gitignore", ""),
        (ROOT_DIR / "FRONTEND_ANALYTICS_INTEGRATION.md", "")
    ]
    make_zip(zip_path, items)

def create_gateway_zip():
    # Layer 2 API Gateway
    zip_path = OUTPUT_DIR / "dakini_api_gateway.zip"
    items = [
        (ROOT_DIR / "gateway", "gateway"),
        (ROOT_DIR / "requirements.txt", "")
    ]
    make_zip(zip_path, items)

def create_backend_zip():
    # Layer 3 Application API & Data
    zip_path = OUTPUT_DIR / "dakini_backend_api.zip"
    items = [
        (ROOT_DIR / "backend", "backend"),
        (ROOT_DIR / "supabase_seed_data.sql", ""),
        (ROOT_DIR / "scripts", "scripts"),
        (ROOT_DIR / "requirements.txt", "")
    ]
    make_zip(zip_path, items)

def create_full_api_stack_zip():
    # Full API Stack: Layer 2 Gateway + Layer 3 Backend + Layer 9 Analytics + SQL + Docs
    zip_path = OUTPUT_DIR / "dakini_full_api_stack.zip"
    items = [
        (ROOT_DIR / "gateway", "gateway"),
        (ROOT_DIR / "backend", "backend"),
        (ROOT_DIR / "analytics", "analytics"),
        (ROOT_DIR / "supabase_seed_data.sql", ""),
        (ROOT_DIR / "scripts", "scripts"),
        (ROOT_DIR / "requirements.txt", ""),
        (ROOT_DIR / "pytest.ini", ""),
        (ROOT_DIR / "README.md", "")
    ]
    make_zip(zip_path, items)

if __name__ == "__main__":
    print(f"Building clean release packages in {OUTPUT_DIR}...")
    create_frontend_zip()
    create_gateway_zip()
    create_backend_zip()
    create_full_api_stack_zip()
    print("\nAll ZIP archives generated successfully!")

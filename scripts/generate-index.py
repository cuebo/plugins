#!/usr/bin/env python3
"""Build the public plugin catalog from first-level plugin manifests."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.json"


def build():
    entries = []
    for manifest in sorted(ROOT.glob("*/plugin.json")):
        plugin = json.loads(manifest.read_text(encoding="utf-8"))
        if not isinstance(plugin.get("tools"), list) or not plugin.get("id"):
            raise ValueError(f"invalid manifest: {manifest}")
        entries.append({
            "id": plugin["id"],
            "name": plugin["name"],
            "description": plugin.get("description", ""),
            "version": plugin["version"],
            "path": manifest.parent.name,
            "toolCount": len(plugin["tools"]),
            "networkHosts": plugin.get("networkHosts", []),
        })
    if len({entry["id"] for entry in entries}) != len(entries):
        raise ValueError("duplicate plugin ID")
    return json.dumps({"schemaVersion": 1, "plugins": entries}, ensure_ascii=False, indent=2) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if index.json needs an update")
    args = parser.parse_args()
    content = build()
    if args.check:
        if not INDEX.exists() or INDEX.read_text(encoding="utf-8") != content:
            raise SystemExit("index.json is out of date; run scripts/generate-index.py")
    else:
        INDEX.write_text(content, encoding="utf-8")


if __name__ == "__main__":
    main()

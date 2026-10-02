#!/usr/bin/env python3
"""Materialize only the public files required by a sparse R2 upload checkout."""

import argparse
import fnmatch
import shlex
import subprocess
import sys


def git_output(*args: str) -> list[str]:
    result = subprocess.run(
        ["git", *args], capture_output=True, text=True, check=True
    )
    return [line for line in result.stdout.splitlines() if line]


def public_paths_for_changed() -> list[str]:
    return [
        path
        for path in git_output("diff", "--name-only", "--diff-filter=AM", "HEAD~1", "HEAD")
        if path.startswith("public/")
    ]


def public_paths_for_specific(raw_patterns: str) -> list[str]:
    patterns = shlex.split(raw_patterns)
    if not patterns:
        raise ValueError("specific_files input is required for specific mode")
    repository_paths = git_output("ls-tree", "-r", "--name-only", "HEAD")
    matches = {
        path
        for pattern in patterns
        for path in repository_paths
        if path.startswith("public/") and fnmatch.fnmatch(path, pattern)
    }
    if not matches:
        raise ValueError("No public files matched specific_files")
    return sorted(matches)


def hydrate(paths: list[str]) -> None:
    if not paths:
        print("No public files need to be hydrated.")
        return
    subprocess.run(
        # Non-cone mode is configured by actions/checkout. `sparse-checkout add`
        # inherits it, and current Git versions do not accept --no-cone here.
        ["git", "sparse-checkout", "add", "--stdin"],
        input="\n".join(paths) + "\n",
        text=True,
        check=True,
    )
    subprocess.run(["git", "checkout", "HEAD", "--", *paths], check=True)
    print(f"Hydrated {len(paths)} public file(s).")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("changed", "specific"))
    parser.add_argument("--specific-files", default="")
    args = parser.parse_args()
    try:
        paths = (
            public_paths_for_changed()
            if args.mode == "changed"
            else public_paths_for_specific(args.specific_files)
        )
        hydrate(paths)
        return 0
    except (subprocess.CalledProcessError, ValueError) as error:
        print(f"::error::{error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

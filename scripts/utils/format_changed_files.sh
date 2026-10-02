#!/bin/bash
# Format only changed JSON files using prettier

set -e

# Gather tracked and untracked JSON files without parsing whitespace-delimited
# porcelain output. Prettier is started once for the whole batch; starting it
# once per file dominated large data refresh runs.
mapfile -d '' -t CHANGED_FILES < <(
    {
        git diff --name-only --diff-filter=AM -z
        git diff --cached --name-only --diff-filter=AM -z
        git ls-files --others --exclude-standard -z
    } | while IFS= read -r -d '' file; do
        [[ "$file" == *.json ]] && printf '%s\0' "$file"
    done | sort -zu
)

if [ "${#CHANGED_FILES[@]}" -eq 0 ]; then
    echo "No changed JSON files to format."
    exit 0
fi

# Filter out excluded paths if EXCLUDE_PATHS environment variable is set
if [ -n "$EXCLUDE_PATHS" ]; then
    FILTERED_FILES=()
    for file in "${CHANGED_FILES[@]}"; do
        EXCLUDE=false
        for exclude_path in $EXCLUDE_PATHS; do
            if [[ "$file" == "$exclude_path"* ]]; then
                EXCLUDE=true
                break
            fi
        done
        if [ "$EXCLUDE" = false ]; then
            FILTERED_FILES+=("$file")
        fi
    done
    CHANGED_FILES=("${FILTERED_FILES[@]}")
fi

if [ "${#CHANGED_FILES[@]}" -eq 0 ]; then
    echo "No changed JSON files to format (after exclusions)."
    exit 0
fi

echo "Formatting changed JSON files:"
for file in "${CHANGED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  - $file"
    fi
done

npx prettier --write "${CHANGED_FILES[@]}" --log-level=warn

echo "✅ Formatting complete."

#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
project="$repo_root/tests/Quantum/QuantumMathChecks.csproj"

if [ -n "${DOTNET:-}" ]; then
    dotnet_command=$DOTNET
elif command -v dotnet >/dev/null 2>&1; then
    dotnet_command=dotnet
elif command -v dotnet.exe >/dev/null 2>&1; then
    dotnet_command=dotnet.exe
elif [ -x '/mnt/c/Program Files/dotnet/dotnet.exe' ]; then
    dotnet_command='/mnt/c/Program Files/dotnet/dotnet.exe'
else
    printf '%s\n' 'Quantum checks need .NET SDK 8 or newer. Install it or set DOTNET to its executable.' >&2
    exit 1
fi

# WSL can use the installed Windows SDK, which needs a Windows project path.
case "$dotnet_command" in
    *.exe)
        if command -v wslpath >/dev/null 2>&1; then
            project=$(wslpath -w "$project")
        fi
        ;;
esac

sdk_version=$("$dotnet_command" --version)
sdk_major=${sdk_version%%.*}
case "$sdk_major" in
    ''|*[!0-9]*)
        printf '%s\n' "Cannot determine .NET SDK major version: $sdk_version" >&2
        exit 1
        ;;
esac
if [ "$sdk_major" -lt 8 ]; then
    printf '%s\n' "Quantum checks need .NET SDK 8 or newer; found $sdk_version." >&2
    exit 1
fi

# Target the installed SDK/runtime so an SDK 10-only machine does not need to
# download .NET 8 reference packs or install another runtime. There are no NuGet packages.
exec "$dotnet_command" run --project "$project" --configuration Release \
    -p:QuantumTargetFramework="net$sdk_major.0"

param(
    [string]$EditorPath,
    [string]$EditorVersion
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$projectPath = Join-Path $repoRoot "unity"

if (-not $EditorVersion) {
    $versionText = Get-Content -LiteralPath (Join-Path $projectPath "ProjectSettings\ProjectVersion.txt") -Raw
    if ($versionText -notmatch '(?m)^m_EditorVersion:\s*(\S+)') {
        throw "Cannot read the pinned Unity Editor version. Pass -EditorPath explicitly."
    }
    $EditorVersion = $Matches[1]
}

if (-not $EditorPath) {
    $candidates = @(
        (Join-Path $env:ProgramFiles "Unity\Hub\Editor\$EditorVersion\Editor\Unity.exe"),
        (Join-Path $env:ProgramFiles "Unity Hub\Editor\$EditorVersion\Editor\Unity.exe"),
        (Join-Path $env:USERPROFILE "Unity\Hub\Editor\$EditorVersion\Editor\Unity.exe")
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $EditorPath = $candidate
            break
        }
    }
}

if (-not $EditorPath -or -not (Test-Path -LiteralPath $EditorPath -PathType Leaf)) {
    throw "Unity Editor $EditorVersion is not installed at a standard Hub location. Finish its installation, or pass -EditorPath with the full Editor\Unity.exe path. Unity Hub itself is not the Editor."
}

$EditorPath = (Resolve-Path -LiteralPath $EditorPath).Path
if ([IO.Path]::GetFileName($EditorPath) -ine "Unity.exe" -or
    [IO.Path]::GetFileName((Split-Path -Parent $EditorPath)) -ine "Editor") {
    throw "Pass the Unity Editor executable under an Editor folder, not the Hub or its launcher."
}

$logDirectory = Join-Path $projectPath "Logs"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$logPath = Join-Path $logDirectory "batch-verify.log"
$arguments = @(
    "-batchmode", "-nographics",
    "-projectPath", $projectPath,
    "-executeMethod", "Quriosity.Editor.DemoProjectBuilder.BuildFromCommandLine",
    "-logFile", $logPath,
    "-quit"
)

# Start-Process waits even for Windows GUI executables. Explicit quotes preserve
# argument boundaries for project and log paths containing spaces.
$argumentLine = ($arguments | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join " "
Write-Output "Running Unity Editor: $EditorPath"
Write-Output "Import/compile/build verification log: $logPath"
$process = Start-Process -FilePath $EditorPath -ArgumentList $argumentLine -Wait -PassThru
if ($process.ExitCode -ne 0) {
    throw "Unity verification failed with exit code $($process.ExitCode). Read $logPath for the Editor error."
}

Write-Output "Unity import, compilation, scene generation and saved-asset verification passed. Play Mode checks remain separate."

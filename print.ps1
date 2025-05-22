<#
.SYNOPSIS
    Prints the directory structure of a Node.js project, including frontend (client)
    and backend (server) structures, while ignoring common dependency folders.

.DESCRIPTION
    This script traverses the specified project root directory (defaulting to the
    current directory) and its 'client' and 'server' subdirectories. It uses
    a recursive function to display a tree-like structure, excluding directories
    like 'node_modules', '.git', 'dist', and common lock files.

.PARAMETER ProjectRoot
    The absolute path to the Node.js project's root directory.
    If not specified, the script will use the current working directory.

.EXAMPLE
    # Run the script in the project's root directory
    .\Print-NodeProjectStructure.ps1

.EXAMPLE
    # Specify a different project root directory
    .\Print-NodeProjectStructure.ps1 -ProjectRoot "D:\MyProjects\MyWebApp"

.NOTES
    Author: Your AI Assistant
    Date: 2025-05-22
    Version: 1.0
#>

param (
    [Parameter(Mandatory=$false)]
    [string]$ProjectRoot = (Get-Location).Path
)

# 定义要忽略的目录和文件模式 (不区分大小写)
# 使用 -like 运算符的通配符匹配
$IgnorePatterns = @(
    "node_modules"        # Node.js 依赖
    "package-lock.json"   # npm 锁文件
    "yarn.lock"           # Yarn 锁文件
    "pnpm-lock.yaml"      # pnpm 锁文件
    ".git"                # Git 版本控制目录
    ".gitignore"          # Git 忽略文件
    "dist"                # 常见的构建输出目录
    "build"               # 常见的构建输出目录
    "out"                 # 另一个常见的构建输出目录
    "temp"                # 临时文件目录
    "tmp"                 # 另一个临时文件目录
    "logs"                # 日志文件目录
    ".vscode"             # VS Code 配置目录
    ".idea"               # IntelliJ/WebStorm IDE 配置目录
    "*.log"               # 忽略所有 .log 文件
    "*.bak"               # 忽略所有 .bak 文件
)

Function Get-TreeStructure {
    Param (
        [string]$Path,
        [int]$IndentLevel = 0,
        [array]$ExcludePatterns = @()
    )

    $indent = "    " * $IndentLevel # 每个级别增加4个空格的缩进
    # 获取子项，强制显示隐藏项，并按类型和名称排序 (目录在前)
    $items = Get-ChildItem -Path $Path -Force | Sort-Object -Property PSIsContainer, Name

    foreach ($item in $items) {
        $shouldExclude = $false
        foreach ($pattern in $ExcludePatterns) {
            # 检查文件名或目录名是否匹配忽略模式（不区分大小写）
            if ($item.Name -ilike $pattern) { # -ilike 是不区分大小写的 -like
                $shouldExclude = $true
                break
            }
        }

        if (-not $shouldExclude) {
            if ($item.PSIsContainer) {
                Write-Host "$($indent)[$($item.Name)]"
                # 递归调用自身处理子目录
                Get-TreeStructure -Path $item.FullName -IndentLevel ($IndentLevel + 1) -ExcludePatterns $ExcludePatterns
            } else {
                Write-Host "$($indent)$($item.Name)"
            }
        }
    } # <-- 这个是 foreach ($item in $items) 的闭合
} # <-- 这个是 Function Get-TreeStructure 的闭合

Write-Host "========================================"
Write-Host "     Node.js 项目结构分析"
Write-Host "========================================"
Write-Host "项目根目录: $($ProjectRoot)"
Write-Host "忽略模式: $($IgnorePatterns -join ', ')"
Write-Host ""

# 打印项目根目录结构
Write-Host "====== 项目根目录结构 ======"
if (Test-Path $ProjectRoot -PathType Container) {
    Get-TreeStructure -Path $ProjectRoot -ExcludePatterns $IgnorePatterns -IndentLevel 0
} else {
    Write-Warning "指定的项目根目录 '$ProjectRoot' 不存在或不是一个目录。"
}

Write-Host "`n====== 前端 (client) 目录结构 ======"
$clientPath = Join-Path $ProjectRoot "client"
if (Test-Path $clientPath -PathType Container) {
    Get-TreeStructure -Path $clientPath -ExcludePatterns $IgnorePatterns -IndentLevel 0
} else {
    Write-Host "未找到 'client' 目录。"
}

Write-Host "`n====== 后端 (server) 目录结构 ======"
$serverPath = Join-Path $ProjectRoot "server"
if (Test-Path $serverPath -PathType Container) {
    Get-TreeStructure -Path $serverPath -ExcludePatterns $IgnorePatterns -IndentLevel 0
} else {
    Write-Host "未找到 'server' 目录。"
}

Write-Host "`n========================================"
Write-Host "分析完成。"
Write-Host "========================================"
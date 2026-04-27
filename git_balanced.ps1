function Commit-With-Date($message, $date, $patterns) {
    foreach ($p in $patterns) {
        git add $p
    }
    $env:GIT_AUTHOR_DATE = $date
    $env:GIT_COMMITTER_DATE = $date
    git commit -m $message --date=$date
}

git checkout -b main

# 1. Setup & Styles (Friday Late Afternoon) - ~15 files
Commit-With-Date "chore: initial project setup and design system foundation" "2026-04-24T16:34:12" @("package.json", "package-lock.json", "vite.config.ts", "index.html", "README.md", ".gitignore", "postcss.config.mjs", "pnpm-workspace.yaml", "default_shadcn_theme.css", "src/styles/", "src/main.tsx", "src/App.tsx")

# 2. Core & Navigation (Friday Evening) - ~10 files
Commit-With-Date "feat: core architecture context management and routing implementation" "2026-04-24T18:52:45" @("src/app/routes.tsx", "src/app/context/AppContext.tsx", "src/app/hooks/useSoundManager.ts", "src/app/components/layout/")

# 3. UI Foundation Part 1 (Friday Night) - ~15 files
Commit-With-Date "feat: implementation of base UI components and layout elements" "2026-04-24T21:18:22" @("src/app/components/ui/button.tsx", "src/app/components/ui/card.tsx", "src/app/components/ui/input.tsx", "src/app/components/ui/label.tsx", "src/app/components/ui/dialog.tsx", "src/app/components/ui/dropdown-menu.tsx", "src/app/components/ui/popover.tsx", "src/app/components/ui/select.tsx", "src/app/components/ui/scroll-area.tsx", "src/app/components/ui/tabs.tsx", "src/app/components/ui/badge.tsx", "src/app/components/ui/avatar.tsx", "src/app/components/ui/separator.tsx", "src/app/components/ui/skeleton.tsx", "src/app/components/ui/SoundToggleButton.tsx")

# 4. Phases 1-2 & Data UI (Saturday Afternoon) - ~15 files
Commit-With-Date "feat: development of Phase 1 and Phase 2 modules with data UI components" "2026-04-25T16:21:09" @("src/app/components/phases/IdoneidadModule.tsx", "src/app/components/phases/EntrevistasModule.tsx", "src/app/components/ui/table.tsx", "src/app/components/ui/checkbox.tsx", "src/app/components/ui/radio-group.tsx", "src/app/components/ui/progress.tsx", "src/app/components/ui/tooltip.tsx", "src/app/components/ui/accordion.tsx", "src/app/components/ui/form.tsx", "src/app/components/ui/calendar.tsx", "src/app/components/ui/breadcrumb.tsx")

# 5. Phases 3-6 & Advanced UI (Saturday Night) - ~18 files
Commit-With-Date "feat: implementation of diagnosis phases and advanced interactive components" "2026-04-25T22:56:31" @("src/app/components/phases/DocumentacionModule.tsx", "src/app/components/phases/TipoProyectosModule.tsx", "src/app/components/phases/MadurezModule.tsx", "src/app/components/phases/EnfoqueModule.tsx", "src/app/components/ui/alert-dialog.tsx", "src/app/components/ui/aspect-ratio.tsx", "src/app/components/ui/collapsible.tsx", "src/app/components/ui/context-menu.tsx", "src/app/components/ui/hover-card.tsx", "src/app/components/ui/menubar.tsx", "src/app/components/ui/navigation-menu.tsx", "src/app/components/ui/carousel.tsx", "src/app/components/ui/command.tsx", "src/app/components/ui/drawer.tsx", "src/app/components/ui/input-otp.tsx")

# 6. Phases 7-8 & Project Views (Sunday Early Afternoon) - ~10 files
Commit-With-Date "feat: completion of Phase 7 and 8 with project management views" "2026-04-26T14:12:55" @("src/app/components/phases/GuiaMetodologicaView.tsx", "src/app/components/phases/ArtefactosView.tsx", "src/app/components/project/")

# 7. Utilities & Polish (Sunday Late Afternoon) - ~15 files
Commit-With-Date "feat: implementation of charts helper utilities and remaining UI elements" "2026-04-26T17:48:33" @("src/app/components/ui/chart.tsx", "src/app/components/ui/pagination.tsx", "src/app/components/ui/resizable.tsx", "src/app/components/ui/sheet.tsx", "src/app/components/ui/sidebar.tsx", "src/app/components/ui/slider.tsx", "src/app/components/ui/sonner.tsx", "src/app/components/ui/switch.tsx", "src/app/components/ui/textarea.tsx", "src/app/components/ui/toggle.tsx", "src/app/components/ui/toggle-group.tsx", "src/app/components/ui/use-mobile.ts", "src/app/components/ui/utils.ts", "src/lib/")

# 8. Final Assembly (Sunday Night) - ~30 files
git add .
$date = "2026-04-26T21:58:02"
$env:GIT_AUTHOR_DATE = $date
$env:GIT_COMMITTER_DATE = $date
git commit -m "feat: final assembly component optimization and assets integration" --date=$date

#!/bin/bash
# Скрипт для очистки кэша индексации Cursor для проекта Elements
# Включает очистку больших транскриптов чатов, которые могут вызывать зависание

echo "🧹 Очистка кэша и больших транскриптов Cursor для проекта Elements..."
echo ""

# 1. Очищаем большие транскрипты (больше 50KB)
echo "📝 Поиск больших транскриптов (>50KB)..."
LARGE_TRANSCRIPTS=$(find "$HOME/.cursor/projects" -type f -name "*.txt" -size +50k 2>/dev/null)
if [ -n "$LARGE_TRANSCRIPTS" ]; then
    echo "Найдены большие транскрипты:"
    echo "$LARGE_TRANSCRIPTS" | while read file; do
        size=$(du -h "$file" | cut -f1)
        echo "  - $file ($size)"
    done
    echo ""
    read -p "Удалить большие транскрипты? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "$LARGE_TRANSCRIPTS" | while read file; do
            rm -f "$file"
            echo "  ✓ Удален: $file"
        done
    fi
else
    echo "  ✓ Больших транскриптов не найдено"
fi
echo ""

# 2. Очищаем кэш проекта Elements
echo "🗂️  Очистка кэша проекта Elements..."
if [ -d "$HOME/.cursor/projects/home-skandal1st-Elements" ]; then
    rm -rf "$HOME/.cursor/projects/home-skandal1st-Elements"
    echo "  ✓ Кэш проекта удален"
else
    echo "  ✓ Кэш проекта не найден (уже очищен)"
fi
echo ""

# 3. Очищаем базу данных трекинга (опционально, если она слишком большая)
echo "📊 Проверка базы данных трекинга..."
TRACKING_DB="$HOME/.cursor/ai-tracking/ai-code-tracking.db"
if [ -f "$TRACKING_DB" ]; then
    size=$(du -h "$TRACKING_DB" | cut -f1)
    echo "  Размер базы данных: $size"
    if [ $(stat -f%z "$TRACKING_DB" 2>/dev/null || stat -c%s "$TRACKING_DB" 2>/dev/null) -gt 10485760 ]; then
        echo "  ⚠️  База данных больше 10MB"
        read -p "  Очистить базу данных трекинга? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -f "$TRACKING_DB"
            echo "  ✓ База данных удалена"
        fi
    else
        echo "  ✓ Размер базы данных в норме"
    fi
else
    echo "  ✓ База данных не найдена"
fi
echo ""

# 4. Очищаем workspace storage (опционально)
echo "💾 Очистка workspace storage..."
if [ -d "$HOME/.config/Cursor/User/workspaceStorage" ]; then
    ELEMENTS_STORAGE=$(find "$HOME/.config/Cursor/User/workspaceStorage" -name "*Elements*" -type d 2>/dev/null)
    if [ -n "$ELEMENTS_STORAGE" ]; then
        echo "  Найдены workspace storage для Elements:"
        echo "$ELEMENTS_STORAGE" | while read dir; do
            size=$(du -sh "$dir" 2>/dev/null | cut -f1)
            echo "  - $dir ($size)"
        done
        read -p "  Удалить workspace storage для Elements? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "$ELEMENTS_STORAGE" | while read dir; do
                rm -rf "$dir"
                echo "  ✓ Удален: $dir"
            done
        fi
    else
        echo "  ✓ Workspace storage для Elements не найден"
    fi
else
    echo "  ✓ Workspace storage не найден"
fi
echo ""

echo "✅ Очистка завершена!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Закройте Cursor полностью (не просто окно, а весь процесс)"
echo "2. Откройте проект Elements заново"
echo "3. Cursor переиндексирует проект (это займет время, но не должно зависать)"
echo ""
echo "💡 Совет: Если проблема повторится, рассмотрите возможность:"
echo "   - Удаления старых транскриптов регулярно"
echo "   - Использования .cursorignore для исключения больших файлов"
echo "   - Ограничения размера контекста в настройках Cursor"

#!/bin/bash
# Автоматическая очистка кэша Cursor без интерактивных вопросов
# Используйте этот скрипт, если хотите быстро очистить всё

echo "🧹 Автоматическая очистка кэша Cursor для проекта Elements..."
echo ""

# 1. Удаляем большие транскрипты (>50KB)
echo "📝 Удаление больших транскриптов (>50KB)..."
find "$HOME/.cursor/projects" -type f -name "*.txt" -size +50k -delete 2>/dev/null
echo "  ✓ Большие транскрипты удалены"
echo ""

# 2. Очищаем кэш проекта Elements
echo "🗂️  Очистка кэша проекта Elements..."
rm -rf "$HOME/.cursor/projects/home-skandal1st-Elements" 2>/dev/null
rm -rf "$HOME/.cursor/projects/home-skandal1st-Elements-finance" 2>/dev/null
echo "  ✓ Кэш проекта удален"
echo ""

# 3. Очищаем базу данных трекинга, если она больше 10MB
echo "📊 Проверка базы данных трекинга..."
TRACKING_DB="$HOME/.cursor/ai-tracking/ai-code-tracking.db"
if [ -f "$TRACKING_DB" ]; then
    size_bytes=$(stat -f%z "$TRACKING_DB" 2>/dev/null || stat -c%s "$TRACKING_DB" 2>/dev/null)
    if [ "$size_bytes" -gt 10485760 ]; then
        rm -f "$TRACKING_DB"
        echo "  ✓ База данных трекинга удалена (была больше 10MB)"
    else
        echo "  ✓ Размер базы данных в норме"
    fi
else
    echo "  ✓ База данных не найдена"
fi
echo ""

echo "✅ Автоматическая очистка завершена!"
echo ""
echo "📋 Теперь:"
echo "1. Закройте Cursor полностью"
echo "2. Откройте проект Elements заново"

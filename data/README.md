# Data Directory - PROTECTED

## Contains:
- `golf.db` - SQLite database with courses, tee times, reviews, etc.

## DO NOT:
- Delete golf.db
- Modify schema without updating src/db/schema.js
- Commit sensitive data

## To reset database:
```bash
rm data/golf.db
node -e "require('./src/db/schema')"
node -e "require('./src/db/courses').seedCourses()"
```

## Backup before major changes:
```bash
cp data/golf.db data/golf.db.backup
```

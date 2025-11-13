@echo off
copy PINStemplate.js PINS.js
echo Created PINS.js file
cd database
@REM node init-db
copy databaseTemplate.db database.db
@echo off
copy PINStemplate.js PINS.js
echo Created PINS.js file
cd database
@REM echo. > database.db
node init-db
cd ../
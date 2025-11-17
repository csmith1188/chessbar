@echo off
echo Downloading NPM dependencies
call npm i
echo Creating INFO.js file
copy INFOtemplate.js INFO.js
cd database
echo Initializing database
del *.db
node init-db
cd ../
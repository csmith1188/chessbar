@echo off
echo Downloading NPM dependencies
start /b npm i
echo Creating PINS.js file
copy PINStemplate.js PINS.js
cd database
echo Initializing database
del *.db
node init-db
cd ../
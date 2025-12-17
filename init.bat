@echo off
echo Downloading NPM dependencies
call npm i
echo Creating .env file
copy template.env .env
echo Initializing database
cd database
del *.db
node init-db
cd ../
echo Initialization complete
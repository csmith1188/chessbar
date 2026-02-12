@echo off
cd database
echo Initializing database
del *.db
node migrate
cd ../
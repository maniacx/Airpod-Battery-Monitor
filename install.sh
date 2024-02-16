#!/usr/bin/env bash

# Change working directory to project folder
cd "${0%/*}"

EXT_NAME="Airpod Battery Monitor"
EXT_UUID="Airpods-Battery-Monitor@maniacx.github.com"

if ! command -v msgfmt &> /dev/null
then
    echo "Missing gettext!!!"
    echo "Please install gettext and re-run this installer"
    read -n1
    exit 1
fi

echo "Packing extension..."
gnome-extensions pack ./ \
    --extra-source=icons/ \
    --extra-source=lib/ \
    --extra-source=preferences/ \
    --extra-source=ui/ \
    --podir=po \
    --force \

if [ $? -ne 0 ]; then 
    echo "Error occur during compilation of Gnome Extension ${EXT_NAME}"
    read -n1
    exit $?
fi

echo "Installing extension..."
gnome-extensions install $EXT_UUID.shell-extension.zip --force

if [ $? -ne 0 ]; then 
    read -n1
    exit $?
fi

echo "Gnome Extension $EXT_NAME was succesfully installed."
echo "Restart the shell (or logout) to be able to enable the extension."


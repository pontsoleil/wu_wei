#!/bin/sh
echo "Content-Type: text/plain"
echo
echo "SCRIPT_FILENAME=$SCRIPT_FILENAME"
echo "SCRIPT_NAME=$SCRIPT_NAME"
echo "DOCUMENT_ROOT=$DOCUMENT_ROOT"
echo "REQUEST_METHOD=$REQUEST_METHOD"
echo "PWD=$(pwd)"
echo "USER=$(id)"
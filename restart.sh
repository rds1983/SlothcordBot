#!/bin/bash
pkill node
rm -f nohup.out
nohup node index.js &
